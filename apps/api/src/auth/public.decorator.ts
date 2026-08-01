import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

// Marks a route as reachable without the bearer token (e.g. the healthcheck).
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
