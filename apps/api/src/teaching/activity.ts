export interface ToolActivity {
  kind: 'search' | 'read';
  detail: string;
}

// Translate a research/lookup tool call into a human feed line so a silent wait
// becomes legible: web search carries a query; web fetch and read_lesson carry
// the thing being opened. Tools with no reader-facing action return undefined.
export function describeToolActivity(toolName: string, input: unknown): ToolActivity | undefined {
  const args = (input ?? {}) as { query?: unknown; url?: unknown; slug?: unknown };
  const name = toolName.toLowerCase();
  if (name.includes('search') && typeof args.query === 'string' && args.query.trim()) {
    return { kind: 'search', detail: args.query.trim() };
  }
  if (name.includes('fetch') && typeof args.url === 'string' && args.url.trim()) {
    return { kind: 'read', detail: prettyUrl(args.url.trim()) };
  }
  if (toolName === 'read_lesson' && typeof args.slug === 'string' && args.slug.trim()) {
    return { kind: 'read', detail: `earlier lesson · ${args.slug.trim()}` };
  }
  return undefined;
}

function prettyUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
