import { z } from 'zod';

/**
 * Request bodies for the gateway endpoints. The `requestId` on the generation
 * bodies is the idempotency key — retrying the same id returns the cached
 * finished result rather than re-billing a generation.
 */

/** `POST /generate/project` — mission interview result → mission + lesson 1. */
export const GenerateProjectRequestSchema = z.object({
  topic: z.string().min(1),
  why: z.string().optional(),
  successLooksLike: z.string().optional(),
  constraints: z.string().optional(),
  requestId: z.string().min(1),
});
export type GenerateProjectRequest = z.infer<typeof GenerateProjectRequestSchema>;

/** `POST /generate/lesson` — the compact workspace markdown → the next lesson. */
export const GenerateLessonRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  requestId: z.string().min(1),
});
export type GenerateLessonRequest = z.infer<typeof GenerateLessonRequestSchema>;

/** `POST /generate/amplify` — clarify-in-place: same objective + slug, gentler. */
export const GenerateAmplifyRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  lessonHtml: z.string().min(1),
  confusion: z.string().min(1),
  requestId: z.string().min(1),
});
export type GenerateAmplifyRequest = z.infer<typeof GenerateAmplifyRequestSchema>;

/** Roles the teacher chat transcript uses. */
export const ChatRoleSchema = z.enum(['user', 'assistant']);
export type ChatRole = z.infer<typeof ChatRoleSchema>;

/** A single chat turn (the app stores + replays the transcript; gateway is stateless). */
export const ChatMessageSchema = z.object({
  role: ChatRoleSchema,
  content: z.string(),
});
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

/** `POST /chat` — the teacher chat. */
export const ChatRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  history: z.array(ChatMessageSchema),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
