import { createAnthropic } from '@ai-sdk/anthropic';
import { generateObject, generateText, stepCountIs, streamText, tool, type ModelMessage } from 'ai';
import { z } from 'zod';
import type { ChatEvent, ChatMessage, LessonPlan } from '@pocket-teach/api-types';
import {
  LessonPlanSchema,
  extractProposal,
  extractRecord,
  extractTeachMeta,
} from '@pocket-teach/api-types';
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
const CHAT_MAX_STEPS = 8;
const WEB_SEARCH_MAX_USES = 6;
const WEB_FETCH_MAX_USES = 5;

const READ_LESSON_DESCRIPTION =
  "Fetch the full HTML body of a lesson already in this workspace, by its slug from the lesson index. Use only when a recap is not enough — when you need the lesson's exact wording, worked example, or quiz. The app serves the body and the conversation continues.";

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
    this.anthropic = options.apiKey ? createAnthropic({ apiKey: options.apiKey }) : undefined;
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
    const anthropic = this.provider();

    const result = streamText({
      model: anthropic(this.models.planner),
      system: [SYSTEM_PREAMBLE, CHAT_PROMPT, args.contextMarkdown].join('\n\n'),
      messages: toModelMessages(args.history),
      tools: {
        webSearch: anthropic.tools.webSearch_20260209({
          maxUses: WEB_SEARCH_MAX_USES,
        }),
        webFetch: anthropic.tools.webFetch_20260209({
          maxUses: WEB_FETCH_MAX_USES,
        }),
        // No execute: the call surfaces to the app, which serves the body from
        // Dexie and re-POSTs /chat with the result appended. This is what stops
        // the step and ends the turn for the client to fulfil.
        read_lesson: tool({
          description: READ_LESSON_DESCRIPTION,
          inputSchema: z.object({
            slug: z
              .string()
              .min(1)
              .describe('The lesson slug from the workspace lesson index, e.g. 0003-...'),
          }),
        }),
      },
      stopWhen: stepCountIs(CHAT_MAX_STEPS),
      maxOutputTokens: CHAT_MAX_TOKENS,
    });

    let fullText = '';
    let readLessonSlug: string | undefined;
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        fullText += part.text;
        yield { type: 'message', delta: part.text };
      } else if (part.type === 'tool-call' && part.toolName === 'read_lesson') {
        readLessonSlug = (part.input as { slug: string }).slug;
      } else if (part.type === 'error') {
        throw part.error;
      }
    }

    const proposal = extractProposal(fullText);
    if (proposal.ok) yield { type: 'proposal', proposal: proposal.proposal };

    const record = extractRecord(fullText);
    if (record.ok) yield { type: 'record', record: record.record };

    if (readLessonSlug !== undefined) {
      yield { type: 'tool_call', call: { tool: 'read_lesson', slug: readLessonSlug } };
    }

    yield { type: 'done' };
  }
}

function toModelMessages(history: ChatMessage[]): ModelMessage[] {
  const messages: ModelMessage[] = [];
  let pendingToolCallId: string | undefined;

  history.forEach((msg, index) => {
    if (msg.type === 'text') {
      messages.push({ role: msg.role, content: msg.content });
      return;
    }

    if (msg.type === 'tool_call') {
      const toolCallId = `read_lesson_${index}`;
      pendingToolCallId = toolCallId;
      const callPart = {
        type: 'tool-call' as const,
        toolCallId,
        toolName: 'read_lesson',
        input: { slug: msg.call.slug },
      };
      const prev = messages[messages.length - 1];
      if (prev?.role === 'assistant' && typeof prev.content === 'string') {
        prev.content = prev.content ? [{ type: 'text', text: prev.content }, callPart] : [callPart];
      } else if (prev?.role === 'assistant' && Array.isArray(prev.content)) {
        prev.content = [...prev.content, callPart];
      } else {
        messages.push({ role: 'assistant', content: [callPart] });
      }
      return;
    }

    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: pendingToolCallId ?? `read_lesson_${index}`,
          toolName: 'read_lesson',
          output: { type: 'text', value: msg.result.html },
        },
      ],
    });
    pendingToolCallId = undefined;
  });

  return messages;
}

function plannerPrompt(args: PlanArgs): string {
  const amplifying = args.confusion !== undefined;
  const parts = [amplifying ? `${PLANNER_PROMPT}\n\n${AMPLIFY_PROMPT}` : PLANNER_PROMPT];
  if (args.topic) parts.push(`Topic: ${args.topic}`);
  if (args.why) parts.push(`Why they want to learn it: ${args.why}`);
  if (args.successLooksLike) parts.push(`Success looks like: ${args.successLooksLike}`);
  if (args.constraints) parts.push(`Constraints: ${args.constraints}`);
  if (args.contextMarkdown) parts.push(`Current workspace:\n${args.contextMarkdown}`);
  if (args.lessonHtml)
    parts.push(`Current lesson to clarify (keep its objective):\n${args.lessonHtml}`);
  if (args.confusion) parts.push(`Learner confusion to clarify in place:\n${args.confusion}`);
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
  if (args.confusion) parts.push(`Confusion to resolve:\n${args.confusion}`);
  if (args.contextMarkdown)
    parts.push(`Current workspace (lesson index for cross-links):\n${args.contextMarkdown}`);
  return parts.join('\n\n');
}
