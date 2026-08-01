import { Module } from '@nestjs/common';
import { ProjectsController } from './projects.controller';

// Injects the global WorkspaceService; no own providers.
@Module({
  controllers: [ProjectsController],
})
export class ProjectsModule {}
