import { z } from 'zod';

/**
 * Shared leaf schemas reused across LessonPlan, TeachMeta and the islands.
 * Keeping them in one place is what stops the wire contract from drifting
 * between the gateway and the PWA.
 */

/** A single citeable source. The `/teach` methodology grounds each lesson in one. */
export const PrimarySourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});
export type PrimarySource = z.infer<typeof PrimarySourceSchema>;

/** A glossary term + its definition. */
export const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

/** A curated resource link (RESOURCES.md row). */
export const ResourceEntrySchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
});
export type ResourceEntry = z.infer<typeof ResourceEntrySchema>;

/** A revisit-surface reference document (the skill's `./reference/*.html`). */
export const ReferenceDocSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  html: z.string().optional(),
});
export type ReferenceDoc = z.infer<typeof ReferenceDocSchema>;
