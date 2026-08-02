import { Inject, Injectable } from '@nestjs/common';
import {
  hasToolCall,
  stepCountIs,
  streamText,
  tool,
  type SystemModelMessage,
  type ToolSet,
} from 'ai';
import { z } from 'zod';
import { LLM_PROVIDER, type LlmProvider } from '../providers/llm-provider';
import { WorkspaceService } from '../workspace/workspace.service';
import type { LessonSummary } from '../workspace/workspace.types';
import { describeToolActivity } from './activity';
import { wrapLesson } from './lesson-template';
import {
  AMPLIFY_PROMPT,
  GENERATION_PROMPT,
  READ_LESSON_DESCRIPTION,
  SYSTEM_PREAMBLE,
  WRITE_LESSON_DESCRIPTION,
} from './prompts';
import type { EmitGeneration } from './generation.events';

const MAX_STEPS = 16;
// Emit a writing-progress tick roughly every this many streamed characters, so
// the counter moves visibly without flooding the SSE channel.
const PROGRESS_STEP = 400;
// Generous so a long research pass plus the full lesson HTML (passed as the
// write_lesson tool argument) never truncates mid-call and fails validation.
const MAX_OUTPUT_TOKENS = 32000;

// Schemas at module scope with explicit execute-input types: the AI SDK's tool()
// generics are too deep for tsc to infer through (TS2589), so we annotate.
const readLessonSchema = z.object({ slug: z.string().min(1) });
type ReadLessonInput = z.infer<typeof readLessonSchema>;

const writeLessonSchema = z.object({
  slug: z.string().min(1).describe('short dash-case title, no number; the app numbers it'),
  title: z.string().min(1),
  recap: z.string().min(1).describe('reference-grade: key points + the concrete example used'),
  primarySource: z.object({ title: z.string().min(1), url: z.string().url() }),
  linkedTerms: z.array(z.string()).optional(),
  html: z
    .string()
    .min(1)
    .describe('lesson body html using the pt- classes; no html/head/body/style wrapper'),
});
type WriteLessonInput = z.infer<typeof writeLessonSchema>;

export interface GenerateOptions {
  // When the learner agreed to a specific lesson, build exactly that; otherwise
  // the Teacher picks the next lesson from the roadmap and ZPD.
  objective?: string;
  focus?: string;
  // Present → amplify: rewrite this existing lesson in place (same slug/number)
  // rather than creating a new one. focus/objective say what to fix.
  targetSlug?: string;
}

@Injectable()
export class GenerationService {
  constructor(
    @Inject(LLM_PROVIDER) private readonly provider: LlmProvider,
    private readonly workspace: WorkspaceService,
  ) {}

