import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText, stepCountIs, streamText } from 'ai';
import type { ChatEvent, LessonPlan } from '@pocket-teach/api-types';
import { LessonPlanSchema, extractTeachMeta } from '@pocket-teach/api-types';
import {
  AMPLIFY_PROMPT,
  CHAT_PROMPT,
  PLANNER_PROMPT,
  PLAN_STRUCTURE_PROMPT,
  SYSTEM_PREAMBLE,
  WRITER_PROMPT,
} from '../prompts/teach.js';
import { BASE_CSS } from '../style/base-css.js';
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

const RESEARCH_MAX_STEPS = 8;
const WEB_SEARCH_MAX_USES = 6;
const WEB_FETCH_MAX_USES = 5;

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
    webSearch: true,
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

  // Two steps because Anthropic structured outputs and web-search citations
  // can't share one call: step 1 grounds via web tools, step 2 structures it.
  async plan(args: PlanArgs): Promise<LessonPlan> {
    const anthropic = this.provider();

    let signalled = false;
    const research = await generateText({
      model: anthropic(this.models.planner),
      system: SYSTEM_PREAMBLE,
      prompt: plannerPrompt(args),
      tools: {
        webSearch: anthropic.tools.webSearch_20260209({
          maxUses: WEB_SEARCH_MAX_USES,
        }),
        webFetch: anthropic.tools.webFetch_20260209({
          maxUses: WEB_FETCH_MAX_USES,
        }),
      },
      stopWhen: stepCountIs(RESEARCH_MAX_STEPS),
      maxOutputTokens: PLAN_MAX_TOKENS,
      onStepFinish({ toolCalls }) {
        if (!signalled && toolCalls.length > 0) {
          signalled = true;
          args.onResearch?.();
        }
      },
    });

    const { object } = await generateObject({
      model: anthropic(this.models.planner),
      schema: LessonPlanSchema,
      system: PLAN_STRUCTURE_PROMPT,
      prompt: research.text,
      maxOutputTokens: PLAN_MAX_TOKENS,
    });

    return LessonPlanSchema.parse(object);
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
  const amplifying = args.confusion !== undefined;
  const parts = [amplifying ? `${PLANNER_PROMPT}\n\n${AMPLIFY_PROMPT}` : PLANNER_PROMPT];
  if (args.topic) parts.push(`Topic: ${args.topic}`);
  if (args.why) parts.push(`Why they want to learn it: ${args.why}`);
  if (args.successLooksLike)
    parts.push(`Success looks like: ${args.successLooksLike}`);
  if (args.constraints) parts.push(`Constraints: ${args.constraints}`);
  if (args.contextMarkdown)
    parts.push(`Current workspace:\n${args.contextMarkdown}`);
  if (args.lessonHtml)
    parts.push(`Current lesson to clarify (keep its objective):\n${args.lessonHtml}`);
  if (args.confusion)
    parts.push(`Learner confusion to clarify in place:\n${args.confusion}`);
  return parts.join('\n\n');
}

function writerPrompt(args: WriteArgs): string {
  const parts = [
    WRITER_PROMPT,
    `Canonical base stylesheet to inline verbatim:\n${BASE_CSS}`,
    `LessonPlan (JSON):\n${JSON.stringify(args.plan, null, 2)}`,
  ];
  if (args.previousLessonHtml) {
    parts.push(AMPLIFY_PROMPT);
    parts.push(`Lesson being clarified (reuse its slug + objective):\n${args.previousLessonHtml}`);
  }
  if (args.confusion)
    parts.push(`Confusion to resolve:\n${args.confusion}`);
  if (args.contextMarkdown)
    parts.push(`Current workspace (lesson index for cross-links):\n${args.contextMarkdown}`);
  return parts.join('\n\n');
}
