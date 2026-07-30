import { Component, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSend, lucideWandSparkles } from '@ng-icons/lucide';
import type { ChatMessage, LessonPlan, Phase, Proposal } from '@pocket-teach/api-types';
import { DbService } from '../../data/db.service';
import { buildContextMarkdown } from '../../data/workspace-context';
import type { LearningRecord, Lesson, Message, Project } from '../../data/models';
import { GatewayService } from '../../api/gateway.service';
import { GenerationProgressComponent } from '../new-project/generation-progress.component';

const MAX_CHAT_STEPS = 6;

@Component({
  selector: 'app-teacher-chat',
  imports: [FormsModule, NgIcon, GenerationProgressComponent],
  viewProviders: [provideIcons({ lucideSend, lucideWandSparkles })],
  template: `
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-bold" style="color:var(--ink)">Teacher</h2>

      <div class="flex flex-col gap-2.5">
        @for (message of messages(); track message.id) {
          <div
            class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
            [class.self-end]="message.role === 'user'"
            [class.self-start]="message.role === 'assistant'"
            [style]="message.role === 'user' ? userBubble : teacherBubble"
          >
            {{ display(message.content) }}
          </div>

          @if (message.proposal; as proposal) {
            <div
              class="self-start w-full rounded-2xl p-3.5 flex flex-col gap-2"
              style="background:var(--panel);border:1px solid var(--accent);box-shadow:var(--shadow)"
            >
              @if (generatingFor() === message.id) {
                <app-generation-progress
                  [phase]="genPhase()"
                  [plan]="genPlan()"
                  [error]="genError()"
                  (retry)="runLessonGeneration(message)"
                />
              } @else {
                <span
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
                  style="color:var(--accent)"
                >
                  <ng-icon name="lucideWandSparkles" size="14" /> New lesson
                </span>
                <span class="text-sm font-semibold" style="color:var(--ink)">{{
                  proposal.objective
                }}</span>
                <span class="text-xs" style="color:var(--muted)">{{ proposal.rationale }}</span>
                <div class="flex gap-2 mt-1">
                  <button
                    type="button"
                    (click)="createLesson(message)"
                    [disabled]="generatingFor() !== null"
                    class="flex-1 rounded-xl px-3.5 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    style="background:var(--accent)"
                  >
                    Create lesson
                  </button>
                  <button
                    type="button"
                    (click)="dismissProposal(message)"
                    [disabled]="generatingFor() !== null"
                    class="rounded-xl px-3.5 py-2 text-sm font-semibold disabled:opacity-40"
                    style="background:var(--chip);color:var(--muted)"
                  >
                    Not now
                  </button>
                </div>
              }
            </div>
          }
        }

        @if (streaming()) {
          <div
            class="self-start max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
            [style]="teacherBubble"
          >
            {{ streaming() }}
          </div>
        } @else if (sending()) {
          <div
            class="self-start rounded-2xl px-3.5 py-2.5 text-sm"
            style="background:var(--panel);border:1px solid var(--line);color:var(--muted)"
          >
            Thinking…
          </div>
        }

        @if (messages().length === 0 && !sending()) {
          <p class="text-sm" style="color:var(--muted)">
            Ask the teacher anything about this course, or say what you'd like to learn next.
          </p>
        }
      </div>

      @if (error()) {
        <p
          class="rounded-xl px-3.5 py-2.5 text-sm"
          style="background:color-mix(in srgb, var(--warn) 12%, transparent);color:var(--warn)"
        >
          {{ error() }}
        </p>
      }

      @if (hasPendingProposal() && !generatingFor()) {
        <p class="text-xs" style="color:var(--muted)">
          A lesson is ready to build — tap
          <span style="color:var(--accent);font-weight:600">Create lesson</span> above.
        </p>
      }

      <div class="sticky bottom-0 pt-2" style="background:var(--bg)">
        <div
          class="flex items-end gap-2 rounded-2xl p-2"
          style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
        >
          <textarea
            [(ngModel)]="draft"
            (keydown.enter)="onEnter($event)"
            rows="1"
            placeholder="Message the teacher…"
            class="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none"
            style="color:var(--ink)"
          ></textarea>
          <button
            type="button"
            (click)="send()"
            [disabled]="sending() || !draft().trim()"
            class="grid place-items-center w-9 h-9 rounded-xl text-white shrink-0 disabled:opacity-40"
            style="background:var(--accent)"
            aria-label="Send"
          >
            <ng-icon name="lucideSend" size="16" />
          </button>
        </div>
      </div>
    </section>
  `,
})
export class TeacherChatComponent implements OnInit {
  private readonly db = inject(DbService);
  private readonly gateway = inject(GatewayService);

  readonly project = input.required<Project>();
  readonly lessons = input.required<Lesson[]>();
  readonly lessonCreated = output<void>();

  protected readonly messages = signal<Message[]>([]);
  protected readonly draft = signal('');
  protected readonly streaming = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly hasPendingProposal = computed(() => this.messages().some((m) => !!m.proposal));

  protected readonly generatingFor = signal<string | null>(null);
  protected readonly genPhase = signal<Phase | null>(null);
  protected readonly genPlan = signal<LessonPlan | null>(null);
  protected readonly genError = signal<string | null>(null);

  protected readonly userBubble = 'background:var(--accent);color:#fff';
  protected readonly teacherBubble =
    'background:var(--panel);border:1px solid var(--line);color:var(--ink)';

