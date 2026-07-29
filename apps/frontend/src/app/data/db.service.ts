import { Injectable } from '@angular/core';
import type { DoneEvent, GlossaryEntry, ResourceEntry } from '@pocket-teach/api-types';
import Dexie, { type Table } from 'dexie';
import {
  type LearningRecord,
  type Lesson,
  type Message,
  type Project,
  type ProjectMission,
  type ReferenceDocRow,
  type Settings,
  SETTINGS_KEY,
} from './models';

export interface ProjectSummary {
  project: Project;
  lessonCount: number;
}

export interface SavedGeneration {
  projectId: string;
  lessonId: string;
}

@Injectable({ providedIn: 'root' })
export class DbService extends Dexie {
  readonly projects!: Table<Project, string>;
  readonly lessons!: Table<Lesson, string>;
  readonly learningRecords!: Table<LearningRecord, string>;
  readonly referenceDocs!: Table<ReferenceDocRow, string>;
  readonly messages!: Table<Message, string>;
  readonly settings!: Table<Settings, string>;

  constructor() {
    super('pocket-teach');
    this.version(1).stores({
      projects: 'id, createdAt',
      lessons: 'id, projectId, [projectId+seq], slug',
      learningRecords: 'id, projectId, [projectId+seq], status',
      referenceDocs: 'id, projectId, [projectId+slug]',
      messages: 'id, projectId, [projectId+createdAt]',
      settings: 'id',
    });
  }

  async loadSettings(): Promise<Settings | undefined> {
    return this.settings.get(SETTINGS_KEY);
  }

  async saveSettings(settings: Omit<Settings, 'id'>): Promise<void> {
    await this.settings.put({ ...settings, id: SETTINGS_KEY });
  }

  async listProjectSummaries(): Promise<ProjectSummary[]> {
    const projects = await this.projects.orderBy('createdAt').reverse().toArray();
    return Promise.all(
      projects.map(async (project) => ({
        project,
        lessonCount: await this.lessons.where('projectId').equals(project.id).count(),
      })),
    );
  }

  async getProject(id: string): Promise<Project | undefined> {
    return this.projects.get(id);
  }

  async listLessons(projectId: string): Promise<Lesson[]> {
    const lessons = await this.lessons.where('projectId').equals(projectId).toArray();
    return lessons.sort((a, b) => a.seq - b.seq);
  }

  async getLesson(id: string): Promise<Lesson | undefined> {
    return this.lessons.get(id);
  }

  async saveGeneratedProject(mission: ProjectMission, done: DoneEvent): Promise<SavedGeneration> {
    const projectId = crypto.randomUUID();
    const lessonId = crypto.randomUUID();
    const createdAt = new Date().toISOString();

    const project: Project = {
      id: projectId,
      title: mission.topic,
      mission,
      glossary: mergeGlossary([], done.meta.glossaryUpdates),
      resources: mergeResources([], done.meta.resourceUpdates),
      createdAt,
    };

    const lesson: Lesson = {
      id: lessonId,
      projectId,
      seq: 1,
      slug: done.meta.slug,
      title: done.meta.title,
      primarySource: done.meta.primarySource,
      linkedTerms: done.meta.linkedTerms,
      recap: done.meta.recap,
      html: done.html,
      version: 1,
      createdAt,
    };

    await this.transaction('rw', this.projects, this.lessons, async () => {
      await this.projects.add(project);
      await this.lessons.add(lesson);
    });

    return { projectId, lessonId };
  }
}

function mergeGlossary(base: GlossaryEntry[], updates: GlossaryEntry[]): GlossaryEntry[] {
  const byTerm = new Map(base.map((entry) => [entry.term, entry]));
  for (const entry of updates) byTerm.set(entry.term, entry);
  return [...byTerm.values()];
}

function mergeResources(base: ResourceEntry[], updates: ResourceEntry[]): ResourceEntry[] {
  const byUrl = new Map(base.map((entry) => [entry.url, entry]));
  for (const entry of updates) byUrl.set(entry.url, entry);
  return [...byUrl.values()];
}
