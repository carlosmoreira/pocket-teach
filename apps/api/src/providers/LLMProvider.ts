import type {
  ChatEvent,
  ChatMessage,
  LessonPlan,
  TeachMeta,
} from '@pocket-teach/api-types';

export interface ProviderCapabilities {
  webSearch: boolean;
  promptCache: boolean;
}

export interface PlanArgs {
  contextMarkdown: string;
  topic?: string;
  why?: string;
  successLooksLike?: string;
  constraints?: string;
  lessonHtml?: string;
  confusion?: string;
  onResearch?: () => void;
}

export interface WriteArgs {
  plan: LessonPlan;
  contextMarkdown?: string;
  previousLessonHtml?: string;
  confusion?: string;
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

  plan(args: PlanArgs): Promise<LessonPlan>;
  write(args: WriteArgs): Promise<WriteResult>;
  chat(args: ChatArgs): AsyncIterable<ChatEvent>;
}
