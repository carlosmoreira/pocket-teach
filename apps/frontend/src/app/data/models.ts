// The backend owns the workspace; the device keeps an offline replica of the
// project index and lessons (so lessons read without the backend).

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
  readAt?: string; // set the first time the lesson is opened on this device
  cachedAt: string;
}
