import { z } from 'zod';

/**
 * Teacher-chat islands — the same portable JSON-island trick as `#teach-meta`,
 * emitted mid-conversation and parsed app-side.
 */

/**
 * A `<proposal>` island: the teacher suggests creating a lesson. The app shows a
 * "Create this lesson?" card; on confirm the planner→writer runs.
 */
export const ProposalSchema = z.object({
  objective: z.string().min(1),
  rationale: z.string().min(1),
});
export type Proposal = z.infer<typeof ProposalSchema>;

/**
 * A `<record>` island: a learning-record note, emitted only when the learner
 * demonstrates understanding / reveals prior knowledge / corrects a
 * misconception. This is the ZPD memory (not quiz scoring).
 */
export const LearningRecordNoteSchema = z.object({
  note: z.string().min(1),
});
export type LearningRecordNote = z.infer<typeof LearningRecordNoteSchema>;
