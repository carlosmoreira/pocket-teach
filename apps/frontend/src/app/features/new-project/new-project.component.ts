import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import type { LessonPlan, Phase } from '@pocket-teach/api-types';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft, lucideTriangleAlert, lucideWandSparkles } from '@ng-icons/lucide';
import { GatewayService, type GenerateProjectInput } from '../../api/gateway.service';
import { SettingsService } from '../../core/settings/settings.service';
import { DbService } from '../../data/db.service';
import type { ProjectMission } from '../../data/models';
import { GenerationProgressComponent } from './generation-progress.component';

@Component({
  selector: 'app-new-project',
  imports: [FormsModule, RouterLink, NgIcon, GenerationProgressComponent],
  viewProviders: [provideIcons({ lucideArrowLeft, lucideWandSparkles, lucideTriangleAlert })],
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
          <h1 class="text-lg font-bold tracking-tight" style="color:var(--ink)">
            {{ mode() === 'form' ? 'New learning project' : 'Building lesson…' }}
          </h1>
        </header>

        @if (mode() === 'form') {
          @if (!configured()) {
            <a
              routerLink="/settings"
              class="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
              style="background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn)"
            >
              <ng-icon name="lucideTriangleAlert" size="16" />
              Connect your gateway in Settings before generating.
            </a>
          }

          <section
            class="rounded-2xl p-5 flex flex-col gap-5"
            style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
          >
            <div class="flex flex-col gap-1.5">
              <label
                for="topic"
                class="text-xs font-semibold uppercase tracking-wide"
                style="color:var(--muted)"
              >
                What do you want to learn?
              </label>
              <input
                id="topic"
                name="topic"
                type="text"
                autocomplete="off"
                placeholder="e.g. Rust ownership & borrowing"
                class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none"
                style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
                [(ngModel)]="topic"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label
                for="why"
                class="text-xs font-semibold uppercase tracking-wide"
                style="color:var(--muted)"
              >
                Why — your real reason <span style="color:var(--line)">(optional)</span>
              </label>
              <textarea
                id="why"
                name="why"
                rows="2"
                placeholder="Ship a small CLI to my team without fighting the borrow checker."
                class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
                [(ngModel)]="why"
              ></textarea>
            </div>

            <div class="flex flex-col gap-1.5">
              <label
                for="success"
                class="text-xs font-semibold uppercase tracking-wide"
                style="color:var(--muted)"
              >
                Success looks like <span style="color:var(--line)">(optional)</span>
              </label>
              <textarea
                id="success"
                name="success"
                rows="2"
                placeholder="I can read and write idiomatic borrow-checked code."
                class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
                [(ngModel)]="successLooksLike"
              ></textarea>
            </div>

            <div class="flex flex-col gap-1.5">
              <label
                for="constraints"
                class="text-xs font-semibold uppercase tracking-wide"
                style="color:var(--muted)"
              >
                Constraints <span style="color:var(--line)">(optional)</span>
              </label>
              <textarea
                id="constraints"
                name="constraints"
                rows="2"
                placeholder="Short lessons — I only have 10 minutes at a time."
                class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none resize-none"
                style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
                [(ngModel)]="constraints"
              ></textarea>
            </div>

            <button
              type="button"
              class="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style="background:var(--accent)"
              [disabled]="!topic.trim()"
              (click)="start()"
            >
              <ng-icon name="lucideWandSparkles" size="16" /> Generate first lesson
            </button>
          </section>
        } @else {
          <section
            class="rounded-2xl p-5"
            style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
          >
            <app-generation-progress
              [phase]="phase()"
              [plan]="plan()"
              [error]="error()"
              (retry)="run()"
            />
          </section>
        }
      </div>
    </main>
  `,
})
export class NewProjectComponent {
  private readonly gateway = inject(GatewayService);
  private readonly settings = inject(SettingsService);
  private readonly db = inject(DbService);
  private readonly router = inject(Router);

  protected topic = '';
  protected why = '';
  protected successLooksLike = '';
  protected constraints = '';

  protected readonly mode = signal<'form' | 'running'>('form');
  protected readonly phase = signal<Phase | null>(null);
  protected readonly plan = signal<LessonPlan | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly configured = computed(() => this.settings.isConfigured());

  private requestId = '';

  protected start(): void {
    if (!this.topic.trim()) return;
    this.requestId = crypto.randomUUID();
    this.mode.set('running');
    void this.run();
  }

  protected async run(): Promise<void> {
    this.phase.set(null);
    this.plan.set(null);
    this.error.set(null);

    const mission = this.mission();
    const input: GenerateProjectInput = {
      topic: mission.topic,
      why: mission.why,
      successLooksLike: mission.successLooksLike,
      constraints: mission.constraints,
    };

    for await (const event of this.gateway.generateProject(input, this.requestId)) {
      switch (event.type) {
        case 'phase':
          this.phase.set(event.phase);
          break;
        case 'plan':
          this.plan.set(event.plan);
          break;
        case 'done': {
          const saved = await this.db.saveGeneratedProject(mission, event);
          await this.router.navigate(['/lesson', saved.lessonId]);
          return;
        }
        case 'error':
          this.error.set(event.message);
          return;
      }
    }
  }

  private mission(): ProjectMission {
    return {
      topic: this.topic.trim(),
      why: blankToUndefined(this.why),
      successLooksLike: blankToUndefined(this.successLooksLike),
      constraints: blankToUndefined(this.constraints),
    };
  }
}

function blankToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
