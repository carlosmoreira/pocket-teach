import { z } from 'zod';

export const ProposalSchema = z.object({
  objective: z.string().min(1),
  rationale: z.string().min(1),
});
export type Proposal = z.infer<typeof ProposalSchema>;

// The ZPD memory (not quiz scoring): emitted only when the learner demonstrates
// understanding, reveals prior knowledge, or corrects a misconception.
export const LearningRecordNoteSchema = z.object({
  note: z.string().min(1),
});
export type LearningRecordNote = z.infer<typeof LearningRecordNoteSchema>;
