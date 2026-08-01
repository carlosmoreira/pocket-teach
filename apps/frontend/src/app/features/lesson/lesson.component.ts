import { Component, OnInit, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DomSanitizer, type SafeHtml } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeft } from '@ng-icons/lucide';
import { ApiService } from '../../api/api.service';
import { DbService } from '../../data/db.service';

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
          [routerLink]="['/project', projectId()]"
          class="grid place-items-center w-9 h-9 rounded-xl shrink-0"
          style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
          aria-label="Back"
        >
          <ng-icon name="lucideArrowLeft" size="18" />
        </a>
        <h1 class="text-sm font-bold tracking-tight truncate" style="color:var(--ink)">
          {{ title() }}
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
        <p class="p-4 text-sm" style="color:var(--muted)">
          {{ error() ?? 'Lesson not found.' }}
        </p>
      }
    </main>
  `,
})
export class LessonComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly db = inject(DbService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly projectId = input.required<string>();
  readonly slug = input.required<string>();

  protected readonly title = signal('Lesson');
  protected readonly srcdoc = signal<SafeHtml | null>(null);
  protected readonly loaded = signal(false);
  protected readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    // Offline replica first, so a saved lesson reads without the backend.
    const cached = await this.db.getCachedLesson(this.projectId(), this.slug());
    if (cached) {
      this.title.set(cached.title);
      if (cached.html) this.render(cached.html);
    }

    try {
      const body = await this.api.getLesson(this.projectId(), this.slug());
      this.title.set(body.title);
      this.render(body.html);
      await this.db.cacheLesson({
        projectId: this.projectId(),
        slug: this.slug(),
        seq: body.seq,
        title: body.title,
        recap: body.recap,
        html: body.html,
      });
    } catch (err) {
      // Only an error if we have nothing rendered (no cached html and offline).
      if (!this.srcdoc()) {
        this.error.set(err instanceof Error ? err.message : 'Could not load the lesson.');
      }
    } finally {
      this.loaded.set(true);
    }
  }

  private render(html: string): void {
    this.srcdoc.set(this.sanitizer.bypassSecurityTrustHtml(html));
  }
}