  async generate(projectId: string, opts: GenerateOptions, emit: EmitGeneration): Promise<void> {
    emit({ type: 'phase', phase: 'planning' });

    let researching = false;
    let writing = false;
    let claimed = false;
    let written: LessonSummary | undefined;
    let writeError: unknown;

    try {
      if (!(await this.workspace.projectExists(projectId))) {
        await this.workspace.createProject(projectId);
      }
      const context = await this.workspace.readIndex(projectId);

      // Amplify: rewrite an existing lesson in place. We hand the model the
      // current lesson to improve, and the write tool updates rather than
      // appends. A missing target is a real error, not a silent new lesson.
      const amplifySlug = opts.targetSlug;
      let existingHtml: string | undefined;
      if (amplifySlug) {
        existingHtml = await this.workspace.readLesson(projectId, amplifySlug);
        if (existingHtml === undefined) {
          emit({
            type: 'error',
            message: `Couldn't find the lesson to update (${amplifySlug}).`,
          });
          return;
        }
      }

      const tools: ToolSet = {
        // A provider without native web search would run ungrounded here; when
        // one arrives, wire the SearchProvider seam in as fallback grounding.
        ...(this.provider.capabilities.webSearch ? this.provider.webTools() : {}),
        // inputSchema is cast so tool()'s generics don't instantiate over the
        // deep zod type (TS2589); execute stays type-safe via the named input
        // types. Runtime validation still uses the real schema.
        read_lesson: tool({
          description: READ_LESSON_DESCRIPTION,
          inputSchema: readLessonSchema as never,
          execute: async ({ slug }: ReadLessonInput) =>
            (await this.workspace.readLesson(projectId, slug)) ?? '(lesson not found)',
        }),
        write_lesson: tool({
          description: WRITE_LESSON_DESCRIPTION,
          inputSchema: writeLessonSchema as never,
          execute: async (input: WriteLessonInput) => {
            // Dedupe: the model can emit parallel write_lesson calls in one step
            // (stopWhen only fires after the step). The synchronous claim runs
            // before the first await, so a second call short-circuits.
            if (claimed) return { ok: true, slug: written?.slug ?? '' };
            claimed = true;
            try {
              const lesson = {
                slug: input.slug,
                title: input.title,
                recap: input.recap,
                primarySource: input.primarySource,
                linkedTerms: input.linkedTerms,
                html: wrapLesson(input.html),
              };
              written = amplifySlug
                ? await this.workspace.updateLesson(projectId, amplifySlug, lesson)
                : await this.workspace.writeLesson(projectId, lesson);
              emit({ type: 'lesson', lesson: written });
              return { ok: true, slug: written.slug };
            } catch (err) {
              // Captured so the real persistence failure is reported, not the
              // generic "finished without writing a lesson".
              writeError = err;
              return { ok: false, error: 'failed to save the lesson' };
            }
          },
        }),
      };

      const result = streamText({
        model: this.provider.languageModel(),
        // The large, invariant instructions are marked cacheable so repeated
        // generations reuse them (faster first token, cheaper). The per-project
        // workspace context is a second, uncached system block after the cache
        // breakpoint, so a changing workspace never busts the cached prefix.
        system: [
          {
            role: 'system',
            content: [SYSTEM_PREAMBLE, amplifySlug ? AMPLIFY_PROMPT : GENERATION_PROMPT].join(
              '\n\n',
            ),
            providerOptions: { anthropic: { cacheControl: { type: 'ephemeral' } } },
          },
          { role: 'system', content: `# Workspace context\n${context}` },
        ] satisfies SystemModelMessage[],
        messages: [
          {
            role: 'user',
            content:
              existingHtml !== undefined
                ? amplifyInstruction(opts, lessonBody(existingHtml))
                : instruction(opts),
          },
        ],
        tools,
        // Stop the instant the lesson is written. Letting the loop run another
        // step past write_lesson has surfaced malformed-history errors from the
        // provider's server-side tools, and there's nothing left to do anyway.
        stopWhen: [stepCountIs(MAX_STEPS), hasToolCall('write_lesson')],
        maxOutputTokens: MAX_OUTPUT_TOKENS,
      });

      // Surface the agent's actual steps as they stream so the wait reads as a
      // live feed. The write_lesson html arrives as a streamed tool input; we
      // count its characters (throttled) to show the lesson taking shape.
      let writeInputId: string | undefined;
      let chars = 0;
      let lastEmitted = 0;
      let lastActivity = '';

      const startWriting = () => {
        if (writing) return;
        writing = true;
        emit({ type: 'phase', phase: 'writing' });
      };

      for await (const part of result.fullStream) {
        if (part.type === 'tool-call') {
          if (part.toolName === 'write_lesson') {
            startWriting();
          } else {
            if (!researching) {
              researching = true;
              emit({ type: 'phase', phase: 'researching' });
            }
            const activity = describeToolActivity(part.toolName, part.input);
            // The model often repeats a query across steps; collapse consecutive
            // duplicates so the feed doesn't stutter the same line.
            if (activity) {
              const key = `${activity.kind}:${activity.detail}`;
              if (key !== lastActivity) {
                lastActivity = key;
                emit({ type: 'activity', kind: activity.kind, detail: activity.detail });
              }
            }
          }
        } else if (part.type === 'tool-input-start') {
          if (part.toolName === 'write_lesson') {
            writeInputId = part.id;
            startWriting();
          }
        } else if (part.type === 'tool-input-delta') {
          if (part.id === writeInputId) {
            chars += part.delta.length;
            if (chars - lastEmitted >= PROGRESS_STEP) {
              lastEmitted = chars;
              emit({ type: 'progress', chars });
            }
          }
        } else if (part.type === 'error') {
          throw part.error;
        }
      }
    } catch (err) {
      // If the lesson was already saved, a trailing error is noise — the work
      // succeeded. Only surface an error when nothing was written.
      if (!written) {
        emit({ type: 'error', message: this.provider.describeError(err) });
        return;
      }
    }

    if (!written) {
      const message = writeError
        ? this.provider.describeError(writeError)
        : 'The teacher finished without writing a lesson. Try again.';
      emit({ type: 'error', message });
      return;
    }

    // Persist the "lesson ready" announcement so the confirmation survives a
    // reload (the client also shows it live).
    await this.workspace.appendTranscript(projectId, {
      role: 'assistant',
      content: 'Done — your new lesson is ready.',
      lesson: { slug: written.slug, title: written.title },
      at: new Date().toISOString(),
    });

    emit({ type: 'phase', phase: 'done' });
    emit({ type: 'done' });
  }
}

function amplifyInstruction(opts: GenerateOptions, currentBody: string): string {
  const focus = opts.focus || opts.objective || 'Make it clearer and plainer.';
  return `Rewrite this lesson to fix what the learner flagged, keeping its objective and slug.\n\nWhat to fix: ${focus}\n\n--- CURRENT LESSON BODY (this is the one to rewrite) ---\n${currentBody}`;
}

// The stored lesson is the full wrapped document (shell + canonical CSS); for an
// amplify the model only needs the authored body, so we hand it just the <main>
// content — smaller, and no shell for it to accidentally echo back.
function lessonBody(wrapped: string): string {
  const match = /<main[^>]*>([\s\S]*?)<\/main>/i.exec(wrapped);
  return (match ? match[1] : wrapped).trim();
}

function instruction(opts: GenerateOptions): string {
  if (opts.objective) {
    const focus = opts.focus ? `\nFocus specifically on: ${opts.focus}` : '';
    return `Create the lesson the learner has agreed to — build exactly this, not a different topic.\nObjective: ${opts.objective}${focus}`;
  }
  return "Create the learner's single next lesson, following the roadmap and their Zone of Proximal Development.";
}
