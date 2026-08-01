import type { LessonSummary } from '../workspace/workspace.types';

export type GenerationPhase = 'planning' | 'researching' | 'writing' | 'done' | 'error';

// Streamed to the client over SSE while the Teacher authors a lesson.
export type GenerationEvent =
  | { type: 'phase'; phase: GenerationPhase }
  | { type: 'lesson'; lesson: LessonSummary }
  | { type: 'done' }
  | { type: 'error'; message: string };

export type EmitGeneration = (event: GenerationEvent) => void;
