import { Injectable, computed, inject, signal } from '@angular/core';
import { DbService } from '../../data/db.service';
import type { LlmProvider, Settings } from '../../data/models';

export interface GatewaySettings {
  baseUrl: string;
  bearerToken: string;
  provider: LlmProvider;
}

const DEFAULTS: GatewaySettings = {
  baseUrl: '',
  bearerToken: '',
  provider: 'claude',
};

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private readonly db = inject(DbService);

  private readonly _settings = signal<GatewaySettings>(DEFAULTS);
  private readonly _loaded = signal(false);

  readonly settings = this._settings.asReadonly();
  readonly loaded = this._loaded.asReadonly();
  readonly baseUrl = computed(() => this._settings().baseUrl.trim());
  readonly bearerToken = computed(() => this._settings().bearerToken.trim());
  readonly isConfigured = computed(() => this.baseUrl().length > 0);

  async load(): Promise<void> {
    const stored = await this.db.loadSettings();
    if (stored) {
      this._settings.set({
        baseUrl: stored.baseUrl,
        bearerToken: stored.bearerToken,
        provider: stored.provider ?? 'claude',
      });
    }
    this._loaded.set(true);
  }

  async save(next: GatewaySettings): Promise<void> {
    const normalized: GatewaySettings = {
      baseUrl: next.baseUrl.trim().replace(/\/+$/, ''),
      bearerToken: next.bearerToken.trim(),
      provider: next.provider,
    };
    const record: Omit<Settings, 'id'> = normalized;
    await this.db.saveSettings(record);
    this._settings.set(normalized);
  }
}
