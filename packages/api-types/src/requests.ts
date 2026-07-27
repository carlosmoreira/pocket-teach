import { z } from 'zod';

// requestId is the idempotency key — retrying the same id returns the cached
// result rather than re-billing a generation.
export const GenerateProjectRequestSchema = z.object({
  topic: z.string().min(1),
  why: z.string().optional(),
  successLooksLike: z.string().optional(),
  constraints: z.string().optional(),
  requestId: z.string().min(1),
});
export type GenerateProjectRequest = z.infer<typeof GenerateProjectRequestSchema>;

export const GenerateLessonRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  requestId: z.string().min(1),
});
export type GenerateLessonRequest = z.infer<typeof GenerateLessonRequestSchema>;

export const GenerateAmplifyRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  lessonHtml: z.string().min(1),
  confusion: z.string().min(1),
  requestId: z.string().min(1),
});
export type GenerateAmplifyRequest = z.infer<typeof GenerateAmplifyRequestSchema>;

export const ChatRoleSchema = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

// The app stores + replays the transcript; the gateway is stateless.
export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  history: z.array(ChatMessageSchema),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
