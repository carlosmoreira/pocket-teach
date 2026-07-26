import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Backup blob store. A tiny endpoint accepts/returns the app's workspace backup
 * blob for off-device recovery. Barely any state: a single latest blob
 * persisted to a gitignored `data/` dir, with an in-memory fallback if the disk
 * isn't writable.
 */

const DATA_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'data',
);
const BACKUP_PATH = join(DATA_DIR, 'backup.json');

export interface BackupStore {
  save(blob: unknown): void;
  load(): unknown | undefined;
}

export class FileBackupStore implements BackupStore {
  private memory: unknown | undefined;
  private diskOk = true;

  constructor() {
    try {
      mkdirSync(DATA_DIR, { recursive: true });
    } catch {
      this.diskOk = false;
    }
  }

  save(blob: unknown): void {
    this.memory = blob;
    if (!this.diskOk) return;
    try {
      writeFileSync(BACKUP_PATH, JSON.stringify(blob), 'utf8');
    } catch {
      this.diskOk = false;
    }
  }

  load(): unknown | undefined {
    if (this.diskOk && existsSync(BACKUP_PATH)) {
      try {
        return JSON.parse(readFileSync(BACKUP_PATH, 'utf8'));
      } catch {
        // fall through to memory
      }
    }
    return this.memory;
  }
}
