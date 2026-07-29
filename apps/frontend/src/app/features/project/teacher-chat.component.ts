import { Component, OnInit, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSend } from '@ng-icons/lucide';
import type { ChatMessage } from '@pocket-teach/api-types';
import { DbService } from '../../data/db.service';
import { buildContextMarkdown } from '../../data/workspace-context';
import type { LearningRecord, Lesson, Message, Project } from '../../data/models';
import { GatewayService } from '../../api/gateway.service';

const MAX_CHAT_STEPS = 6;

@Component({
  selector: 'app-teacher-chat',
  imports: [FormsModule, NgIcon],
  viewProviders: [provideIcons({ lucideSend })],
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
            {{ message.content }}
          </div>
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

  protected readonly messages = signal<Message[]>([]);
  protected readonly draft = signal('');
  protected readonly streaming = signal('');
  protected readonly sending = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly userBubble = 'background:var(--accent);color:#fff';
  protected readonly teacherBubble =
    'background:var(--panel);border:1px solid var(--line);color:var(--ink)';

  private records: LearningRecord[] = [];

  async ngOnInit(): Promise<void> {
    const projectId = this.project().id;
    this.messages.set(await this.db.listMessages(projectId));
    this.records = await this.db.listLearningRecords(projectId);
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
      const answer = await this.runChat();
      if (answer) await this.appendMessage('assistant', answer);
    } finally {
      this.streaming.set('');
      this.sending.set(false);
    }
  }

  private async runChat(): Promise<string> {
    const context = buildContextMarkdown(this.project(), this.lessons(), this.records);
    const history: ChatMessage[] = this.messages().map((m) => ({
      type: 'text',
      role: m.role,
      content: m.content,
    }));

    let display = '';
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

    return visibleText(display);
  }

  private async appendMessage(role: 'user' | 'assistant', content: string): Promise<void> {
    const message: Message = {
      id: crypto.randomUUID(),
      projectId: this.project().id,
      role,
      content,
      createdAt: new Date().toISOString(),
    };
    await this.db.addMessage(message);
    this.messages.update((list) => [...list, message]);
  }
}

const ISLAND_RE = /<script[^>]*\bid=["'](?:proposal|record)["'][\s\S]*?<\/script>/gi;
const PARTIAL_ISLAND_RE = /<script\b(?:(?!<\/script>)[\s\S])*$/i;

function visibleText(raw: string): string {
  return raw.replace(ISLAND_RE, '').replace(PARTIAL_ISLAND_RE, '').trim();
}
