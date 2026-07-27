import type { FastifyInstance } from 'fastify';
import type { BackupStore } from '../backup.js';

interface Deps {
  store: BackupStore;
}

/**
 * Backup blob store endpoints. `POST /backup` persists the posted workspace
 * blob; `GET /backup` returns the latest (or 404 if none yet).
 */
export function registerBackupRoutes(app: FastifyInstance, deps: Deps): void {
  app.post('/backup', async (req, reply) => {
    if (req.body === undefined || req.body === null) {
      reply.code(400).send({ error: 'missing backup blob' });
      return;
    }
    deps.store.save(req.body);
    reply.code(200).send({ status: 'ok' });
  });

  app.get('/backup', async (_req, reply) => {
    const blob = deps.store.load();
    if (blob === undefined) {
      reply.code(404).send({ error: 'no backup stored' });
      return;
    }
    reply.code(200).send(blob);
  });
}
