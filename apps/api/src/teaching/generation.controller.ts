import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { startSse } from '../common/sse';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { GenerateLessonRequestSchema, type GenerateLessonRequest } from './generation.dto';
import { GenerationService } from './generation.service';

const HEARTBEAT_MS = 15000;

@Controller('generate')
export class GenerationController {
  constructor(private readonly generation: GenerationService) {}

  @Post('lesson')
  async lesson(
    @Body(new ZodValidationPipe(GenerateLessonRequestSchema)) body: GenerateLessonRequest,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const sse = startSse(reply, req);
    const heartbeat = setInterval(() => sse.comment('keepalive'), HEARTBEAT_MS);
    try {
      await this.generation.generate(
        body.projectId,
        { objective: body.objective, focus: body.focus, targetSlug: body.targetSlug },
        (event) => sse.event(event.type, event),
      );
    } catch {
      if (!sse.closed) sse.event('error', { type: 'error', message: 'generation failed' });
    } finally {
      clearInterval(heartbeat);
      sse.end();
    }
  }
}
