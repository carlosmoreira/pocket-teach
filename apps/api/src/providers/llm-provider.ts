import type { LanguageModel, ToolSet } from 'ai';

// The seam the Teacher's agentic loop runs on. A Provider hands over a model to
// drive the loop and the native web tools it can ground with; a Provider without
// native search returns an empty tool set and grounding falls to the Search
// provider seam. Swappable (Claude today, a local model later) by configuration.
export interface LlmProvider {
  readonly id: string;
  readonly capabilities: { webSearch: boolean };
  languageModel(): LanguageModel;
  webTools(): ToolSet;
  describeError(err: unknown): string;
}

export const LLM_PROVIDER = Symbol('LLM_PROVIDER');
