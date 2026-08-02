import { Injectable } from '@nestjs/common';
import { KeyedMutex } from '../common/keyed-mutex';
import { WorkspaceRepository } from './workspace.repository';
import type { LessonInput, LessonSummary, ProjectSummary } from './workspace.types';

// The Teacher's memory files. Free-form markdown the Teacher curates; the app
// only reads them back into context.
export type MemoryFile = 'mission' | 'roadmap' | 'learner-profile' | 'misconceptions' | 'glossary';

const MEMORY_FILES: Record<MemoryFile, string> = {
  mission: 'mission.md',
  roadmap: 'roadmap.md',
  'learner-profile': 'learner-profile.md',
  misconceptions: 'misconceptions.md',
  glossary: 'glossary.md',
};

const LEARNING_RECORDS = 'learning-records.md';
const TRANSCRIPT = 'transcript.jsonl';
const LESSONS_INDEX = 'lessons/index.json';

// The domain over a project Workspace: the canonical files, the lesson index,
// learning records, transcript, and the compact index the Teacher reads to
// orient itself.
@Injectable()
export class WorkspaceService {
  // Serializes all mutations of a given project so parallel agent tool calls or
  // two tabs can't clobber the lesson index or race git's index.lock.
  private readonly locks = new KeyedMutex();

  constructor(private readonly repo: WorkspaceRepository) {}

  async createProject(projectId: string): Promise<void> {
    await this.locks.run(projectId, () => this.repo.createProject(projectId));
  }

  async deleteProject(projectId: string): Promise<void> {
    await this.locks.run(projectId, () => this.repo.deleteProject(projectId));
  }

  async projectExists(projectId: string): Promise<boolean> {
    return this.repo.projectExists(projectId);
  }

  async listProjects(): Promise<ProjectSummary[]> {
    const ids = await this.repo.listProjectIds();
    const summaries = await Promise.all(
      ids.map(async (id) => ({
        id,
        title: titleFromMission(await this.readMemory(id, 'mission')),
        lessonCount: (await this.listLessons(id)).length,
        createdAt: await this.repo.createdAt(id),
        updatedAt: await this.repo.updatedAt(id),
      })),
    );
    return summaries.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
  }

  async readMemory(projectId: string, name: MemoryFile): Promise<string> {
    return (await this.repo.readFile(projectId, MEMORY_FILES[name])) ?? '';
  }

  async writeMemory(projectId: string, name: MemoryFile, content: string): Promise<void> {
    await this.locks.run(projectId, async () => {
      await this.repo.writeFile(projectId, MEMORY_FILES[name], ensureTrailingNewline(content));
      await this.repo.commit(projectId, `update ${name}`);
    });
  }

  async appendLearningRecord(projectId: string, note: string): Promise<void> {
    await this.locks.run(projectId, async () => {
      await this.repo.appendFile(projectId, LEARNING_RECORDS, `- ${note.trim()}\n`);
      await this.repo.commit(projectId, 'record a learning');
    });
  }

