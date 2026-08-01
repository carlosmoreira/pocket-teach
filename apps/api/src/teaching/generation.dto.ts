import { z } from 'zod';

// A generation request targets a project's Workspace. With no objective the
// Teacher picks the next lesson; with one, it builds exactly that (a confirmed
// proposal). requestId is reserved for future idempotent retry.
export const GenerateLessonRequestSchema = z.object({
  projectId: z.string().min(1),
  objective: z.string().optional(),
  focus: z.string().optional(),
  requestId: z.string().optional(),
});

export type GenerateLessonRequest = z.infer<typeof GenerateLessonRequestSchema>;
