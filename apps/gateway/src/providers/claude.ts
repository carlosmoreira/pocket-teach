import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, streamText } from 'ai';
import type { ChatEvent, LessonPlan } from '@pocket-teach/api-types';
import { LessonPlanSchema, extractTeachMeta } from '@pocket-teach/api-types';
import {
  CHAT_PROMPT,
  PLANNER_PROMPT,
  SYSTEM_PREAMBLE,
  WRITER_PROMPT,
} from '../prompts/teach.js';
import type {
  ChatArgs,
  LLMProvider,
  PlanArgs,
  ProviderCapabilities,
  WriteArgs,
  WriteResult,
} from './LLMProvider.js';

const DEFAULT_MODELS = {
  planner: 'claude-sonnet-5',
  writer: 'claude-sonnet-5',
} as const;

const PLAN_MAX_TOKENS = 4096;
const WRITER_MAX_TOKENS = 16000;
const CHAT_MAX_TOKENS = 4096;

const MISSING_KEY_ERROR =
  'ANTHROPIC_API_KEY is not set. The gateway starts without it, but generation and chat need a real key — set ANTHROPIC_API_KEY in the gateway environment.';

const REPAIR_NUDGE =
  'Your previous response was missing a valid #teach-meta island. Return valid, self-contained HTML containing the #teach-meta JSON island.';

export interface ClaudeProviderOptions {
  apiKey?: string;
  models?: { planner: string; writer: string };
}

export class ClaudeProvider implements LLMProvider {
  readonly id = 'claude';
  readonly capabilities: ProviderCapabilities = {
    webSearch: false,
    promptCache: false,
  };

  private readonly models: { planner: string; writer: string };
  private readonly anthropic?: ReturnType<typeof createAnthropic>;

  constructor(options: ClaudeProviderOptions = {}) {
    this.models = options.models ?? { ...DEFAULT_MODELS };
    this.anthropic = options.apiKey
      ? createAnthropic({ apiKey: options.apiKey })
      : undefined;
  }

  private provider(): ReturnType<typeof createAnthropic> {
    if (!this.anthropic) throw new Error(MISSING_KEY_ERROR);
    return this.anthropic;
  }

  async plan(args: PlanArgs): Promise<LessonPlan> {
    const { object } = await generateObject({
      model: this.provider()(this.models.planner),
      schema: LessonPlanSchema,
      system: SYSTEM_PREAMBLE,
      prompt: plannerPrompt(args),
      maxOutputTokens: PLAN_MAX_TOKENS,
    });
    return object;
  }

  async write(args: WriteArgs): Promise<WriteResult> {
    const model = this.provider()(this.models.writer);
    const basePrompt = writerPrompt(args);

    let html = await streamText({
      model,
      system: SYSTEM_PREAMBLE,
      prompt: basePrompt,
      maxOutputTokens: WRITER_MAX_TOKENS,
    }).text;
    let check = extractTeachMeta(html);

    if (!check.ok) {
      html = await streamText({
        model,
        system: SYSTEM_PREAMBLE,
        prompt: `${basePrompt}\n\n${REPAIR_NUDGE}\nValidation error: ${check.error}`,
        maxOutputTokens: WRITER_MAX_TOKENS,
      }).text;
      check = extractTeachMeta(html);
    }

    if (!check.ok) {
      throw new Error(
        `writer produced no valid #teach-meta island after one repair retry: ${check.error}`,
      );
    }

    return { html, meta: check.meta };
  }

  async *chat(args: ChatArgs): AsyncIterable<ChatEvent> {
    const result = streamText({
      model: this.provider()(this.models.planner),
      system: [SYSTEM_PREAMBLE, CHAT_PROMPT, args.contextMarkdown].join('\n\n'),
      messages: args.history.map((m) =>
        m.role === 'user'
          ? { role: 'user' as const, content: m.content }
          : { role: 'assistant' as const, content: m.content },
      ),
      maxOutputTokens: CHAT_MAX_TOKENS,
    });

    for await (const delta of result.textStream) {
      yield { type: 'message', delta };
    }
    // TODO(chunk-2): read_lesson tool loop + <proposal>/<record> islands.
    yield { type: 'done' };
  }
}

function plannerPrompt(args: PlanArgs): string {
  const parts = [PLANNER_PROMPT];
  if (args.topic) parts.push(`Topic: ${args.topic}`);
  if (args.why) parts.push(`Why they want to learn it: ${args.why}`);
  if (args.successLooksLike)
    parts.push(`Success looks like: ${args.successLooksLike}`);
  if (args.constraints) parts.push(`Constraints: ${args.constraints}`);
  if (args.contextMarkdown)
    parts.push(`Current workspace:\n${args.contextMarkdown}`);
  if (args.lessonHtml) parts.push(`Current lesson HTML:\n${args.lessonHtml}`);
  if (args.confusion)
    parts.push(`Learner confusion to clarify in place:\n${args.confusion}`);
  return parts.join('\n\n');
}

function writerPrompt(args: WriteArgs): string {
  const parts = [
    WRITER_PROMPT,
    `LessonPlan (JSON):\n${JSON.stringify(args.plan, null, 2)}`,
  ];
  if (args.contextMarkdown)
    parts.push(`Current workspace:\n${args.contextMarkdown}`);
  return parts.join('\n\n');
}
