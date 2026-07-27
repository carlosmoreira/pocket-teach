import { TeachMetaSchema, type TeachMeta } from './teach-meta.js';

/** Result of attempting to pull the `#teach-meta` island out of a lesson's HTML. */
export type MetaIslandResult =
  | { ok: true; meta: TeachMeta }
  | { ok: false; error: string };

const ISLAND_RE =
  /<script[^>]*\bid=["']teach-meta["'][^>]*>([\s\S]*?)<\/script>/i;

/**
 * Extract and validate the `#teach-meta` JSON island from a lesson's HTML.
 *
 * Used by the gateway to verify writer output before streaming `done`, and
 * usable by the PWA to upsert Dexie rows. Returns a discriminated result rather
 * than throwing so callers can decide whether to trigger the one repair retry.
 */
export function extractTeachMeta(html: string): MetaIslandResult {
  const match = ISLAND_RE.exec(html);
  const rawJson = match?.[1];
  if (rawJson === undefined) {
    return { ok: false, error: 'no #teach-meta island found in HTML' };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    return { ok: false, error: 'invalid JSON inside #teach-meta island' };
  }

  const result = TeachMetaSchema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: `#teach-meta failed validation: ${result.error.message}`,
    };
  }
  return { ok: true, meta: result.data };
}
