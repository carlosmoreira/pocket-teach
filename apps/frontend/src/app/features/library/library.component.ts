import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGraduationCap, lucidePlus, lucideSettings } from '@ng-icons/lucide';
import { DbService, type ProjectSummary } from '../../data/db.service';
import type { ProjectMission } from '../../data/models';

@Component({
  selector: 'app-library',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ lucideSettings, lucidePlus, lucideGraduationCap })],
  template: `
    <main class="min-h-dvh w-full flex justify-center px-4 py-6" style="background:var(--bg)">
      <div class="w-full max-w-lg flex flex-col gap-5 pb-24">
        <header class="flex items-center gap-3">
          <h1 class="text-lg font-bold tracking-tight flex-1" style="color:var(--ink)">
            Pocket Teach
          </h1>
          <a
            routerLink="/settings"
            class="grid place-items-center w-9 h-9 rounded-xl"
            style="background:var(--panel);border:1px solid var(--line);color:var(--ink)"
            aria-label="Settings"
          >
            <ng-icon name="lucideSettings" size="18" />
          </a>
        </header>

        @if (!loaded()) {
          <p class="text-sm" style="color:var(--muted)">Loading…</p>
        } @else if (summaries().length === 0) {
          <section
            class="rounded-2xl p-8 flex flex-col items-center text-center gap-3"
            style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
          >
            <span
              class="grid place-items-center w-14 h-14 rounded-2xl text-white"
              style="background:var(--accent)"
            >
              <ng-icon name="lucideGraduationCap" size="26" />
            </span>
            <h2 class="text-base font-bold" style="color:var(--ink)">No learning projects yet</h2>
            <p class="text-sm" style="color:var(--muted)">
              Start one and Pocket Teach will build you a grounded, self-contained lesson.
            </p>
            <a
              routerLink="/new"
              class="mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
              style="background:var(--accent)"
            >
              <ng-icon name="lucidePlus" size="16" /> New learning project
            </a>
          </section>
        } @else {
          <section class="flex flex-col gap-3">
            @for (summary of summaries(); track summary.project.id) {
              <a
                [routerLink]="['/project', summary.project.id]"
                class="rounded-2xl p-4 flex flex-col gap-1"
                style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
              >
                <h3 class="text-sm font-bold" style="color:var(--ink)">
                  {{ summary.project.title }}
                </h3>
                <p class="text-xs line-clamp-2" style="color:var(--muted)">
                  {{ oneLine(summary.project.mission) }}
                </p>
                <span class="mt-1 text-xs font-semibold" style="color:var(--accent-2)">
                  {{ summary.lessonCount }} {{ summary.lessonCount === 1 ? 'lesson' : 'lessons' }} ·
                  {{ updatedLabel(summary.project.createdAt) }}
                </span>
              </a>
            }
          </section>
        }
      </div>

      <a
        routerLink="/new"
        class="fixed right-5 bottom-5 grid place-items-center w-14 h-14 rounded-2xl text-white"
        style="background:var(--accent);box-shadow:0 8px 20px rgba(91,91,214,.45)"
        aria-label="New learning project"
      >
        <ng-icon name="lucidePlus" size="26" />
      </a>
    </main>
  `,
})
export class LibraryComponent implements OnInit {
  private readonly db = inject(DbService);

  protected readonly summaries = signal<ProjectSummary[]>([]);
  protected readonly loaded = signal(false);

  async ngOnInit(): Promise<void> {
    this.summaries.set(await this.db.listProjectSummaries());
    this.loaded.set(true);
  }

  protected oneLine(mission: ProjectMission): string {
    return mission.why ?? mission.successLooksLike ?? mission.topic;
  }

  protected updatedLabel(createdAt: string): string {
    const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
    if (days <= 0) return 'updated today';
    if (days === 1) return 'updated yesterday';
    if (days < 7) return `updated ${days}d ago`;
    if (days < 30) return `updated ${Math.floor(days / 7)}w ago`;
    return `updated ${Math.floor(days / 30)}mo ago`;
  }
}
