import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCheck,
  lucideKey,
  lucideLink,
  lucideLoaderCircle,
  lucideSettings,
  lucideTriangleAlert,
  lucideX,
  lucideZap,
} from '@ng-icons/lucide';
import { GatewayService } from '../../api/gateway.service';
import { SettingsService } from '../../core/settings/settings.service';

type TestState =
  | { kind: 'idle' }
  | { kind: 'testing' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string };

@Component({
  selector: 'app-settings',
  imports: [FormsModule, NgIcon],
  viewProviders: [
    provideIcons({
      lucideSettings,
      lucideLink,
      lucideKey,
      lucideZap,
      lucideCheck,
      lucideX,
      lucideTriangleAlert,
      lucideLoaderCircle,
    }),
  ],
  template: `
    <main class="min-h-dvh w-full flex justify-center px-4 py-8" style="background:var(--bg)">
      <div class="w-full max-w-lg flex flex-col gap-6">
        <header class="flex items-center gap-3">
          <span
            class="grid place-items-center w-10 h-10 rounded-xl text-white"
            style="background:var(--accent)"
          >
            <ng-icon name="lucideSettings" size="20" />
          </span>
          <div>
            <h1 class="text-lg font-bold tracking-tight" style="color:var(--ink)">Settings</h1>
            <p class="text-sm" style="color:var(--muted)">Connect Pocket Teach to your generation gateway.</p>
          </div>
        </header>

        <section
          class="rounded-2xl p-5 flex flex-col gap-5"
          style="background:var(--panel);border:1px solid var(--line);box-shadow:var(--shadow)"
        >
          <div class="flex flex-col gap-1.5">
            <label for="baseUrl" class="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style="color:var(--muted)">
              <ng-icon name="lucideLink" size="13" /> Gateway base URL
            </label>
            <input
              id="baseUrl"
              name="baseUrl"
              type="url"
              inputmode="url"
              autocomplete="off"
              spellcheck="false"
              placeholder="https://gateway.example.com"
              class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
              style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
              [(ngModel)]="baseUrl"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="token" class="text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5" style="color:var(--muted)">
              <ng-icon name="lucideKey" size="13" /> Bearer token
            </label>
            <input
              id="token"
              name="token"
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="Paste your API token"
              class="w-full rounded-xl px-3.5 py-2.5 text-sm outline-none transition-colors"
              style="background:var(--bg);border:1px solid var(--line);color:var(--ink)"
              [(ngModel)]="bearerToken"
            />
          </div>

          @if (test().kind !== 'idle') {
            <div
              class="flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
              [style]="bannerStyle()"
            >
              @switch (test().kind) {
                @case ('testing') {
                  <ng-icon name="lucideLoaderCircle" size="16" class="animate-spin" />
                  <span>Testing connection…</span>
                }
                @case ('ok') {
                  <ng-icon name="lucideCheck" size="16" />
                  <span>{{ testMessage() }}</span>
                }
                @case ('error') {
                  <ng-icon name="lucideTriangleAlert" size="16" />
                  <span>{{ testMessage() }}</span>
                }
              }
            </div>
          }

          <div class="flex gap-3 pt-1">
            <button
              type="button"
              class="flex-1 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50"
              style="background:var(--accent)"
              [disabled]="!baseUrl.trim() || test().kind === 'testing'"
              (click)="testConnection()"
            >
              <ng-icon name="lucideZap" size="16" /> Test connection
            </button>
            <button
              type="button"
              class="rounded-xl px-4 py-2.5 text-sm font-semibold transition-opacity disabled:opacity-50"
              style="background:transparent;border:1px solid var(--accent);color:var(--accent)"
              [disabled]="test().kind === 'testing'"
              (click)="save()"
            >
              Save
            </button>
          </div>

          @if (saved()) {
            <p class="text-xs" style="color:var(--accent-2)">Settings saved on this device.</p>
          }
        </section>
      </div>
    </main>
  `,
})
export class SettingsComponent {
  private readonly settings = inject(SettingsService);
  private readonly gateway = inject(GatewayService);

  protected baseUrl = '';
  protected bearerToken = '';
  protected readonly test = signal<TestState>({ kind: 'idle' });
  protected readonly saved = signal(false);

  protected readonly testMessage = computed(() => {
    const state = this.test();
    return state.kind === 'ok' || state.kind === 'error' ? state.message : '';
  });

  protected readonly bannerStyle = computed(() => {
    const kind = this.test().kind;
    if (kind === 'ok') return 'background:color-mix(in srgb,var(--accent-2) 14%,transparent);color:var(--accent-2)';
    if (kind === 'error') return 'background:color-mix(in srgb,var(--warn) 14%,transparent);color:var(--warn)';
    return 'background:var(--chip);color:var(--muted)';
  });

  constructor() {
    effect(() => {
      if (!this.settings.loaded()) return;
      const current = this.settings.settings();
      this.baseUrl = current.baseUrl;
      this.bearerToken = current.bearerToken;
    });
  }

  protected async save(): Promise<void> {
    await this.persist();
    this.saved.set(true);
  }

  protected async testConnection(): Promise<void> {
    this.saved.set(false);
    this.test.set({ kind: 'testing' });
    await this.persist();
    try {
      const res = await this.gateway.health();
      this.test.set({ kind: 'ok', message: `Connected — gateway reports "${res.status}".` });
    } catch (err) {
      this.test.set({ kind: 'error', message: this.describe(err) });
    }
  }

  private async persist(): Promise<void> {
    await this.settings.save({
      baseUrl: this.baseUrl,
      bearerToken: this.bearerToken,
      provider: 'claude',
    });
  }

  private describe(err: unknown): string {
    if (typeof err === 'object' && err !== null && 'status' in err) {
      const status = (err as { status: number }).status;
      if (status === 0) return 'Could not reach the gateway. Check the URL and that it is running.';
      if (status === 401 || status === 403) return 'Gateway rejected the token (unauthorized).';
      return `Gateway responded with HTTP ${status}.`;
    }
    return 'Connection failed. Check the base URL and try again.';
  }
}
