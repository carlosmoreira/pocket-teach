import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideBookOpen, lucideChevronDown } from '@ng-icons/lucide';
import { ApiService } from '../../api/api.service';
import { DbService } from '../../data/db.service';
import { TeacherChatComponent } from './teacher-chat.component';

interface LessonRow {
  slug: string;
  seq: number;
  title: string;
}

@Component({
  selector: 'app-project',
  imports: [RouterLink, NgIcon, TeacherChatComponent],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideBookOpen, lucideChevronDown })],
  template: `
    <main class="min-h-dvh w-full flex justify-center px-4 py-6" style="background:var(--bg)">
      <div class="w-full max-w-lg flex flex-col gap-5">
        <header class="flex items-center gap-3">
          <a
            routerLink="/library"
            class="grid place-items-center w-9 h-9 rounded-xl shrink-0"
            style="background:var(--panel);border:1px solid var(--line);color:var(--ink)"
            aria-label="Back to library"
          >
            <ng-icon name="lucideArrowLeft" size="18" />
          </a>
          <h1 class="text-lg font-bold tracking-tight truncate" style="color:var(--ink)">
            {{ title() }}
          </h1>
        </header>

        @if (lessons().length > 0) {
          <div
            class="flex flex-col rounded-2xl overflow-hidden"
            style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
          >
            <button
              type="button"
              (click)="expanded.set(!expanded())"
              class="flex items-center gap-2 px-3.5 py-3 text-sm font-semibold"
              style="color:var(--ink)"
            >
              <ng-icon name="lucideBookOpen" size="16" style="color:var(--accent)" />
              <span class="flex-1 text-left">
                {{ lessons().length }} {{ lessons().length === 1 ? 'lesson' : 'lessons' }}
              </span>
              <ng-icon
                name="lucideChevronDown"
                size="16"
                style="color:var(--muted);transition:transform .15s"
                [style.transform]="expanded() ? 'rotate(180deg)' : 'none'"
              />
            </button>
            @if (expanded()) {
              <div
                class="flex flex-col max-h-64 overflow-y-auto px-1.5 pb-1.5"
                style="border-top:1px solid var(--line)"
              >
                @for (lesson of lessons(); track lesson.slug) {
                  <a
                    [routerLink]="['/lesson', id(), lesson.slug]"
                    class="flex items-center gap-3 px-2 py-2.5 rounded-xl"
                  >
                    <span
                      class="grid place-items-center w-7 h-7 rounded-lg text-xs font-bold shrink-0"
                      style="background:var(--chip);color:var(--accent)"
                    >
                      {{ pad(lesson.seq) }}
                    </span>
                    <span class="text-sm font-semibold" style="color:var(--ink)">{{
                      lesson.title
                    }}</span>
                  </a>
                }
              </div>
            }
          </div>
        }

        @if (loaded()) {
          <app-teacher-chat [projectId]="id()" (lessonCreated)="reload()" />
        }
      </div>
    </main>
  `,
})
export class ProjectComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly db = inject(DbService);

  readonly id = input.required<string>();

  protected readonly title = signal('New project');
  protected readonly lessons = signal<LessonRow[]>([]);
  protected readonly loaded = signal(false);
  protected readonly expanded = signal(false);

  async ngOnInit(): Promise<void> {
    await this.reload();
    this.loaded.set(true);
  }

  protected async reload(): Promise<void> {
    try {
      const project = await this.api.getProject(this.id());
      this.lessons.set(project.lessons);
      this.title.set(titleFromMission(project.mission));
      await this.db.cacheLessonSummaries(this.id(), project.lessons);
    } catch {
      // Offline: render the cached lesson index so lessons remain reachable.
      const cached = await this.db.listCachedLessons(this.id());
      if (cached.length > 0) this.lessons.set(cached);
    }
  }

  protected pad(seq: number): string {
    return seq.toString().padStart(2, '0');
  }
}

function titleFromMission(mission: string): string {
  // Strip leading list/heading markers so "- Topic: X", "## Topic", "Topic: X"
  // all resolve to the topic value.
  const cleaned = mission
    .split('\n')
    .map((l) => l.replace(/^[-*#>\s]+/, '').trim())
    .filter((l) => l.length > 0);
  for (const line of cleaned) {
    const inline = /^topic:\s*(.+)$/i.exec(line);
    if (inline) return inline[1].trim();
  }
  const idx = cleaned.findIndex((l) => /^topic$/i.test(l));
  const afterHeading = idx !== -1 ? cleaned[idx + 1] : undefined;
  if (afterHeading) return afterHeading;
  return cleaned[0] ?? 'New project';
}
