import { Module } from '@nestjs/common';
import { AppConfigModule } from './config/config.module';
import { HealthModule } from './health/health.module';
import { ProvidersModule } from './providers/providers.module';
import { SearchModule } from './search/search.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { TeachingModule } from './teaching/teaching.module';
import { ProjectsModule } from './projects/projects.module';

@Module({
  imports: [
    AppConfigModule,
    ProvidersModule,
    SearchModule,
    WorkspaceModule,
    TeachingModule,
    ProjectsModule,
    HealthModule,
  ],
})
export class AppModule {}
