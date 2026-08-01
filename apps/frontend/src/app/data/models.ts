// The backend owns the workspace; the device keeps an offline replica of the
// project index and lessons (so lessons read without the backend) plus settings.

export interface CachedProject {
  id: string;
  title: string;
  lessonCount: number;
  updatedAt: string;
}

export interface CachedLesson {
  key: string; // `${projectId}/${slug}`
  projectId: string;
  slug: string;
  seq: number;
  title: string;
  recap: string;
  html?: string; // filled once the lesson has been opened/generated on this device
  cachedAt: string;
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
