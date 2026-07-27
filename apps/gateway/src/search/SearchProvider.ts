/**
 * Grounding seam. Grounding is a separate axis from the LLM provider: Claude's
 * native `web_search` for v1; Tavily/Brave later for providers without one.
 */

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  readonly id: string;
  search(query: string): Promise<SearchResult[]>;
}

/**
 * No-op search — the stub used in chunk 1. Returns nothing so the (stubbed)
 * planner falls back to its canned primary source.
 */
export class NoopSearchProvider implements SearchProvider {
  readonly id = 'noop';

  // TODO(chunk-2): implement Claude native web_search grounding (bounded, no filesystem).
  async search(_query: string): Promise<SearchResult[]> {
    return [];
  }
}
