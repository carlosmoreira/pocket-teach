import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

// The Teacher: the agentic loops that author lessons and hold the conversation.
// Both inject the global LLM_PROVIDER and WorkspaceService.
@Module({
  controllers: [GenerationController, ChatController],
  providers: [GenerationService, ChatService],
})
export class TeachingModule {}
