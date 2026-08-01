import { Module } from '@nestjs/common';
import { GenerationController } from './generation.controller';
import { GenerationService } from './generation.service';

// The Teacher: the agentic loop that authors lessons (and, next, chats). Injects
// the global LLM_PROVIDER and WorkspaceService.
@Module({
  controllers: [GenerationController],
  providers: [GenerationService],
})
export class TeachingModule {}
