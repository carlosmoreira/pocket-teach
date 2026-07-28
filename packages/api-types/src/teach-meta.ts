import { z } from 'zod';
import { GlossaryEntrySchema, PrimarySourceSchema, ResourceEntrySchema } from './common.js';

// The portable island that makes model-switching an env change — any model can
// emit "HTML with this one JSON island".
export const TeachMetaSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  primarySource: PrimarySourceSchema,
  linkedTerms: z.array(z.string()),
  recap: z.string().min(1),
  glossaryUpdates: z.array(GlossaryEntrySchema),
  resourceUpdates: z.array(ResourceEntrySchema),
});
export type TeachMeta = z.infer<typeof TeachMetaSchema>;
