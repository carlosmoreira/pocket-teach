import { Injectable, inject } from '@angular/core';
import { SettingsService } from '../core/settings/settings.service';
import type {
  ChatEvent,
  GenerationEvent,
  ProjectDetail,
  ProjectSummary,
  StoredMessage,
} from './contracts';

const NETWORK_MESSAGE =
  'Could not reach the backend. Check the URL in Settings and that it is running.';

export interface LessonBody {
  slug: string;
  title: string;
  seq: number;
  recap: string;
  html: string;
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly settings = inject(SettingsService);

  async health(): Promise<{ status: string }> {
    const res = await fetch(this.url('/health'), { headers: this.authHeaders() }).catch(() => {
      throw { status: 0 };
    });
    if (!res.ok) throw { status: res.status };
    return res.json() as Promise<{ status: string }>;
  }

  createProject(): Promise<{ id: string }> {
    return this.json('POST', '/projects');
  }

  listProjects(): Promise<ProjectSummary[]> {
    return this.json('GET', '/projects');
  }

  getProject(id: string): Promise<ProjectDetail> {
    return this.json('GET', `/projects/${id}`);
  }

  getLesson(projectId: string, slug: string): Promise<LessonBody> {
    return this.json('GET', `/projects/${projectId}/lessons/${slug}`);
  }

  async getTranscript(projectId: string): Promise<StoredMessage[]> {
    const res = await this.json<{ messages: StoredMessage[] }>(
      'GET',
      `/projects/${projectId}/transcript`,
    );
    return res.messages;
  }

  chat(
    projectId: string,
    message: string | undefined,
    signal?: AbortSignal,
  ): AsyncGenerator<ChatEvent> {
    return this.stream('/chat', { projectId, message }, isChatEvent, chatError, signal);
  }

  generateLesson(
    projectId: string,
    opts: { objective?: string; focus?: string },
    signal?: AbortSignal,
  ): AsyncGenerator<GenerationEvent> {
    return this.stream(
      '/generate/lesson',
      { projectId, ...opts },
      isGenerationEvent,
      genError,
      signal,
    );
  }

  private async json<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...this.authRecord() };
    // Only advertise a JSON body when there is one — Fastify 400s on an empty
    // body sent with Content-Type: application/json.
    let payload: string | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
    let res: Response;
    try {
      res = await fetch(this.url(path), { method, headers, body: payload });
    } catch {
      throw new Error(NETWORK_MESSAGE);
    }
    if (!res.ok) throw new Error(await httpErrorMessage(res));
    return res.json() as Promise<T>;
  }

  private async *stream<T>(
    path: string,
    body: unknown,
    accept: (value: unknown) => value is T,
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
          const parsed = frameData(frame);
          if (accept(parsed)) yield parsed;
        }
      }
    } catch {
      if (signal?.aborted) return;
      yield errorFor(NETWORK_MESSAGE);
    }
  }

  private url(path: string): string {
    const base = this.settings.baseUrl();
    if (!base) throw new Error('Backend URL is not configured.');
    return `${base}${path}`;
  }

  private authHeaders(): Record<string, string> {
    return this.authRecord();
  }

  private authRecord(): Record<string, string> {
    const token = this.settings.bearerToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

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

function eventType(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('type' in value)) return null;
  return String((value as { type: unknown }).type);
}

const CHAT_TYPES = ['message', 'proposal', 'record', 'done', 'error'];
function isChatEvent(value: unknown): value is ChatEvent {
  const type = eventType(value);
  return type !== null && CHAT_TYPES.includes(type);
}

const GENERATION_TYPES = ['phase', 'lesson', 'done', 'error'];
function isGenerationEvent(value: unknown): value is GenerationEvent {
  const type = eventType(value);
  return type !== null && GENERATION_TYPES.includes(type);
}

function chatError(message: string): ChatEvent {
  return { type: 'error', message };
}

function genError(message: string): GenerationEvent {
  return { type: 'error', message };
}

async function httpErrorMessage(response: Response): Promise<string> {
  if (response.status === 401 || response.status === 403) {
    return 'The backend rejected the token (unauthorized).';
  }
  if (response.status === 404) return 'Not found.';
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
  return `The backend responded with HTTP ${response.status}${detail}.`;
}
