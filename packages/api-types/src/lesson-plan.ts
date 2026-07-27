import { z } from 'zod';
import {
  GlossaryEntrySchema,
  PrimarySourceSchema,
  ReferenceDocSchema,
  ResourceEntrySchema,
} from './common.js';

export const LessonPlanSchema = z.object({
  objective: z.string().min(1),
  zpdNote: z.string().min(1),
  knowledgePoints: z.array(z.string().min(1)),
  primarySource: PrimarySourceSchema,
  quizConcept: z.string().min(1),
  glossaryIntroduced: z.array(GlossaryEntrySchema),
  glossaryUpdates: z.array(GlossaryEntrySchema),
  resourceUpdates: z.array(ResourceEntrySchema),
  referenceDoc: ReferenceDocSchema.optional(),
});
export type LessonPlan = z.infer<typeof LessonPlanSchema>;
