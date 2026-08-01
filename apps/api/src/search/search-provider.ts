import { Injectable } from '@nestjs/common';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

// Grounding for Providers without native web search. Claude grounds via its own
// web tools (see the Provider seam), so this stays a no-op until a Provider that
// needs it (e.g. a local model) arrives, when a real backend (Tavily/Brave) is
// dropped in here.
export interface SearchProvider {
  readonly id: string;
  search(query: string): Promise<SearchResult[]>;
}

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');

@Injectable()
export class NoopSearchProvider implements SearchProvider {
  readonly id = 'noop';

  async search(): Promise<SearchResult[]> {
    return [];
  }
}
