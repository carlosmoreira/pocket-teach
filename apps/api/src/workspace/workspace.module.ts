import { Global, Module } from '@nestjs/common';
import { WorkspaceRepository } from './workspace.repository';
import { WorkspaceService } from './workspace.service';

// Global so the Teaching domain can inject WorkspaceService without re-importing.
@Global()
@Module({
  providers: [WorkspaceRepository, WorkspaceService],
  exports: [WorkspaceService],
})
export class WorkspaceModule {}
