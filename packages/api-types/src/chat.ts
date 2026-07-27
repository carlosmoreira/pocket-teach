import { z } from 'zod';
import { ProposalSchema, LearningRecordNoteSchema } from './islands.js';

/**
 * Chat tool types + the streamed chat-event union.
 *
 * The teacher can call `read_lesson(slug)`; the **app** executes it against
 * Dexie and re-invokes `/chat` (a stateless, app-side tool loop). The gateway
 * never touches the filesystem.
 */

/** The model asks the app to read a lesson body. */
export const ReadLessonToolCallSchema = z.object({
  tool: z.literal('read_lesson'),
  slug: z.string().min(1),
});
export type ReadLessonToolCall = z.infer<typeof ReadLessonToolCallSchema>;

/** The app's answer: the lesson body from Dexie. */
export const ReadLessonToolResultSchema = z.object({
  tool: z.literal('read_lesson'),
  slug: z.string().min(1),
  html: z.string(),
});
export type ReadLessonToolResult = z.infer<typeof ReadLessonToolResultSchema>;

/** Streamed teacher-chat events. */
export const ChatEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), delta: z.string() }),
  z.object({ type: z.literal('tool_call'), call: ReadLessonToolCallSchema }),
  z.object({ type: z.literal('proposal'), proposal: ProposalSchema }),
  z.object({ type: z.literal('record'), record: LearningRecordNoteSchema }),
  z.object({ type: z.literal('done') }),
  z.object({ type: z.literal('error'), message: z.string() }),
]);
export type ChatEvent = z.infer<typeof ChatEventSchema>;
