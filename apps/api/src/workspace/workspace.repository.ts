import { BadRequestException, Injectable } from '@nestjs/common';
import { promises as fs } from 'node:fs';
import { randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { AppConfigService } from '../config/config.service';
import { gitCommitAll, gitInit, gitLastCommitIso } from './git';

function isNotFound(err: unknown): boolean {
  return (err as NodeJS.ErrnoException).code === 'ENOENT';
}

const SAFE_ID = /^[A-Za-z0-9_-]+$/;

// Low-level, path-safe file + git access scoped to one project directory under
// WORKSPACE_ROOT. Knows nothing about the canonical workspace files — that's the
// service's job.
@Injectable()
export class WorkspaceRepository {
  private readonly root: string;

  constructor(config: AppConfigService) {
    this.root = path.resolve(config.workspaceRoot);
  }

  projectDir(projectId: string): string {
    if (!SAFE_ID.test(projectId)) {
      throw new BadRequestException('invalid project id');
    }
    const dir = path.resolve(this.root, projectId);
    if (path.dirname(dir) !== this.root) {
      throw new BadRequestException('invalid project id');
    }
    return dir;
  }

  async createProject(projectId: string): Promise<void> {
    const dir = this.projectDir(projectId);
    await fs.mkdir(path.join(dir, 'lessons'), { recursive: true });
    await gitInit(dir);
  }

  async deleteProject(projectId: string): Promise<void> {
    await fs.rm(this.projectDir(projectId), { recursive: true, force: true });
  }

  async projectExists(projectId: string): Promise<boolean> {
    try {
      const s = await fs.stat(this.projectDir(projectId));
      return s.isDirectory();
    } catch {
      return false;
    }
  }

  async listProjectIds(): Promise<string[]> {
    let entries: import('node:fs').Dirent[];
    try {
      entries = await fs.readdir(this.root, { withFileTypes: true });
    } catch {
      return [];
    }
    return entries.filter((e) => e.isDirectory() && SAFE_ID.test(e.name)).map((e) => e.name);
  }

  async exists(projectId: string, relPath: string): Promise<boolean> {
    try {
      await fs.stat(this.safePath(projectId, relPath));
      return true;
    } catch {
      return false;
    }
  }

  async readFile(projectId: string, relPath: string): Promise<string | undefined> {
    try {
      return await fs.readFile(this.safePath(projectId, relPath), 'utf8');
    } catch (err) {
      // Genuine absence is undefined; a real IO error must surface, so a
      // transient read failure never masquerades as "no such file" and, e.g.,
      // resets lesson numbering.
      if (isNotFound(err)) return undefined;
      throw err;
    }
  }

  // Write via a temp file + rename so a concurrent reader never sees a partial
  // write (rename is atomic on the same filesystem).
  async writeFile(projectId: string, relPath: string, content: string): Promise<void> {
    const target = this.safePath(projectId, relPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    const tmp = `${target}.${randomUUID()}.tmp`;
    await fs.writeFile(tmp, content, 'utf8');
    await fs.rename(tmp, target);
  }

  async appendFile(projectId: string, relPath: string, content: string): Promise<void> {
    const target = this.safePath(projectId, relPath);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.appendFile(target, content, 'utf8');
  }

  async listFiles(projectId: string, subdir = '.'): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.safePath(projectId, subdir), { withFileTypes: true });
      return entries.filter((e) => e.isFile()).map((e) => e.name);
    } catch {
      return [];
    }
  }

  async commit(projectId: string, message: string): Promise<boolean> {
    return gitCommitAll(this.projectDir(projectId), message);
  }

  async createdAt(projectId: string): Promise<string> {
    const s = await fs.stat(this.projectDir(projectId));
    return s.birthtime.toISOString();
  }

  async updatedAt(projectId: string): Promise<string> {
    const dir = this.projectDir(projectId);
    const last = await gitLastCommitIso(dir);
    if (last) return last;
    return (await fs.stat(dir)).mtime.toISOString();
  }

  // Lexical containment check. The write API can't create symlinks, so a
  // symlink escape would require something external planting one under
  // WORKSPACE_ROOT — out of scope for a single-user home-lab deployment.
  private safePath(projectId: string, relPath: string): string {
    const dir = this.projectDir(projectId);
    const target = path.resolve(dir, relPath);
    if (target !== dir && !target.startsWith(dir + path.sep)) {
      throw new BadRequestException('path escapes the project workspace');
    }
    return target;
  }
}
