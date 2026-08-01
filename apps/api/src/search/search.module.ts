import { Global, Module } from '@nestjs/common';
import { NoopSearchProvider, SEARCH_PROVIDER } from './search-provider';

@Global()
@Module({
  providers: [{ provide: SEARCH_PROVIDER, useClass: NoopSearchProvider }],
  exports: [SEARCH_PROVIDER],
})
export class SearchModule {}
