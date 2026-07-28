import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { SettingsService } from '../core/settings/settings.service';

export interface HealthResponse {
  status: string;
}

@Injectable({ providedIn: 'root' })
export class GatewayService {
  private readonly http = inject(HttpClient);
  private readonly settings = inject(SettingsService);

  async health(): Promise<HealthResponse> {
    return firstValueFrom(
      this.http.get<HealthResponse>(this.url('/health'), { headers: this.authHeaders() }),
    );
  }

  private url(path: string): string {
    const base = this.settings.baseUrl();
    if (!base) throw new Error('Gateway base URL is not configured.');
    return `${base}${path}`;
  }

  private authHeaders(): HttpHeaders {
    const token = this.settings.bearerToken();
    let headers = new HttpHeaders();
    if (token) headers = headers.set('Authorization', `Bearer ${token}`);
    return headers;
  }
}
