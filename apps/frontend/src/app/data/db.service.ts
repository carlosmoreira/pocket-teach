import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import type { CachedLesson, CachedProject } from './models';
import type { LessonSummary } from '../api/contracts';

// The backend is the source of truth; this store is an offline replica of the
// project index and lessons so lessons read without the backend.
@Injectable({ providedIn: 'root' })
export class DbService extends Dexie {
  readonly projects!: Table<CachedProject, string>;
  readonly lessons!: Table<CachedLesson, string>;

  constructor() {
    super('pocket-teach-v2');
    this.version(1).stores({ lessons: 'key, projectId', settings: 'id' });
    this.version(2).stores({
      projects: 'id, updatedAt',
      lessons: 'key, projectId',
      settings: 'id',
    });
    // Backend URL is a build-time env var now and there's no token — drop the
    // settings store.
    this.version(3).stores({
      projects: 'id, updatedAt',
      lessons: 'key, projectId',
      settings: null,
    });
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
