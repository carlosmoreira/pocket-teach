import { z } from 'zod';

export const ProposalKindSchema = z.enum(['new_lesson', 'amplify']);
export type ProposalKind = z.infer<typeof ProposalKindSchema>;

export const ProposalSchema = z
  .object({
    kind: ProposalKindSchema,
    objective: z.string().min(1),
    rationale: z.string().min(1),
    targetSlug: z.string().min(1).optional(),
    focus: z.string().min(1).optional(),
    confirmed: z.boolean().optional(),
  })
  .superRefine((proposal, ctx) => {
    if (proposal.kind !== 'amplify') return;
    if (!proposal.targetSlug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetSlug'],
        message: 'amplify proposal requires targetSlug',
      });
    }
    if (!proposal.focus) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['focus'],
        message: 'amplify proposal requires focus',
      });
    }
  });
export type Proposal = z.infer<typeof ProposalSchema>;

export const LearningRecordNoteSchema = z.object({
  note: z.string().min(1),
});
export type LearningRecordNote = z.infer<typeof LearningRecordNoteSchema>;
