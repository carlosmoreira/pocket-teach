import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadConfig, type Config } from './config.js';
import { makeAuthHook } from './auth.js';
import { IdempotencyCache } from './idempotency.js';
import { FileBackupStore } from './backup.js';
import { ClaudeProvider } from './providers/claude.js';
import { NoopSearchProvider } from './search/SearchProvider.js';
import type { LLMProvider } from './providers/LLMProvider.js';
import { registerGenerateRoutes } from './routes/generate.js';
import { registerChatRoutes } from './routes/chat.js';
import { registerBackupRoutes } from './routes/backup.js';

function selectProvider(config: Config): LLMProvider {
  switch (config.PROVIDER) {
    case 'claude':
      return new ClaudeProvider({
        apiKey: config.ANTHROPIC_API_KEY,
        models: { planner: config.PLANNER_MODEL, writer: config.WRITER_MODEL },
      });
    // TODO(chunk-2+): drop in GPT/Ollama providers behind the same seam.
    default:
      throw new Error(`unsupported PROVIDER: ${config.PROVIDER}`);
  }
}

export async function buildServer(config: Config) {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
    },
    // Trust proxy so client IPs/log fields are sane behind Tailscale/nginx.
    trustProxy: true,
  });

  await app.register(cors, { origin: true });

  app.addHook('onRequest', makeAuthHook(config.GATEWAY_TOKEN));

  const provider = selectProvider(config);
  const search = new NoopSearchProvider();
  void search; // wired into the provider in chunk 2 (grounding axis).
  const cache = new IdempotencyCache();
  const backupStore = new FileBackupStore();

  app.get('/health', async () => ({ status: 'ok' }));

  registerGenerateRoutes(app, { provider, cache });
  registerChatRoutes(app, { provider });
  registerBackupRoutes(app, { store: backupStore });

  return app;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.GATEWAY_TOKEN === 'dev-token') {
    // eslint-disable-next-line no-console
    console.warn(
      '[pocket-teach] GATEWAY_TOKEN is the default "dev-token" — set a real token for anything but local dev.',
    );
  }

  const app = await buildServer(config);

  const close = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void close('SIGINT'));
  process.on('SIGTERM', () => void close('SIGTERM'));

  try {
    await app.listen({ port: config.PORT, host: '0.0.0.0' });
    app.log.info(
      {
        provider: config.PROVIDER,
        plannerModel: config.PLANNER_MODEL,
        writerModel: config.WRITER_MODEL,
      },
      'pocket-teach gateway listening',
    );
  } catch (err) {
    app.log.error(err, 'failed to start');
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
