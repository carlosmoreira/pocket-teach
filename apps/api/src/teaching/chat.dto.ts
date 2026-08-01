import { z } from 'zod';

// A chat turn against a project. An absent message on an empty transcript is the
// onboarding opener: the Teacher speaks first.
export const ChatRequestSchema = z.object({
  projectId: z.string().min(1),
  message: z.string().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
