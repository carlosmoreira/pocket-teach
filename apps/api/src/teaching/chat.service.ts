import { Inject, Injectable } from '@nestjs/common';
import { stepCountIs, streamText, tool, type ModelMessage, type ToolSet } from 'ai';
import { z } from 'zod';
import { LLM_PROVIDER, type LlmProvider } from '../providers/llm-provider';
import { WorkspaceService, type MemoryFile } from '../workspace/workspace.service';
import {
  CHAT_PROMPT,
  PROPOSE_LESSON_DESCRIPTION,
  READ_LESSON_DESCRIPTION,
  RECORD_LEARNING_DESCRIPTION,
  SYSTEM_PREAMBLE,
  WRITE_MEMORY_DESCRIPTION,
} from './prompts';
import type { ChatEvent, EmitChat, Proposal, StoredMessage } from './chat.events';

const CHAT_MAX_STEPS = 8;
const CHAT_MAX_TOKENS = 4096;

const OPENING_INSTRUCTION =
  'The learner just opened a brand-new project. Introduce yourself in a sentence or two and ask what they would like to learn and why.';

// Schemas at module scope; execute inputs annotated because tool()'s generics
// are too deep for tsc to infer through (see generation.service).
const readLessonSchema = z.object({ slug: z.string().min(1) });
const recordSchema = z.object({ note: z.string().min(1) });
const memorySchema = z.object({
  file: z.enum(['mission', 'roadmap', 'learner-profile', 'misconceptions', 'glossary']),
  content: z.string().min(1),
});
const proposeSchema = z.object({
  kind: z.enum(['new_lesson', 'amplify']).default('new_lesson'),
  objective: z.string().min(1),
  rationale: z.string().min(1),
  targetSlug: z.string().optional(),
  focus: z.string().optional(),
  confirmed: z.boolean().optional(),
});
type ProposeInput = z.infer<typeof proposeSchema>;

@Injectable()
export class ChatService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly workspace: WorkspaceService,
  ) {}

  async chat(projectId: string, message: string | undefined, emit: EmitChat): Promise<void> {
    try {
      if (!(await this.workspace.projectExists(projectId))) {
        await this.workspace.createProject(projectId);
      }

      const prior = (await this.workspace.readTranscript(projectId)) as StoredMessage[];
      const opening = !message && prior.length === 0;

      if (message) {
        await this.workspace.appendTranscript(projectId, {
          role: 'user',
          content: message,
          at: new Date().toISOString(),
        });
      }

      const context = await this.workspace.readIndex(projectId);
      const messages = buildMessages(prior, message, opening);

      let fullText = '';
      let proposal: Proposal | undefined;

      const tools: ToolSet = {
        ...(this.provider.capabilities.webSearch ? this.provider.webTools() : {}),
        read_lesson: tool({
          description: READ_LESSON_DESCRIPTION,
          inputSchema: readLessonSchema as never,
          execute: async ({ slug }: { slug: string }) =>
            (await this.workspace.readLesson(projectId, slug)) ?? '(lesson not found)',
        }),
        write_memory: tool({
          description: WRITE_MEMORY_DESCRIPTION,
          inputSchema: memorySchema as never,
          execute: async ({ file, content }: { file: MemoryFile; content: string }) => {
            await this.workspace.writeMemory(projectId, file, content);
            return { ok: true };
          },
        }),
        record_learning: tool({
          description: RECORD_LEARNING_DESCRIPTION,
          inputSchema: recordSchema as never,
          execute: async ({ note }: { note: string }) => {
            await this.workspace.appendLearningRecord(projectId, note);
            emit({ type: 'record', note });
            return { ok: true };
          },
        }),
        propose_lesson: tool({
          description: PROPOSE_LESSON_DESCRIPTION,
          inputSchema: proposeSchema as never,
          execute: async (input: ProposeInput) => {
            proposal = {
              kind: input.kind,
              objective: input.objective,
              rationale: input.rationale,
              targetSlug: input.targetSlug,
              focus: input.focus,
              confirmed: input.confirmed,
            };
            emit({ type: 'proposal', proposal });
            return { ok: true };
          },
        }),
      };

      const result = streamText({
        model: this.provider.languageModel(),
        system: [SYSTEM_PREAMBLE, CHAT_PROMPT, `# Workspace context\n${context}`].join('\n\n'),
        messages,
        tools,
        stopWhen: stepCountIs(CHAT_MAX_STEPS),
        maxOutputTokens: CHAT_MAX_TOKENS,
      });

      for await (const part of result.fullStream) {
        if (part.type === 'text-delta') {
          fullText += part.text;
          emit({ type: 'message', delta: part.text } satisfies ChatEvent);
        } else if (part.type === 'error') {
          throw part.error;
        }
      }

      // Only persist a substantive assistant turn. A turn that produced neither
      // text nor a proposal (e.g. only a record_learning side effect) leaves no
      // empty message to trip alternation on the next call.
      const content = fullText.trim();
      if (content || proposal) {
        await this.workspace.appendTranscript(projectId, {
          role: 'assistant',
          content,
          proposal,
          at: new Date().toISOString(),
        });
      }
      emit({ type: 'done' });
    } catch (err) {
      emit({ type: 'error', message: this.provider.describeError(err) });
    }
  }
}

function buildMessages(
  prior: StoredMessage[],
  message: string | undefined,
  opening: boolean,
): ModelMessage[] {
  if (opening) return [{ role: 'user', content: OPENING_INSTRUCTION }];

  type Turn = { role: 'user' | 'assistant'; content: string };

  // Drop empty turns (proposal-only assistant messages carry no model text) and
  // add the new user turn.
  const turns: Turn[] = prior
    .filter((m) => m.content.trim())
    .map((m) => ({ role: m.role, content: m.content }));
  if (message) turns.push({ role: 'user', content: message });

  // Merge consecutive same-role turns so a failed turn (user saved, assistant
  // not) can't produce two user messages in a row and break alternation.
  const merged: Turn[] = [];
  for (const turn of turns) {
    const last = merged[merged.length - 1];
    if (last && last.role === turn.role) {
      last.content = `${last.content}\n\n${turn.content}`;
    } else {
      merged.push({ ...turn });
    }
  }

  // A transcript that opens with the Teacher's greeting has no leading user
  // turn; prepend one so the model sees valid alternation.
  if (merged[0]?.role === 'assistant') {
    merged.unshift({ role: 'user', content: '(the learner opened a new project)' });
  }
  return merged as ModelMessage[];
}
