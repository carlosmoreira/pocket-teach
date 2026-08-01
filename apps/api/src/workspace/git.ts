import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

// A workspace is a git repo so the Teacher's edits get history and rollback,
// and the directory is trivially backed up. We shell out to git (installed in
// the image) rather than take a dependency.

export async function gitInit(dir: string): Promise<void> {
  await run('git', ['init', '-q'], { cwd: dir });
  await run('git', ['config', 'user.email', 'teacher@pocket-teach.local'], { cwd: dir });
  await run('git', ['config', 'user.name', 'Pocket Teach'], { cwd: dir });
}

// Stage everything and commit. Returns false when there was nothing to commit,
// so callers can commit freely without worrying about empty commits.
export async function gitCommitAll(dir: string, message: string): Promise<boolean> {
  await run('git', ['add', '-A'], { cwd: dir });
  const { stdout } = await run('git', ['status', '--porcelain'], { cwd: dir });
  if (!stdout.trim()) return false;
  await run('git', ['commit', '-q', '-m', message], { cwd: dir });
  return true;
}

export async function gitLastCommitIso(dir: string): Promise<string | undefined> {
  try {
    const { stdout } = await run('git', ['log', '-1', '--format=%cI'], { cwd: dir });
    return stdout.trim() || undefined;
  } catch {
    return undefined;
  }
}
