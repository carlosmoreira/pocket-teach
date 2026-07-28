import { z } from 'zod';
import { ReadLessonToolCallSchema, ReadLessonToolResultSchema } from './chat.js';

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

export const TextChatMessageSchema = z.object({
  type: z.literal('text'),
  role: ChatRoleSchema,
  content: z.string(),
});
export type TextChatMessage = z.infer<typeof TextChatMessageSchema>;

export const ReadLessonCallChatMessageSchema = z.object({
  type: z.literal('tool_call'),
  call: ReadLessonToolCallSchema,
});
export type ReadLessonCallChatMessage = z.infer<typeof ReadLessonCallChatMessageSchema>;

export const ReadLessonResultChatMessageSchema = z.object({
  type: z.literal('tool_result'),
  result: ReadLessonToolResultSchema,
});
export type ReadLessonResultChatMessage = z.infer<typeof ReadLessonResultChatMessageSchema>;

export const ChatMessageSchema = z.discriminatedUnion('type', [
  TextChatMessageSchema,
  ReadLessonCallChatMessageSchema,
  ReadLessonResultChatMessageSchema,
]);
export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const ChatRequestSchema = z.object({
  contextMarkdown: z.string().min(1),
  history: z.array(ChatMessageSchema),
});
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
