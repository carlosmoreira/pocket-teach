import { Component, computed, input, output } from '@angular/core';
import type { LessonPlan, Phase } from '@pocket-teach/api-types';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideLoaderCircle,
  lucideRotateCcw,
  lucideTriangleAlert,
} from '@ng-icons/lucide';

interface StepDef {
  phase: Phase;
  label: string;
  hint: string;
}

interface StepView extends StepDef {
  index: number;
  status: 'done' | 'now' | 'todo';
}

const STEP_DEFS: StepDef[] = [
  { phase: 'planning', label: 'Planning', hint: 'reading your mission & glossary' },
  { phase: 'researching', label: 'Researching', hint: 'grounding in trusted sources' },
  { phase: 'plan', label: 'Plan ready', hint: 'objective, quiz, primary source' },
  { phase: 'writing', label: 'Writing', hint: 'lesson HTML + quiz' },
  { phase: 'done', label: 'Done', hint: 'saving your lesson' },
];

const ORDER: Phase[] = ['planning', 'researching', 'plan', 'writing', 'done'];

@Component({
  selector: 'app-generation-progress',
  imports: [NgIcon],
  viewProviders: [
    provideIcons({ lucideCheck, lucideLoaderCircle, lucideTriangleAlert, lucideRotateCcw }),
  ],
  template: `
    <div class="flex flex-col gap-1">
      @for (step of steps(); track step.phase) {
        <div class="flex items-center gap-3 py-2.5">
          <span
            class="grid place-items-center w-7 h-7 rounded-full text-xs font-semibold shrink-0"
            [class.pt-step-pulse]="step.status === 'now' && !error()"
            [style]="dotStyle(step)"
          >
            @switch (step.status) {
              @case ('done') {
                <ng-icon name="lucideCheck" size="15" />
              }
              @case ('now') {
                @if (error()) {
                  <ng-icon name="lucideTriangleAlert" size="14" />
                } @else {
                  <ng-icon name="lucideLoaderCircle" size="14" class="animate-spin" />
                }
              }
              @default {
                {{ step.index + 1 }}
              }
            }
          </span>
          <span class="flex flex-col">
            <span
              class="text-sm font-semibold"
              [style.color]="step.status === 'todo' ? 'var(--muted)' : 'var(--ink)'"
            >
              {{ step.label }}
            </span>
            @if (step.hint && step.status !== 'todo') {
              <span class="text-xs" style="color:var(--muted)">{{ step.hint }}</span>
            }
          </span>
        </div>
      }
    </div>

    @if (plan(); as p) {
      <div
        class="mt-4 rounded-xl px-3.5 py-3 text-sm"
        style="background:var(--chip);border:1px solid var(--line);color:var(--muted)"
      >
        <span class="font-semibold" style="color:var(--ink)">Preview · </span>{{ p.objective }}
      </div>
    }

    @if (error(); as message) {
      <div
        class="mt-4 flex flex-col gap-3 rounded-xl px-3.5 py-3 text-sm"
        style="background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn)"
      >
        <span class="flex items-center gap-2">
          <ng-icon name="lucideTriangleAlert" size="16" />
          {{ message }}
        </span>
        <button
          type="button"
          class="flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white"
          style="background:var(--accent)"
          (click)="retry.emit()"
        >
          <ng-icon name="lucideRotateCcw" size="16" /> Retry
        </button>
      </div>
    }
  `,
})
export class GenerationProgressComponent {
  readonly phase = input<Phase | null>(null);
  readonly plan = input<LessonPlan | null>(null);
  readonly error = input<string | null>(null);
  readonly retry = output<void>();

  protected readonly steps = computed<StepView[]>(() => {
    const current = this.phase();
    const currentIndex = current ? ORDER.indexOf(current) : -1;
    return STEP_DEFS.map((def, index) => ({
      ...def,
      index,
      status: this.statusFor(index, currentIndex, current),
    }));
  });

  private statusFor(
    index: number,
    currentIndex: number,
    current: Phase | null,
  ): 'done' | 'now' | 'todo' {
    if (current === 'done') return 'done';
    if (index < currentIndex) return 'done';
    if (index === currentIndex) return 'now';
    return 'todo';
  }

  protected dotStyle(step: StepView): string {
    if (step.status === 'done')
      return 'background:var(--accent-2);border:2px solid var(--accent-2);color:#fff';
    if (step.status === 'now') {
      const color = this.error() ? 'var(--warn)' : 'var(--accent)';
      return `border:2px solid ${color};color:${color}`;
    }
    return 'border:2px solid var(--line);color:var(--muted)';
  }
}
