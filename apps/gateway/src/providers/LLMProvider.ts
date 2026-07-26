import type {
  ChatEvent,
  ChatMessage,
  LessonPlan,
  TeachMeta,
} from '@pocket-teach/api-types';

/**
 * The provider seam. A thin `plan`/`write`/`chat` wrapper (in chunk 2, over the
 * Vercel AI SDK). v1 implements only Claude; GPT/Ollama drop in later behind
 * this same interface, so model-switching is an env change and the PWA never
 * changes.
 */

export interface ProviderCapabilities {
  /** Provider can ground generation with a native web search. */
  webSearch: boolean;
  /** Provider supports prompt caching on the stable system/context prefix. */
  promptCache: boolean;
}

/** Inputs to a planner call. The gateway builds these from the request body. */
export interface PlanArgs {
  /** The compact workspace markdown (mission/glossary/resources/records/index). */
  contextMarkdown: string;
  /** New-project interview fields (only for /generate/project). */
  topic?: string;
  why?: string;
  successLooksLike?: string;
  constraints?: string;
  /** Amplify inputs (only for /generate/amplify). */
  lessonHtml?: string;
  confusion?: string;
}

export interface WriteArgs {
  plan: LessonPlan;
  contextMarkdown?: string;
}

export interface WriteResult {
  html: string;
  meta: TeachMeta;
}

export interface ChatArgs {
  contextMarkdown: string;
  history: ChatMessage[];
}

export interface LLMProvider {
  readonly id: string;
  readonly capabilities: ProviderCapabilities;

  /** Compact context (+ grounding) → a structured LessonPlan. */
  plan(args: PlanArgs): Promise<LessonPlan>;

  /** LessonPlan + style contract → self-contained HTML + #teach-meta. */
  write(args: WriteArgs): Promise<WriteResult>;

  /** Teacher chat → a stream of chat events (text, tool calls, islands). */
  chat(args: ChatArgs): AsyncIterable<ChatEvent>;
}
