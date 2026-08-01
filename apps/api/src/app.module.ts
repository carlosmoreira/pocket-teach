import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AppConfigModule } from './config/config.module';
import { AuthGuard } from './auth/auth.guard';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { SearchModule } from './search/search.module';

@Module({
  imports: [AppConfigModule, ProvidersModule, SearchModule, HealthModule],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
