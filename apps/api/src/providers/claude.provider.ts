import { Injectable } from '@nestjs/common';
import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModel, ToolSet } from 'ai';
import { AppConfigService } from '../config/config.service';
import type { LlmProvider } from './llm-provider';
import { providerErrorMessage } from './provider-error';

const WEB_SEARCH_MAX_USES = 6;
const WEB_FETCH_MAX_USES = 5;

const MISSING_KEY_ERROR =
  'ANTHROPIC_API_KEY is not set. The backend starts without it, but generation and chat need a real key — set ANTHROPIC_API_KEY in the environment.';

@Injectable()
export class ClaudeProvider implements LlmProvider {
  readonly id = 'claude';
  readonly capabilities = { webSearch: true };

  private readonly modelId: string;
  private readonly anthropic?: ReturnType<typeof createAnthropic>;

  constructor(config: AppConfigService) {
    this.modelId = config.model;
    const apiKey = config.anthropicApiKey;
    this.anthropic = apiKey ? createAnthropic({ apiKey }) : undefined;
  }

  languageModel(): LanguageModel {
    return this.client()(this.modelId);
  }

  webTools(): ToolSet {
    const anthropic = this.client();
    return {
      webSearch: anthropic.tools.webSearch_20260209({ maxUses: WEB_SEARCH_MAX_USES }),
      webFetch: anthropic.tools.webFetch_20260209({ maxUses: WEB_FETCH_MAX_USES }),
    };
  }

  describeError(err: unknown): string {
    return providerErrorMessage(err);
  }

  private client(): ReturnType<typeof createAnthropic> {
    if (!this.anthropic) throw new Error(MISSING_KEY_ERROR);
    return this.anthropic;
  }
}
