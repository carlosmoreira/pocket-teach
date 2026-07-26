import type { FastifyInstance, FastifyReply } from 'fastify';
import type { ZodError } from 'zod';
import {
  GenerateAmplifyRequestSchema,
  GenerateLessonRequestSchema,
  GenerateProjectRequestSchema,
} from '@pocket-teach/api-types';
import type { LLMProvider, PlanArgs } from '../providers/LLMProvider.js';
import type { IdempotencyCache } from '../idempotency.js';
import { startSse } from '../http/sse.js';
import {
  generateFresh,
  replayResult,
  type GenerationResult,
} from '../generation.js';

interface Deps {
  provider: LLMProvider;
  cache: IdempotencyCache;
}

function badRequest(reply: FastifyReply, error: ZodError): void {
  reply.code(400).send({ error: 'invalid request body', issues: error.issues });
}

/**
 * Shared SSE generation handler: withIdempotency(requestId) → stream phases
 * (fresh) or replay (cached final result). The body is validated by each route
 * before this runs.
 */
async function handleGeneration(
  app: FastifyInstance,
  deps: Deps,
  reply: FastifyReply,
  requestId: string,
  planArgs: PlanArgs,
): Promise<void> {
  const sse = startSse(reply);
  try {
    const { cached, value } =
      await deps.cache.withIdempotency<GenerationResult>(requestId, () =>
        generateFresh(sse, deps.provider, planArgs),
      );
    if (cached) {
      app.log.info({ requestId }, 'idempotent replay (cache hit)');
      replayResult(sse, value);
    }
  } catch (err) {
    app.log.error({ err, requestId }, 'generation failed');
    // generateFresh emits an `error` SSE event before throwing where it can.
  } finally {
    sse.end();
  }
}

export function registerGenerateRoutes(app: FastifyInstance, deps: Deps): void {
  app.post('/generate/project', async (req, reply) => {
    const parsed = GenerateProjectRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const b = parsed.data;
    await handleGeneration(app, deps, reply, b.requestId, {
      contextMarkdown: '',
      topic: b.topic,
      why: b.why,
      successLooksLike: b.successLooksLike,
      constraints: b.constraints,
    });
  });

  app.post('/generate/lesson', async (req, reply) => {
    const parsed = GenerateLessonRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const b = parsed.data;
    await handleGeneration(app, deps, reply, b.requestId, {
      contextMarkdown: b.contextMarkdown,
    });
  });

  app.post('/generate/amplify', async (req, reply) => {
    const parsed = GenerateAmplifyRequestSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(reply, parsed.error);
    const b = parsed.data;
    await handleGeneration(app, deps, reply, b.requestId, {
      contextMarkdown: b.contextMarkdown,
      lessonHtml: b.lessonHtml,
      confusion: b.confusion,
    });
  });
}
