import { Component, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGraduationCap, lucidePlus, lucideTriangleAlert } from '@ng-icons/lucide';
import { ApiService } from '../../api/api.service';
import { DbService } from '../../data/db.service';
import type { CachedProject } from '../../data/models';

@Component({
  selector: 'app-library',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ lucidePlus, lucideGraduationCap, lucideTriangleAlert })],
  template: `
    <main class="min-h-dvh w-full flex justify-center px-4 py-6" style="background:var(--bg)">
      <div class="w-full max-w-lg flex flex-col gap-5 pb-24">
        <header class="flex items-center gap-3">
          <h1 class="text-lg font-bold tracking-tight flex-1" style="color:var(--ink)">
            Pocket Teach
          </h1>
        </header>

        @if (!loaded()) {
          <p class="text-sm" style="color:var(--muted)">Loading…</p>
        } @else if (error()) {
          <p
            class="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
            style="background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn)"
          >
            <ng-icon name="lucideTriangleAlert" size="16" />
            {{ error() }}
          </p>
        } @else if (projects().length === 0) {
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
              Start one and meet your teacher — it will build you grounded, self-contained lessons.
            </p>
            <button
              type="button"
              (click)="startProject()"
              [disabled]="creating()"
              class="mt-2 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style="background:var(--accent)"
            >
              <ng-icon name="lucidePlus" size="16" /> New learning project
            </button>
          </section>
        } @else {
          <section class="flex flex-col gap-3">
            @for (project of projects(); track project.id) {
              <a
                [routerLink]="['/project', project.id]"
                class="rounded-2xl p-4 flex flex-col gap-1"
                style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
              >
                <h3 class="text-sm font-bold" style="color:var(--ink)">{{ project.title }}</h3>
                <span class="mt-1 text-xs font-semibold" style="color:var(--accent-2)">
                  {{ project.lessonCount }}
                  {{ project.lessonCount === 1 ? 'lesson' : 'lessons' }} ·
                  {{ updatedLabel(project.updatedAt) }}
                </span>
              </a>
            }
          </section>
        }
      </div>

      @if (loaded() && !error()) {
        <button
          type="button"
          (click)="startProject()"
          [disabled]="creating()"
          class="fixed right-5 bottom-5 grid place-items-center w-14 h-14 rounded-2xl text-white disabled:opacity-50"
          style="background:var(--accent);box-shadow:0 8px 20px rgba(91,91,214,.45)"
          aria-label="New learning project"
        >
          <ng-icon name="lucidePlus" size="26" />
        </button>
      }
    </main>
  `,
})
export class LibraryComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly db = inject(DbService);
  private readonly router = inject(Router);

  protected readonly projects = signal<CachedProject[]>([]);
  protected readonly loaded = signal(false);
  protected readonly creating = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const projects = await this.api.listProjects();
      this.projects.set(projects);
      await this.db.cacheProjects(projects);
    } catch (err) {
      // Offline: fall back to the cached project index so previously-synced
      // lessons are still reachable.
      const cached = await this.db.listCachedProjects();
      if (cached.length > 0) this.projects.set(cached);
      else this.error.set(err instanceof Error ? err.message : 'Could not reach the backend.');
    } finally {
      this.loaded.set(true);
    }
  }

  protected async startProject(): Promise<void> {
    if (this.creating()) return;
    this.creating.set(true);
    try {
      const { id } = await this.api.createProject();
      await this.router.navigate(['/project', id]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Could not create a project.');
      this.creating.set(false);
    }
  }

  protected updatedLabel(iso: string): string {
    const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
    if (days <= 0) return 'updated today';
    if (days === 1) return 'updated yesterday';
    if (days < 7) return `updated ${days}d ago`;
    if (days < 30) return `updated ${Math.floor(days / 7)}w ago`;
    return `updated ${Math.floor(days / 30)}mo ago`;
  }
}
