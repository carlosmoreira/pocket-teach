import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from './env.schema';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get port(): number {
    return this.config.get('PORT', { infer: true });
  }

  get gatewayToken(): string {
    return this.config.get('GATEWAY_TOKEN', { infer: true });
  }

  get provider(): string {
    return this.config.get('PROVIDER', { infer: true });
  }

  get model(): string {
    return this.config.get('MODEL', { infer: true });
  }

  get anthropicApiKey(): string | undefined {
    return this.config.get('ANTHROPIC_API_KEY', { infer: true });
  }

  get workspaceRoot(): string {
    return this.config.get('WORKSPACE_ROOT', { infer: true });
  }
}
