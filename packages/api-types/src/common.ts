import { z } from 'zod';

export const PrimarySourceSchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
});
export type PrimarySource = z.infer<typeof PrimarySourceSchema>;

export const GlossaryEntrySchema = z.object({
  term: z.string().min(1),
  definition: z.string().min(1),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const ResourceEntrySchema = z.object({
  title: z.string().min(1),
  url: z.string().url(),
  note: z.string().optional(),
});
export type ResourceEntry = z.infer<typeof ResourceEntrySchema>;

export const ReferenceDocSchema = z.object({
  slug: z.string().min(1),
  title: z.string().min(1),
  summary: z.string().min(1),
  html: z.string().optional(),
});
export type ReferenceDoc = z.infer<typeof ReferenceDocSchema>;
