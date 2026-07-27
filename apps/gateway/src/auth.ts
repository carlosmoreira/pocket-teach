import type { FastifyReply, FastifyRequest } from 'fastify';

/**
 * Bearer-token auth. A single static token guards every route — the network
 * (intranet + Tailscale/WireGuard) is the real boundary, this just stops stray
 * calls. `/health` and CORS preflight (OPTIONS) are exempt.
 */
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
