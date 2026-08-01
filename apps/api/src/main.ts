import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { AppConfigService } from './config/config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
  );

  // Reflect any origin: the private network is the trust boundary, not CORS.
  app.enableCors({ origin: true });

  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  await app.listen(config.port, '0.0.0.0');
  logger.log(`Backend listening on :${config.port} (provider=${config.provider})`);
}

void bootstrap();
