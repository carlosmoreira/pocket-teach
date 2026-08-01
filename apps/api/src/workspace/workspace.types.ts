import type { LessonSummary, PrimarySource, ProjectSummary } from '@pocket-teach/api-types';

export type { LessonSummary, PrimarySource, ProjectSummary };

// What the Teacher hands over to persist a lesson (backend-only). The service
// owns numbering: `slug` is the kebab base (e.g. "borrowing") and becomes
// "0002-borrowing".
export interface LessonInput {
  slug: string;
  title: string;
  recap: string;
  primarySource: PrimarySource;
  linkedTerms?: string[];
  html: string;
}
