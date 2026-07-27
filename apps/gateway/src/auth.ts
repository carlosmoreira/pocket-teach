import type { FastifyReply, FastifyRequest } from 'fastify';

export function makeAuthHook(token: string) {
  const expected = `Bearer ${token}`;

  return async function authHook(
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (req.method === 'OPTIONS') return;

    const path = req.url.split('?')[0] ?? req.url;
    if (path === '/health') return;

    const header = req.headers.authorization;
    if (header !== expected) {
      await reply.code(401).send({ error: 'unauthorized' });
    }
  };
}
