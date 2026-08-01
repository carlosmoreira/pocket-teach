export interface PrimarySource {
  title: string;
  url: string;
}

// What the Teacher hands over to persist a lesson. The service owns numbering:
// `slug` is the kebab base (e.g. "borrowing") and becomes "0002-borrowing".
export interface LessonInput {
  slug: string;
  title: string;
  recap: string;
  primarySource: PrimarySource;
  linkedTerms?: string[];
  html: string;
}

export interface LessonSummary {
  seq: number;
  slug: string;
  title: string;
  recap: string;
  primarySource: PrimarySource;
  linkedTerms: string[];
  file: string;
  createdAt: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  lessonCount: number;
  createdAt: string;
  updatedAt: string;
}
