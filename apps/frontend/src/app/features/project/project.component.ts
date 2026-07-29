import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { DbService } from '../../data/db.service';
import type { Lesson, Project } from '../../data/models';
import { TeacherChatComponent } from './teacher-chat.component';

@Component({
  selector: 'app-project',
  imports: [RouterLink, NgIcon, TeacherChatComponent],
  viewProviders: [provideIcons({ lucideArrowLeft })],
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
            {{ project()?.title ?? 'Project' }}
          </h1>
        </header>

        @if (project(); as p) {
          <div
            class="flex flex-col gap-1.5 rounded-xl px-3.5 py-3 text-sm"
            style="background:var(--chip);border:1px solid var(--line);color:var(--muted)"
          >
            <span
              ><span class="font-semibold" style="color:var(--ink)">Mission · </span
              >{{ p.mission.topic }}</span
            >
            @if (p.mission.why) {
              <span
                ><span class="font-semibold" style="color:var(--ink)">Why · </span
                >{{ p.mission.why }}</span
              >
            }
            @if (p.mission.successLooksLike) {
              <span
                ><span class="font-semibold" style="color:var(--ink)">Success · </span
                >{{ p.mission.successLooksLike }}</span
              >
            }
            @if (p.mission.constraints) {
              <span
                ><span class="font-semibold" style="color:var(--ink)">Constraints · </span
                >{{ p.mission.constraints }}</span
              >
            }
          </div>

          <section class="flex flex-col">
            @for (lesson of lessons(); track lesson.id) {
              <a
                [routerLink]="['/lesson', lesson.id]"
                class="flex items-center gap-3 py-3"
                style="border-bottom:1px solid var(--line)"
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
          </section>

          <app-teacher-chat [project]="p" [lessons]="lessons()" />
        } @else if (loaded()) {
          <p class="text-sm" style="color:var(--muted)">Project not found.</p>
        }
      </div>
    </main>
  `,
})
export class ProjectComponent implements OnInit {
  private readonly db = inject(DbService);

  readonly id = input.required<string>();

  protected readonly project = signal<Project | undefined>(undefined);
  protected readonly lessons = signal<Lesson[]>([]);
  protected readonly loaded = signal(false);

  async ngOnInit(): Promise<void> {
    const id = this.id();
    this.project.set(await this.db.getProject(id));
    this.lessons.set(await this.db.listLessons(id));
    this.loaded.set(true);
  }

  protected pad(seq: number): string {
    return seq.toString().padStart(2, '0');
  }
}
