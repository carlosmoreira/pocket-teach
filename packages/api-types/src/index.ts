// The shared wire contract between the backend and the frontend. Pure types —
// the single source of truth for the shapes that cross the network, so the two
// ends can't drift.

export interface PrimarySource {
  title: string;
  url: string;
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

export interface ProjectDetail {
  id: string;
  mission: string;
  roadmap: string;
  lessons: LessonSummary[];
}

export type ProposalKind = 'new_lesson' | 'amplify';

export interface Proposal {
  kind: ProposalKind;
  objective: string;
  rationale: string;
  targetSlug?: string;
  focus?: string;
  confirmed?: boolean;
}

export interface CreatedLessonRef {
  slug: string;
  title: string;
}

export interface StoredMessage {
  role: 'user' | 'assistant';
  content: string;
  proposal?: Proposal;
  // Set on the assistant turn that announces a finished lesson, so the "lesson
  // ready" card survives a reload.
  lesson?: CreatedLessonRef;
  at: string;
}

export type GenerationPhase = 'planning' | 'researching' | 'writing' | 'done' | 'error';

// A single step the Teacher took while building the lesson, surfaced live so the
// wait is a legible activity feed rather than an opaque spinner. `search` carries
// the query; `read` carries the source it opened.
export type GenerationActivityKind = 'search' | 'read';

export type GenerationEvent =
  | { type: 'phase'; phase: GenerationPhase }
  | { type: 'activity'; kind: GenerationActivityKind; detail: string }
  | { type: 'progress'; chars: number }
  | { type: 'lesson'; lesson: LessonSummary }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type ChatEvent =
  | { type: 'message'; delta: string }
  | { type: 'proposal'; proposal: Proposal }
  | { type: 'record'; note: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
