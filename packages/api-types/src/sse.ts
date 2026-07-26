import { z } from 'zod';
import { LessonPlanSchema } from './lesson-plan.js';
import { TeachMetaSchema } from './teach-meta.js';

/**
 * SSE phases the generation endpoints stream, in order:
 * `planning → researching → plan → writing → done` (or `error`).
 */
export const PhaseSchema = z.enum([
  'planning',
  'researching',
  'plan',
  'writing',
  'done',
  'error',
]);
export type Phase = z.infer<typeof PhaseSchema>;

export const PhaseEventSchema = z.object({
  type: z.literal('phase'),
  phase: PhaseSchema,
});
export type PhaseEvent = z.infer<typeof PhaseEventSchema>;

export const PlanEventSchema = z.object({
  type: z.literal('plan'),
  plan: LessonPlanSchema,
});
export type PlanEvent = z.infer<typeof PlanEventSchema>;

export const DoneEventSchema = z.object({
  type: z.literal('done'),
  html: z.string(),
  meta: TeachMetaSchema,
});
export type DoneEvent = z.infer<typeof DoneEventSchema>;

export const ErrorEventSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
});
export type ErrorEvent = z.infer<typeof ErrorEventSchema>;

/** The full generation SSE event union. */
export const SseEventSchema = z.discriminatedUnion('type', [
  PhaseEventSchema,
  PlanEventSchema,
  DoneEventSchema,
  ErrorEventSchema,
]);
export type SseEvent = z.infer<typeof SseEventSchema>;
