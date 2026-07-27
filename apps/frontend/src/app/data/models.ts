import type {
  ChatRole,
  GlossaryEntry,
  PrimarySource,
  Proposal,
  ResourceEntry,
} from '@pocket-teach/api-types';

export interface ProjectMission {
  topic: string;
  why?: string;
  successLooksLike?: string;
  constraints?: string;
}

export interface Project {
  id: string;
  title: string;
  mission: ProjectMission;
  glossary: GlossaryEntry[];
  resources: ResourceEntry[];
  createdAt: string;
}

export interface Lesson {
  id: string;
  projectId: string;
  seq: number;
  slug: string;
  title: string;
  primarySource: PrimarySource;
  linkedTerms: string[];
  recap: string;
  html: string;
  version: number;
  createdAt: string;
}

export type LearningRecordStatus = 'pending' | 'taught' | 'reviewed';

export interface LearningRecord {
  id: string;
  projectId: string;
  seq: number;
  note: string;
  status: LearningRecordStatus;
  createdAt: string;
}

export interface ReferenceDocRow {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  summary: string;
  html?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  projectId: string;
  role: ChatRole;
  content: string;
  proposal?: Proposal;
  createdAt: string;
}

export const SETTINGS_KEY = 'app';

export type LlmProvider = 'claude';

export interface Settings {
  id: string;
  baseUrl: string;
  bearerToken: string;
  provider?: LlmProvider;
  theme?: 'light' | 'dark' | 'system';
}
