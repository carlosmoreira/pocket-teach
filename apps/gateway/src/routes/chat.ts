import type { FastifyInstance } from 'fastify';
import { ChatRequestSchema, type ChatEvent } from '@pocket-teach/api-types';
import type { LLMProvider } from '../providers/LLMProvider.js';
import { startSse } from '../http/sse.js';

interface Deps {
  provider: LLMProvider;
}

export function registerChatRoutes(app: FastifyInstance, deps: Deps): void {
  app.post('/chat', async (req, reply) => {
    const parsed = ChatRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      reply
        .code(400)
        .send({ error: 'invalid request body', issues: parsed.error.issues });
      return;
    }

    const sse = startSse(reply);
    try {
      // TODO(chunk-2): drive the read_lesson tool loop here — when the provider
      // yields a { type: 'tool_call', call: { tool: 'read_lesson', slug } }, the
      // APP answers from Dexie and re-invokes /chat. The gateway stays stateless.
      for await (const event of deps.provider.chat(parsed.data)) {
        sse.event(event.type, event satisfies ChatEvent);
        if (sse.closed) break;
      }
    } catch (err) {
      app.log.error({ err }, 'chat failed');
      sse.event('error', {
        type: 'error',
        message: 'chat failed',
      } satisfies ChatEvent);
    } finally {
      sse.end();
    }
  });
}
