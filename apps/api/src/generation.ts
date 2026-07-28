import type { LessonPlan, SseEvent, TeachMeta } from '@pocket-teach/api-types';
import type { LLMProvider, PlanArgs } from './providers/LLMProvider.js';
import type { SseStream } from './http/sse.js';

export interface GenerationResult {
  plan: LessonPlan;
  html: string;
  meta: TeachMeta;
}

function emitPhase(
  sse: SseStream,
  p: 'planning' | 'researching' | 'plan' | 'writing' | 'done' | 'error',
): void {
  sse.event('phase', { type: 'phase', phase: p } satisfies SseEvent);
}

export async function generateFresh(
  sse: SseStream,
  provider: LLMProvider,
  planArgs: PlanArgs,
): Promise<GenerationResult> {
  try {
    emitPhase(sse, 'planning');
    sse.comment('heartbeat');

    let researching = false;
    const plan = await provider.plan({
      ...planArgs,
      onResearch: () => {
        if (researching) return;
        researching = true;
        emitPhase(sse, 'researching');
        sse.comment('heartbeat');
      },
    });

    emitPhase(sse, 'plan');
    sse.event('plan', { type: 'plan', plan } satisfies SseEvent);

    emitPhase(sse, 'writing');
    sse.comment('heartbeat');
    const { html, meta } = await provider.write({
      plan,
      contextMarkdown: planArgs.contextMarkdown,
      previousLessonHtml: planArgs.lessonHtml,
      confusion: planArgs.confusion,
    });

    emitPhase(sse, 'done');
    sse.event('done', { type: 'done', html, meta } satisfies SseEvent);

    return { plan, html, meta };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    emitPhase(sse, 'error');
    sse.event('error', { type: 'error', message } satisfies SseEvent);
    throw err;
  }
}

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
