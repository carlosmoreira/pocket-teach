import {
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBookOpen,
  lucideLoaderCircle,
  lucideRotateCcw,
  lucideSend,
  lucideTriangleAlert,
  lucideWandSparkles,
} from '@ng-icons/lucide';
import { ApiService } from '../../api/api.service';
import { DbService } from '../../data/db.service';
import type { GenerationPhase, Proposal } from '../../api/contracts';

interface CreatedLesson {
  slug: string;
  title: string;
}

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  proposal?: Proposal;
  lesson?: CreatedLesson;
}

const PHASE_LABELS: Record<string, string> = {
  planning: 'reading your workspace…',
  researching: 'grounding in trusted sources…',
  writing: 'writing the lesson…',
  done: 'saving…',
  error: '',
};

@Component({
  selector: 'app-teacher-chat',
  imports: [FormsModule, RouterLink, NgIcon],
  viewProviders: [
    provideIcons({
      lucideSend,
      lucideWandSparkles,
      lucideLoaderCircle,
      lucideTriangleAlert,
      lucideRotateCcw,
      lucideBookOpen,
    }),
  ],
  template: `
    <section class="flex flex-col gap-3">
      <h2 class="text-sm font-bold" style="color:var(--ink)">Teacher</h2>

      <div #scrollBox class="flex flex-col gap-2.5 max-h-[55vh] overflow-y-auto pb-1">
        @for (message of messages(); track message.id) {
          <div
            class="max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap"
            [class.self-end]="message.role === 'user'"
            [class.self-start]="message.role === 'assistant'"
            [style]="message.role === 'user' ? userBubble : teacherBubble"
          >
            {{ message.content }}
          </div>

          @if (message.proposal; as proposal) {
            @if (generatingFor() !== message.id) {
              <div
                class="self-start w-full rounded-2xl p-3.5 flex flex-col gap-2"
                style="background:var(--panel);border:1px solid var(--accent);box-shadow:var(--shadow)"
              >
                <span
                  class="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
                  style="color:var(--accent)"
                >
                  <ng-icon name="lucideWandSparkles" size="14" />
                  {{ proposal.kind === 'amplify' ? 'Clarify lesson' : 'New lesson' }}
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
              </div>
            }
          }

          @if (message.lesson; as lesson) {
            <a
              [routerLink]="['/lesson', projectId(), lesson.slug]"
              class="self-start w-full rounded-2xl p-3.5 flex items-center gap-3"
              style="background:var(--panel);border:1px solid var(--accent-2);box-shadow:var(--shadow)"
            >
              <span
                class="grid place-items-center w-9 h-9 rounded-xl text-white shrink-0"
                style="background:var(--accent-2)"
              >
                <ng-icon name="lucideBookOpen" size="18" />
              </span>
              <span class="flex flex-col min-w-0">
                <span
                  class="text-xs font-semibold uppercase tracking-wide"
                  style="color:var(--accent-2)"
                >
                  Lesson ready · tap to read
                </span>
                <span class="text-sm font-semibold truncate" style="color:var(--ink)">{{
                  lesson.title
                }}</span>
              </span>
            </a>
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
      </div>

      @if (error()) {
        <p
          class="rounded-xl px-3.5 py-2.5 text-sm"
          style="background:color-mix(in srgb, var(--warn) 12%, transparent);color:var(--warn)"
        >
          {{ error() }}
        </p>
      }

      <div class="pt-1 flex flex-col gap-2">
        @if (generatingFor()) {
          @if (genError(); as message) {
            <div
              class="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
              style="background:color-mix(in srgb,var(--warn) 12%,var(--panel));border:1px solid var(--warn)"
            >
              <ng-icon name="lucideTriangleAlert" size="18" style="color:var(--warn)" />
              <span class="flex-1 text-sm" style="color:var(--warn)">{{ message }}</span>
              <button
                type="button"
                (click)="retryGeneration()"
                class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shrink-0"
                style="background:var(--accent)"
              >
                <ng-icon name="lucideRotateCcw" size="14" /> Retry
              </button>
            </div>
          } @else {
            <div
              class="flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5"
              style="background:color-mix(in srgb,var(--accent) 10%,var(--panel));border:1px solid var(--accent)"
            >
              <ng-icon
                name="lucideLoaderCircle"
                size="18"
                class="animate-spin"
                style="color:var(--accent)"
              />
              <span class="flex flex-col min-w-0">
                <span class="text-sm font-semibold" style="color:var(--ink)"
                  >Creating your lesson…
                  <span style="color:var(--muted);font-weight:400">{{ genPhaseLabel() }}</span>
                </span>
                @if (generatingObjective(); as obj) {
                  <span class="text-xs truncate" style="color:var(--muted)">{{ obj }}</span>
                }
              </span>
            </div>
          }
        }

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
            [disabled]="sending() || generatingFor() !== null || !draft().trim()"
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
export class TeacherChatComponent implements OnInit, OnDestroy {
  private readonly api = inject(ApiService);
  private readonly db = inject(DbService);
  private readonly abort = new AbortController();

  readonly projectId = input.required<string>();
  readonly lessonCreated = output<void>();

  protected readonly messages = signal<ChatMsg[]>([]);
  protected readonly draft = signal('');
  protected readonly streaming = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly generatingFor = signal<string | null>(null);
  protected readonly generatingObjective = computed(() => {
    const id = this.generatingFor();
    return id ? (this.messages().find((m) => m.id === id)?.proposal?.objective ?? null) : null;
  });
  protected readonly genPhase = signal<GenerationPhase | null>(null);
  protected readonly genError = signal<string | null>(null);

  protected readonly userBubble = 'background:var(--accent);color:#fff';
  protected readonly teacherBubble =
    'background:var(--panel);border:1px solid var(--line);color:var(--ink)';

  private readonly scrollBox = viewChild<ElementRef<HTMLDivElement>>('scrollBox');
  private genRequestObjective = '';

  constructor() {
    effect(() => {
      this.messages();
      this.streaming();
      this.sending();
      this.genPhase();
      const el = this.scrollBox()?.nativeElement;
      if (el) queueMicrotask(() => (el.scrollTop = el.scrollHeight));
    });
  }

  async ngOnInit(): Promise<void> {
    try {
      const transcript = await this.api.getTranscript(this.projectId());
      this.messages.set(
        transcript.map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
          // Proposals are live offers, actionable only during the turn that
          // produced them. On reload we never re-arm a card (the lesson list is
          // the truth for what exists) — the offer text remains; ask again to act.
        })),
      );
      if (transcript.length === 0) await this.runChat(undefined);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not reach the backend.');
    }
  }

  ngOnDestroy(): void {
    this.abort.abort();
  }

  protected genPhaseLabel(): string {
    return PHASE_LABELS[this.genPhase() ?? 'planning'] ?? 'starting…';
  }

  protected onEnter(event: Event): void {
    const keyboard = event as KeyboardEvent;
    if (keyboard.shiftKey) return;
    keyboard.preventDefault();
    void this.send();
  }

  protected async send(): Promise<void> {
    const text = this.draft().trim();
    if (!text || this.sending() || this.generatingFor() !== null) return;
    this.draft.set('');
    this.appendMessage('user', text);
    await this.runChat(text);
  }

  private async runChat(message: string | undefined): Promise<void> {
    this.error.set(null);
    this.sending.set(true);
    this.streaming.set('');
    try {
      let answer = '';
      let proposal: Proposal | undefined;
      for await (const event of this.api.chat(this.projectId(), message, this.abort.signal)) {
        if (event.type === 'message') {
          answer += event.delta;
          this.streaming.set(answer);
        } else if (event.type === 'proposal') {
          proposal = event.proposal;
        } else if (event.type === 'error') {
          this.error.set(event.message);
        }
      }
      if (this.abort.signal.aborted) return;
      if (answer.trim() || proposal) {
        const msg = this.appendMessage('assistant', answer.trim(), proposal);
        if (proposal?.confirmed) void this.createLesson(msg);
      }
    } finally {
      this.streaming.set('');
      this.sending.set(false);
    }
  }

  protected async createLesson(message: ChatMsg): Promise<void> {
    if (!message.proposal) return;
    this.genRequestObjective = message.proposal.objective;
    this.generatingFor.set(message.id);
    await this.runLessonGeneration(message);
  }

  protected async runLessonGeneration(message: ChatMsg): Promise<void> {
    this.genPhase.set(null);
    this.genError.set(null);
    const proposal = message.proposal;
    if (!proposal) return;

    let created: CreatedLesson | undefined;
    for await (const event of this.api.generateLesson(
      this.projectId(),
      { objective: this.genRequestObjective, focus: proposal.focus },
      this.abort.signal,
    )) {
      switch (event.type) {
        case 'phase':
          this.genPhase.set(event.phase);
          break;
        case 'lesson':
          created = { slug: event.lesson.slug, title: event.lesson.title };
          await this.cacheLesson(event.lesson.slug);
          this.lessonCreated.emit();
          break;
        case 'done':
          this.clearProposal(message);
          this.generatingFor.set(null);
          // Announce it inline with a tappable card so the teacher "says" it's
          // done and you don't have to scroll up to find the lesson.
          if (created) {
            this.appendMessage('assistant', 'Done — your new lesson is ready.', undefined, created);
          }
          return;
        case 'error':
          this.genError.set(event.message);
          return;
      }
    }
  }

  protected retryGeneration(): void {
    const id = this.generatingFor();
    const message = id ? this.messages().find((m) => m.id === id) : undefined;
    if (message) void this.runLessonGeneration(message);
  }

  protected dismissProposal(message: ChatMsg): void {
    this.clearProposal(message);
  }

  private clearProposal(message: ChatMsg): void {
    this.messages.update((list) =>
      list.map((m) => (m.id === message.id ? { ...m, proposal: undefined } : m)),
    );
  }

  private async cacheLesson(slug: string): Promise<void> {
    try {
      const { html } = await this.api.getLesson(this.projectId(), slug);
      const project = await this.api.getProject(this.projectId());
      const summary = project.lessons.find((l) => l.slug === slug);
      if (!summary) return;
      await this.db.cacheLesson({
        projectId: this.projectId(),
        slug: summary.slug,
        seq: summary.seq,
        title: summary.title,
        recap: summary.recap,
        html,
      });
    } catch {
      /* caching is best-effort; the lesson still reads online */
    }
  }

  private appendMessage(
    role: 'user' | 'assistant',
    content: string,
    proposal?: Proposal,
    lesson?: CreatedLesson,
  ): ChatMsg {
    const message: ChatMsg = { id: crypto.randomUUID(), role, content, proposal, lesson };
    this.messages.update((list) => [...list, message]);
    return message;
  }
}