  async listLessons(projectId: string): Promise<LessonSummary[]> {
    const raw = await this.repo.readFile(projectId, LESSONS_INDEX);
    if (raw === undefined) return [];
    // The index exists: a parse failure is corruption, not "no lessons". Fail
    // loud so it can't silently reset lesson numbering and overwrite history.
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) throw new Error('lessons/index.json is not an array');
    return parsed as LessonSummary[];
  }

  async readLesson(projectId: string, slug: string): Promise<string | undefined> {
    const lessons = await this.listLessons(projectId);
    const match =
      lessons.find((l) => l.slug === slug) ??
      lessons.find((l) => l.slug.replace(/^\d+-/, '') === slug);
    if (!match) return undefined;
    return this.repo.readFile(projectId, match.file);
  }

  async writeLesson(projectId: string, input: LessonInput): Promise<LessonSummary> {
    return this.locks.run(projectId, async () => {
      const lessons = await this.listLessons(projectId);
      const seq = lessons.reduce((max, l) => Math.max(max, l.seq), 0) + 1;
      const slug = `${pad4(seq)}-${kebab(input.slug)}`;
      const file = `lessons/${slug}.html`;

      const summary: LessonSummary = {
        seq,
        slug,
        title: input.title,
        recap: input.recap,
        primarySource: input.primarySource,
        linkedTerms: input.linkedTerms ?? [],
        file,
        createdAt: new Date().toISOString(),
      };

      await this.repo.writeFile(projectId, file, input.html);
      await this.repo.writeFile(
        projectId,
        LESSONS_INDEX,
        JSON.stringify([...lessons, summary], null, 2),
      );
      await this.repo.commit(projectId, `lesson ${slug}: ${input.title}`);
      return summary;
    });
  }

  // Rewrite an existing lesson in place — same seq, slug, and file, so it keeps
  // its spot in the course. The prior version stays in git history for undo.
  // Used by amplify (clarify / reword an existing lesson).
  async updateLesson(projectId: string, slug: string, input: LessonInput): Promise<LessonSummary> {
    return this.locks.run(projectId, async () => {
      const lessons = await this.listLessons(projectId);
      // Match readLesson's order — exact slug first, then the de-numbered form —
      // so the lesson we rewrite is always the one the model was shown.
      let index = lessons.findIndex((l) => l.slug === slug);
      if (index === -1) index = lessons.findIndex((l) => l.slug.replace(/^\d+-/, '') === slug);
      if (index === -1) {
        throw new Error(`cannot amplify: lesson "${slug}" is not in the index`);
      }
      const existing = lessons[index];
      const summary: LessonSummary = {
        ...existing,
        title: input.title,
        recap: input.recap,
        primarySource: input.primarySource,
        linkedTerms: input.linkedTerms ?? existing.linkedTerms,
      };

      const next = [...lessons];
      next[index] = summary;
      await this.repo.writeFile(projectId, existing.file, input.html);
      await this.repo.writeFile(projectId, LESSONS_INDEX, JSON.stringify(next, null, 2));
      await this.repo.commit(projectId, `amplify ${existing.slug}: ${input.title}`);
      return summary;
    });
  }

  // Not committed here (kept low-noise); the next memory/lesson commit sweeps it
  // in via `git add -A`. On disk immediately either way.
  async appendTranscript(projectId: string, entry: unknown): Promise<void> {
    await this.locks.run(projectId, () =>
      this.repo.appendFile(projectId, TRANSCRIPT, `${JSON.stringify(entry)}\n`),
    );
  }

  async readTranscript(projectId: string): Promise<unknown[]> {
    const raw = await this.repo.readFile(projectId, TRANSCRIPT);
    if (!raw) return [];
    return raw
      .split('\n')
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }

  // The compact orienting context sent to the Teacher each turn: its curated
  // memory plus the lesson recaps, never the lesson bodies (read on demand) and
  // never the raw learning-records log (that gets distilled into the profile).
  async readIndex(projectId: string): Promise<string> {
    const [mission, roadmap, profile, misconceptions, glossary, lessons] = await Promise.all([
      this.readMemory(projectId, 'mission'),
      this.readMemory(projectId, 'roadmap'),
      this.readMemory(projectId, 'learner-profile'),
      this.readMemory(projectId, 'misconceptions'),
      this.readMemory(projectId, 'glossary'),
      this.listLessons(projectId),
    ]);

    const lessonIndex = lessons.length
      ? lessons.map((l) => `- ${l.slug} · ${l.title}\n  Recap: ${l.recap}`).join('\n')
      : '(no lessons yet)';

    return [
      section('Mission', mission || '(not set yet)'),
      section('Roadmap', roadmap || '(none yet)'),
      section('Learner profile', profile || '(nothing recorded yet)'),
      section('Misconceptions to revisit', misconceptions || '(none)'),
      section('Glossary', glossary || '(empty)'),
      section('Lessons taught', lessonIndex),
    ].join('\n\n');
  }

  async commit(projectId: string, message: string): Promise<boolean> {
    return this.repo.commit(projectId, message);
  }
}

function section(title: string, body: string): string {
  return `## ${title}\n${body.trim()}`;
}

function ensureTrailingNewline(content: string): string {
  return content.endsWith('\n') ? content : `${content}\n`;
}

function titleFromMission(mission: string): string {
  // Strip leading list/heading/quote markers so "- Topic: X", "## Topic",
  // "Topic: X" all resolve to the topic value.
  const cleaned = mission
    .split('\n')
    .map((l) => l.replace(/^[-*#>\s]+/, '').trim())
    .filter((l) => l.length > 0);
  for (const line of cleaned) {
    const inline = /^topic:\s*(.+)$/i.exec(line);
    if (inline) return inline[1].trim();
  }
  const topicHeading = cleaned.findIndex((l) => /^topic$/i.test(l));
  if (topicHeading !== -1 && cleaned[topicHeading + 1]) return cleaned[topicHeading + 1];
  return cleaned[0] ?? 'Untitled project';
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function kebab(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/^\d+-/, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'lesson'
  );
}
