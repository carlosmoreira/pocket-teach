import { z } from 'zod';
import {
  GlossaryEntrySchema,
  PrimarySourceSchema,
  ReferenceDocSchema,
  ResourceEntrySchema,
} from './common.js';

/**
 * The structured output of the **planner** stage (Sonnet 5 + web-search grounding).
 * The writer stage consumes this to produce the self-contained lesson HTML.
 */
export const LessonPlanSchema = z.object({
  /** The single, concrete thing this lesson teaches. */
  objective: z.string().min(1),
  /** Where this sits in the learner's Zone of Proximal Development (from records). */
  zpdNote: z.string().min(1),
  /** The knowledge points to establish before the skill-drill. */
  knowledgePoints: z.array(z.string().min(1)),
  /** The one high-trust source the lesson is grounded in. */
  primarySource: PrimarySourceSchema,
  /** The concept the inline quiz should probe. */
  quizConcept: z.string().min(1),
  /** New glossary terms this lesson introduces. */
  glossaryIntroduced: z.array(GlossaryEntrySchema),
  /** Edits/refinements to existing glossary terms. */
  glossaryUpdates: z.array(GlossaryEntrySchema),
  /** New or updated curated resources. */
  resourceUpdates: z.array(ResourceEntrySchema),
  /** Optional companion reference doc to generate alongside the lesson. */
  referenceDoc: ReferenceDocSchema.optional(),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
