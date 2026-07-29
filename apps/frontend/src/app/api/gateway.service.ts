import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ChatEvent,
  ChatRequest,
  ErrorEvent,
  GenerateProjectRequest,
  SseEvent,
} from '@pocket-teach/api-types';
import { SettingsService } from '../core/settings/settings.service';

export interface HealthResponse {
  status: string;
}

export interface GenerateProjectInput {
  topic: string;
  why?: string;
  successLooksLike?: string;
  constraints?: string;
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

  generateProject(
    input: GenerateProjectInput,
    requestId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<SseEvent> {
    const body: GenerateProjectRequest = { ...input, requestId };
    return this.streamEvents('/generate/project', body, parseSseFrame, sseError, signal);
  }

  chat(request: ChatRequest, signal?: AbortSignal): AsyncGenerator<ChatEvent> {
    return this.streamEvents('/chat', request, parseChatFrame, chatError, signal);
  }

  private async *streamEvents<T>(
    path: string,
    body: unknown,
    parse: (frame: string) => T | null,
    errorFor: (message: string) => T,
    signal?: AbortSignal,
  ): AsyncGenerator<T> {
    let response: Response;
    try {
      response = await fetch(this.url(path), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.authRecord() },
        body: JSON.stringify(body),
        signal,
      });
    } catch {
      if (signal?.aborted) return;
      yield errorFor(NETWORK_MESSAGE);
      return;
    }

    if (!response.ok || !response.body) {
      yield errorFor(await httpErrorMessage(response));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, sep);
          buffer = buffer.slice(sep + 2);
          const event = parse(frame);
          if (event) yield event;
        }
      }
    } catch {
      if (signal?.aborted) return;
      yield errorFor(NETWORK_MESSAGE);
    }
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

  private authRecord(): Record<string, string> {
    const token = this.settings.bearerToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

const NETWORK_MESSAGE = 'Could not reach the gateway. Check the URL and that it is running.';

function frameData(frame: string): unknown {
  const dataLines: string[] = [];
  for (const line of frame.split('\n')) {
    if (line.startsWith('data:')) dataLines.push(line.slice(5).replace(/^ /, ''));
  }
  if (dataLines.length === 0) return undefined;
  try {
    return JSON.parse(dataLines.join('\n'));
  } catch {
    return undefined;
  }
}

function frameType(parsed: unknown): string | null {
  if (!parsed || typeof parsed !== 'object' || !('type' in parsed)) return null;
  return String((parsed as { type: unknown }).type);
}

function parseSseFrame(frame: string): SseEvent | null {
  const parsed = frameData(frame);
  const type = frameType(parsed);
  if (type !== 'phase' && type !== 'plan' && type !== 'done' && type !== 'error') return null;
  return parsed as SseEvent;
}

const CHAT_EVENT_TYPES = ['message', 'tool_call', 'proposal', 'record', 'done', 'error'];

function parseChatFrame(frame: string): ChatEvent | null {
  const parsed = frameData(frame);
  const type = frameType(parsed);
  if (type === null || !CHAT_EVENT_TYPES.includes(type)) return null;
  return parsed as ChatEvent;
}

function sseError(message: string): ErrorEvent {
  return { type: 'error', message };
}

function chatError(message: string): ChatEvent {
  return { type: 'error', message };
}

async function httpErrorMessage(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) {
    return 'Gateway rejected the token (unauthorized).';
  }
  let detail = '';
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'error' in body) {
      const value = (body as { error: unknown }).error;
      if (typeof value === 'string') detail = ` — ${value}`;
    }
  } catch {
    /* body was not JSON */
  }
  return `Gateway responded with HTTP ${response.status}${detail}.`;
}
