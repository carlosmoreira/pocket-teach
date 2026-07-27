import type { LessonPlan, SseEvent, TeachMeta } from '@pocket-teach/api-types';
import { extractTeachMeta } from '@pocket-teach/api-types';
import type { LLMProvider, PlanArgs } from './providers/LLMProvider.js';
import type { SseStream } from './http/sse.js';

/** The unit cached by the idempotency layer — the finished generation. */
export interface GenerationResult {
  plan: LessonPlan;
  html: string;
  meta: TeachMeta;
}

const STEP_DELAY_MS = 120;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function emitPhase(
  sse: SseStream,
  p:
    | 'planning'
    | 'researching'
    | 'plan'
    | 'writing'
    | 'done'
    | 'error',
): void {
  const event: SseEvent = { type: 'phase', phase: p };
  sse.event('phase', event);
}

/**
 * Run a fresh generation, streaming the canonical phase sequence
 * `planning → researching → plan → writing → done` with heartbeats, and return
 * the finished result so the idempotency layer can cache it.
 *
 * TODO(chunk-2): the `plan`/`write` calls below already go through the provider
 * seam — chunk 2 only has to make the provider real (AI SDK + web_search).
 */
export async function generateFresh(
  sse: SseStream,
  provider: LLMProvider,
  planArgs: PlanArgs,
): Promise<GenerationResult> {
  emitPhase(sse, 'planning');
  sse.comment('heartbeat');
  await delay(STEP_DELAY_MS);

  // TODO(chunk-2): call planner (grounded) — currently a canned LessonPlan.
  const plan = await provider.plan(planArgs);

  emitPhase(sse, 'researching');
  sse.comment('heartbeat');
  await delay(STEP_DELAY_MS);

  emitPhase(sse, 'plan');
  sse.event('plan', { type: 'plan', plan } satisfies SseEvent);
  await delay(STEP_DELAY_MS);

  emitPhase(sse, 'writing');
  sse.comment('heartbeat');
  // TODO(chunk-2): call writer (streamText) — currently canned HTML + island.
  const { html, meta } = await provider.write({
    plan,
    contextMarkdown: planArgs.contextMarkdown,
  });

  // Validate the island the same way the real gateway will (defence in depth).
  const check = extractTeachMeta(html);
  if (!check.ok) {
    // TODO(chunk-2): one repair retry before surfacing an error.
    emitPhase(sse, 'error');
    sse.event('error', {
      type: 'error',
      message: `writer output invalid: ${check.error}`,
    } satisfies SseEvent);
    throw new Error(`writer output invalid: ${check.error}`);
  }

  await delay(STEP_DELAY_MS);
  emitPhase(sse, 'done');
  sse.event('done', { type: 'done', html, meta } satisfies SseEvent);

  return { plan, html, meta };
}

/**
 * Replay a cached result for a repeated `requestId` (the dropped-generation
 * retry path) — no model calls, no re-billing.
 */
export function replayResult(sse: SseStream, result: GenerationResult): void {
  emitPhase(sse, 'plan');
  sse.event('plan', { type: 'plan', plan: result.plan } satisfies SseEvent);
  emitPhase(sse, 'done');
  sse.event('done', {
    type: 'done',
    html: result.html,
    meta: result.meta,
  } satisfies SseEvent);
}
