import { Body, Controller, Post, Req, Res } from '@nestjs/common';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { startSse } from '../common/sse';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ChatRequestSchema, type ChatRequest } from './chat.dto';
import { ChatService } from './chat.service';

const HEARTBEAT_MS = 15000;

@Controller('chat')
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post()
  async send(
    @Body(new ZodValidationPipe(ChatRequestSchema)) body: ChatRequest,
    @Req() req: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const sse = startSse(reply, req);
    const heartbeat = setInterval(() => sse.comment('keepalive'), HEARTBEAT_MS);
    try {
      await this.chat.chat(body.projectId, body.message, (event) => sse.event(event.type, event));
    } catch {
      if (!sse.closed) sse.event('error', { type: 'error', message: 'chat failed' });
    } finally {
      clearInterval(heartbeat);
      sse.end();
    }
  }
}
