import { Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { WorkspaceService } from '../workspace/workspace.service';
import type { StoredMessage } from '../teaching/chat.events';

// HTTP surface over the project Workspaces: the frontend lists/creates projects,
// reads a project's mission + lessons, syncs lesson bodies for offline reading,
// and fetches the transcript when online.
@Controller('projects')
export class ProjectsController {
  constructor(private readonly workspace: WorkspaceService) {}

  @Post()
  async create(): Promise<{ id: string }> {
    const id = randomUUID();
    await this.workspace.createProject(id);
    return { id };
  }

  @Get()
  list() {
    return this.workspace.listProjects();
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    await this.require(id);
    return {
      id,
      mission: await this.workspace.readMemory(id, 'mission'),
      roadmap: await this.workspace.readMemory(id, 'roadmap'),
      lessons: await this.workspace.listLessons(id),
    };
  }

  @Get(':id/lessons/:slug')
  async lesson(@Param('id') id: string, @Param('slug') slug: string) {
    await this.require(id);
    const html = await this.workspace.readLesson(id, slug);
    if (html === undefined) throw new NotFoundException('lesson not found');
    const summary = (await this.workspace.listLessons(id)).find(
      (l) => l.slug === slug || l.slug.replace(/^\d+-/, '') === slug,
    );
    return {
      slug: summary?.slug ?? slug,
      title: summary?.title ?? 'Lesson',
      seq: summary?.seq ?? 0,
      recap: summary?.recap ?? '',
      html,
    };
  }

  @Get(':id/transcript')
  async transcript(@Param('id') id: string): Promise<{ messages: StoredMessage[] }> {
    await this.require(id);
    return { messages: (await this.workspace.readTranscript(id)) as StoredMessage[] };
  }

  @Delete(':id')
  async remove(@Param('id') id: string): Promise<{ ok: true }> {
    await this.workspace.deleteProject(id);
    return { ok: true };
  }

  private async require(id: string): Promise<void> {
    if (!(await this.workspace.projectExists(id))) {
      throw new NotFoundException('project not found');
    }
  }
}
