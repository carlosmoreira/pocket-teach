import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { DbService } from '../../data/db.service';
import type { Lesson } from '../../data/models';

@Component({
  selector: 'app-lesson',
  imports: [RouterLink, NgIcon],
  viewProviders: [provideIcons({ lucideArrowLeft })],
  template: `
    <main class="h-dvh w-full flex flex-col" style="background:var(--bg)">
      <header
        class="flex items-center gap-3 px-4 py-3 shrink-0"
        style="background:var(--panel);border-bottom:1px solid var(--line)"
      >
        <a
          [routerLink]="backLink()"
          class="grid place-items-center w-9 h-9 rounded-xl shrink-0"
          style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
          aria-label="Back"
        >
          <ng-icon name="lucideArrowLeft" size="18" />
        </a>
        <h1 class="text-sm font-bold tracking-tight truncate" style="color:var(--ink)">
          {{ lesson()?.title ?? 'Lesson' }}
        </h1>
      </header>

      @if (srcdoc(); as html) {
        <iframe
          class="flex-1 w-full border-0"
          [srcdoc]="html"
          sandbox="allow-scripts"
          title="Lesson"
        ></iframe>
      } @else if (loaded()) {
        <p class="p-4 text-sm" style="color:var(--muted)">Lesson not found.</p>
      }
    </main>
  `,
})
export class LessonComponent implements OnInit {
  private readonly db = inject(DbService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly id = input.required<string>();

  protected readonly lesson = signal<Lesson | undefined>(undefined);
  protected readonly srcdoc = signal<SafeHtml | null>(null);
  protected readonly loaded = signal(false);

  async ngOnInit(): Promise<void> {
    const lesson = await this.db.getLesson(this.id());
    this.lesson.set(lesson);
    if (lesson) this.srcdoc.set(this.sanitizer.bypassSecurityTrustHtml(lesson.html));
    this.loaded.set(true);
  }

  protected backLink(): unknown[] {
    const projectId = this.lesson()?.projectId;
    return projectId ? ['/project', projectId] : ['/library'];
  }
}
