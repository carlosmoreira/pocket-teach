import { Global, Module } from '@nestjs/common';
import { AppConfigService } from '../config/config.service';
import { ClaudeProvider } from './claude.provider';
import { LLM_PROVIDER, type LlmProvider } from './llm-provider';

// The active Provider, selected by config. Global so any domain module can
// inject LLM_PROVIDER without re-importing.
@Global()
@Module({
  providers: [
    ClaudeProvider,
    {
      provide: LLM_PROVIDER,
      useFactory: (config: AppConfigService, claude: ClaudeProvider): LlmProvider => {
        switch (config.provider) {
          case 'claude':
            return claude;
          default:
            throw new Error(`unsupported PROVIDER: ${config.provider}`);
        }
      },
      inject: [AppConfigService, ClaudeProvider],
    },
  ],
  exports: [LLM_PROVIDER],
})
export class ProvidersModule {}
