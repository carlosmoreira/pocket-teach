import { Injectable } from '@angular/core';
import Dexie, { type Table } from 'dexie';
import {
  type LearningRecord,
  type Lesson,
  type Message,
  type Project,
  type ReferenceDocRow,
  type Settings,
  SETTINGS_KEY,
} from './models';

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
}
