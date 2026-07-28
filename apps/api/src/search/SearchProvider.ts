export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  readonly id: string;
  search(query: string): Promise<SearchResult[]>;
}

export class NoopSearchProvider implements SearchProvider {
  readonly id = 'noop';

  // TODO(chunk-2): implement Claude native web_search grounding (bounded, no filesystem).
  async search(_query: string): Promise<SearchResult[]> {
    return [];
  }
}