  private records: LearningRecord[] = [];
  private genRequestId = '';

  async ngOnInit(): Promise<void> {
    const projectId = this.project().id;
    this.messages.set(await this.db.listMessages(projectId));
    this.records = await this.db.listLearningRecords(projectId);
  }

  protected display(content: string): string {
    return visibleText(content);
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    void this.send();
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.sending()) return;

    this.draft.set('');
    this.error.set(null);
    await this.appendMessage('user', text);

    this.sending.set(true);
    this.streaming.set('');
    try {
      const { text: answer, proposal } = await this.runChat();
      if (proposal) await this.clearPendingProposals();
      if (answer || proposal) {
        const message = await this.appendMessage(
          'assistant',
          answer || 'Ready for the next lesson whenever you are.',
          proposal,
        );
        if (proposal?.confirmed) void this.createLesson(message);
      }
    } finally {
      this.streaming.set('');
      this.sending.set(false);
    }
  }

  private async clearPendingProposals(): Promise<void> {
    for (const message of this.messages()) {
      if (message.proposal) await this.clearProposal(message);
    }
  }

  protected async createLesson(message: Message): Promise<void> {
    this.genRequestId = crypto.randomUUID();
    this.generatingFor.set(message.id);
    await this.runLessonGeneration(message);
  }

  protected async runLessonGeneration(message: Message): Promise<void> {
    this.genPhase.set(null);
    this.genPlan.set(null);
    this.genError.set(null);

    const context = buildContextMarkdown(this.project(), this.lessons(), this.records, {
      requested: message.proposal,
    });
    for await (const event of this.gateway.generateLesson(context, this.genRequestId)) {
      switch (event.type) {
        case 'phase':
          this.genPhase.set(event.phase);
          break;
        case 'plan':
          this.genPlan.set(event.plan);
          break;
        case 'done':
          await this.db.saveGeneratedLesson(this.project().id, event);
          await this.clearProposal(message);
          this.generatingFor.set(null);
          this.lessonCreated.emit();
          return;
        case 'error':
          this.genError.set(event.message);
          return;
      }
    }
  }

  protected async dismissProposal(message: Message): Promise<void> {
    await this.clearProposal(message);
  }

  private async clearProposal(message: Message): Promise<void> {
    await this.db.updateMessage(message.id, { proposal: undefined });
    this.messages.update((list) =>
      list.map((m) => (m.id === message.id ? { ...m, proposal: undefined } : m)),
    );
  }

  private async runChat(): Promise<{ text: string; proposal?: Proposal }> {
    const context = buildContextMarkdown(this.project(), this.lessons(), this.records);
    const history: ChatMessage[] = this.messages().map((m) => {
      const clean = visibleText(m.content);
      const pending = m.proposal
        ? `${clean}\n\n[You have an unconfirmed offer on the table — objective: "${m.proposal.objective}". If the learner agrees, confirm it.]`
        : clean;
      return { type: 'text', role: m.role, content: pending };
    });

    let display = '';
    let proposal: Proposal | undefined;
    for (let step = 0; step < MAX_CHAT_STEPS; step++) {
      let segment = '';
      let toolSlug: string | undefined;
      let errored = false;

      for await (const event of this.gateway.chat({ contextMarkdown: context, history })) {
        if (event.type === 'message') {
          segment += event.delta;
          display += event.delta;
          this.streaming.set(visibleText(display));
        } else if (event.type === 'tool_call') {
          toolSlug = event.call.slug;
        } else if (event.type === 'proposal') {
          if (event.proposal.kind === 'new_lesson') proposal = event.proposal;
        } else if (event.type === 'error') {
          this.error.set(event.message);
          errored = true;
        }
      }

      if (errored || toolSlug === undefined) break;

      if (segment) history.push({ type: 'text', role: 'assistant', content: segment });
      history.push({ type: 'tool_call', call: { tool: 'read_lesson', slug: toolSlug } });
      const lesson = await this.db.getLessonBySlug(this.project().id, toolSlug);
      history.push({
        type: 'tool_result',
        result: { tool: 'read_lesson', slug: toolSlug, html: lesson?.html ?? '' },
      });
    }

    return { text: visibleText(display), proposal };
  }

  private async appendMessage(
    role: 'user' | 'assistant',
    content: string,
    proposal?: Proposal,
  ): Promise<Message> {
    const message: Message = {
      id: crypto.randomUUID(),
      projectId: this.project().id,
      role,
      content,
      proposal,
      createdAt: new Date().toISOString(),
    };
    await this.db.addMessage(message);
    this.messages.update((list) => [...list, message]);
    return message;
  }
}

const ISLAND = `<script[^>]*\\bid=["'](?:proposal|record)["'][\\s\\S]*?<\\/script>`;
const FENCED_ISLAND_RE = new RegExp('```[a-z]*\\s*' + ISLAND + '\\s*```', 'gi');
const ISLAND_RE = new RegExp(ISLAND, 'gi');
const EMPTY_FENCE_RE = /```[a-z]*\s*```/gi;
const PARTIAL_ISLAND_RE = /(?:```[a-z]*\s*)?<script\b(?:(?!<\/script>)[\s\S])*$/i;

function visibleText(raw: string): string {
  return raw
    .replace(FENCED_ISLAND_RE, '')
    .replace(ISLAND_RE, '')
    .replace(EMPTY_FENCE_RE, '')
    .replace(PARTIAL_ISLAND_RE, '')
    .trim();
}
