import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FastifyRequest } from 'fastify';
import { AppConfigService } from '../config/config.service';
import { IS_PUBLIC_KEY } from './public.decorator';

// A single static bearer token guards every route except those marked @Public().
// The private network (intranet + Tailscale) is the real boundary; this stops
// stray calls.
@Injectable()
export class AuthGuard implements CanActivate {
  private readonly expected: string;

  constructor(
    private readonly reflector: Reflector,
    config: AppConfigService,
  ) {
    this.expected = `Bearer ${config.gatewayToken}`;
  }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<FastifyRequest>();
    if (req.method === 'OPTIONS') return true;

    if (req.headers.authorization !== this.expected) {
      throw new UnauthorizedException('unauthorized');
    }
    return true;
  }
}
