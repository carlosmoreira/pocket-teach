import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import { type CachedLesson, type CachedProject, type Settings, SETTINGS_KEY } from './models';
import type { LessonSummary } from '../api/contracts';

// A new database name so the old client-owned workspace (projects, messages,
// records) is dropped — the backend is the source of truth now. This store is
// an offline replica: the project index and lessons, plus settings.
@Injectable({ providedIn: 'root' })
export class DbService extends Dexie {
  readonly projects!: Table<CachedProject, string>;
  readonly lessons!: Table<CachedLesson, string>;
  readonly settings!: Table<Settings, string>;

  constructor() {
    super('pocket-teach-v2');
    this.version(1).stores({ lessons: 'key, projectId', settings: 'id' });
    this.version(2).stores({
      projects: 'id, updatedAt',
      lessons: 'key, projectId',
      settings: 'id',
    });
  }

  async loadSettings(): Promise<Settings | undefined> {
    return this.settings.get(SETTINGS_KEY);
  }

  async saveSettings(settings: Omit<Settings, 'id'>): Promise<void> {
    await this.settings.put({ ...settings, id: SETTINGS_KEY });
  }

  async cacheProjects(projects: CachedProject[]): Promise<void> {
    await this.transaction('rw', this.projects, async () => {
      await this.projects.clear();
      await this.projects.bulkPut(projects);
    });
  }

  async listCachedProjects(): Promise<CachedProject[]> {
    return this.projects.orderBy('updatedAt').reverse().toArray();
  }

  // Upsert the lesson index for a project, preserving any HTML already cached.
  async cacheLessonSummaries(projectId: string, summaries: LessonSummary[]): Promise<void> {
    for (const s of summaries) {
      const key = `${projectId}/${s.slug}`;
      const existing = await this.lessons.get(key);
      await this.lessons.put({
        key,
        projectId,
        slug: s.slug,
        seq: s.seq,
        title: s.title,
        recap: s.recap,
        html: existing?.html,
        cachedAt: existing?.cachedAt ?? new Date().toISOString(),
      });
    }
  }

  async cacheLesson(lesson: {
    projectId: string;
    slug: string;
    seq: number;
    title: string;
    recap: string;
    html: string;
  }): Promise<void> {
    await this.lessons.put({
      ...lesson,
      key: `${lesson.projectId}/${lesson.slug}`,
      cachedAt: new Date().toISOString(),
    });
  }

  async listCachedLessons(projectId: string): Promise<CachedLesson[]> {
    const lessons = await this.lessons.where('projectId').equals(projectId).toArray();
    return lessons.sort((a, b) => a.seq - b.seq);
  }

  async getCachedLesson(projectId: string, slug: string): Promise<CachedLesson | undefined> {
    return this.lessons.get(`${projectId}/${slug}`);
  }
}
