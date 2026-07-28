import type { FastifyReply } from 'fastify';

// Hijack the reply so Fastify won't serialize a response. Every write is guarded
// so a client disconnect — after which Node keeps the handler running — can't
// crash the process.
export interface SseStream {
  event(name: string, data: unknown): void;
  comment(text: string): void;
  end(): void;
  readonly closed: boolean;
}

export function startSse(reply: FastifyReply): SseStream {
  reply.hijack();
  const raw = reply.raw;

  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Disable proxy buffering (nginx) so frames flush immediately.
    'X-Accel-Buffering': 'no',
  });

  const safeWrite = (chunk: string): void => {
    if (raw.writableEnded || raw.destroyed) return;
    try {
      raw.write(chunk);
    } catch {
      /* client gone — ignore */
    }
  };

  return {
    event(name: string, data: unknown): void {
      safeWrite(`event: ${name}\n`);
      safeWrite(`data: ${JSON.stringify(data)}\n\n`);
    },
    comment(text: string): void {
      safeWrite(`: ${text}\n\n`);
    },
    end(): void {
      if (raw.writableEnded || raw.destroyed) return;
      try {
        raw.end();
      } catch {
        /* ignore */
      }
    },
    get closed(): boolean {
      return raw.writableEnded || raw.destroyed;
    },
  };
}
