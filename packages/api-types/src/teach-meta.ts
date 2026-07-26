import { z } from 'zod';
import {
  GlossaryEntrySchema,
  PrimarySourceSchema,
  ResourceEntrySchema,
} from './common.js';

/**
 * The `#teach-meta` island embedded in every generated lesson as
 * `<script type="application/json" id="teach-meta">…</script>`.
 *
 * The gateway validates it; the PWA reads it to upsert Dexie rows. This is the
 * portable trick that makes model-switching an env change — any model can emit
 * "HTML with this one JSON island".
 */
export const TeachMetaSchema = z.object({
  title: z.string().min(1),
  slug: z.string().min(1),
  primarySource: PrimarySourceSchema,
  /** Glossary terms referenced by this lesson (drives cross-linking). */
  linkedTerms: z.array(z.string()),
  /** 1–2 sentence gist that feeds the cross-reference / lesson index. */
  recap: z.string().min(1),
  glossaryUpdates: z.array(GlossaryEntrySchema),
  resourceUpdates: z.array(ResourceEntrySchema),
});
export type TeachMeta = z.infer<typeof TeachMetaSchema>;
