import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';

export interface SportScoreJobLeaseOptions {
  dataRoot: string;
  staleAfterMs?: number;
  now?: () => Date;
}

export type SportScoreLeaseResult<T> =
  | { acquired: true; value: T }
  | { acquired: false };

export class SportScoreJobLease {
  private readonly lockPath: string;
  private readonly staleAfterMs: number;
  private readonly now: () => Date;

  constructor(options: SportScoreJobLeaseOptions) {
    this.lockPath = path.resolve(
      options.dataRoot,
      'providers',
      'sportscore',
      'state',
      'daily-sync.lock'
    );
    this.staleAfterMs = options.staleAfterMs ?? 5 * 60_000;
    this.now = options.now ?? (() => new Date());
    if (!Number.isInteger(this.staleAfterMs) || this.staleAfterMs < 1) {
      throw new Error('SportScore lease staleAfterMs must be a positive integer.');
    }
  }

  async tryWithLease<T>(operation: () => Promise<T>): Promise<SportScoreLeaseResult<T>> {
    const release = await this.tryAcquire();
    if (!release) return { acquired: false };
    try {
      return { acquired: true, value: await operation() };
    } finally {
      await release();
    }
  }

  private async tryAcquire(): Promise<(() => Promise<void>) | null> {
    await mkdir(path.dirname(this.lockPath), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const lockId = randomUUID();
      try {
        const handle = await open(this.lockPath, 'wx');
        try {
          const now = this.now();
          await handle.writeFile(JSON.stringify({
            id: lockId,
            pid: process.pid,
            createdAt: now.toISOString(),
            expiresAt: new Date(now.getTime() + this.staleAfterMs).toISOString()
          }), 'utf8');
        } finally {
          await handle.close();
        }
        return this.releaseFor(lockId);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        if (attempt === 0 && await this.removeStaleLease()) continue;
        return null;
      }
    }
    return null;
  }

  private releaseFor(lockId: string): () => Promise<void> {
    let released = false;
    return async () => {
      if (released) return;
      released = true;
      try {
        const parsed = JSON.parse(await readFile(this.lockPath, 'utf8')) as { id?: string };
        if (parsed.id === lockId) await unlink(this.lockPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    };
  }

  private async removeStaleLease(): Promise<boolean> {
    try {
      const parsed = JSON.parse(await readFile(this.lockPath, 'utf8')) as {
        pid?: number;
        expiresAt?: string;
      };
      if (typeof parsed.pid === 'number' && isProcessAlive(parsed.pid)) return false;
      if (
        typeof parsed.expiresAt === 'string'
        && Date.parse(parsed.expiresAt) <= this.now().getTime()
      ) {
        await unlink(this.lockPath);
        return true;
      }
      return false;
    } catch {
      try {
        const fileStat = await stat(this.lockPath);
        if (this.now().getTime() - fileStat.mtimeMs > this.staleAfterMs) {
          await unlink(this.lockPath);
          return true;
        }
      } catch {
        return true;
      }
      return false;
    }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}
