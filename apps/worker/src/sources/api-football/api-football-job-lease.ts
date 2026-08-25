import { open, readFile, unlink, mkdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

export interface ApiFootballJobLeaseOptions {
  dataRoot: string;
  staleTimeoutMs?: number;
  lockTimeoutMs?: number;
  retryDelayMs?: number;
  now?: () => Date;
  sleepFn?: (ms: number) => Promise<void>;
}

export class ApiFootballJobLease {
  private readonly lockPath: string;
  private readonly staleTimeoutMs: number;
  private readonly lockTimeoutMs: number;
  private readonly retryDelayMs: number;
  private readonly now: () => Date;
  private readonly sleepFn: (ms: number) => Promise<void>;

  constructor(options: ApiFootballJobLeaseOptions) {
    const dataRoot = resolve(options.dataRoot);
    this.lockPath = join(dataRoot, 'api-football', 'publication.lock');
    this.staleTimeoutMs = options.staleTimeoutMs ?? 30_000;
    this.lockTimeoutMs = options.lockTimeoutMs ?? 20_000;
    this.retryDelayMs = options.retryDelayMs ?? 50;
    this.now = options.now ?? (() => new Date());
    this.sleepFn = options.sleepFn ?? ((ms: number) => new Promise((res) => setTimeout(res, ms)));
  }

  public async withLease<T>(operation: () => Promise<T>): Promise<T> {
    const release = await this.acquire();
    try {
      return await operation();
    } finally {
      await release();
    }
  }

  private async acquire(): Promise<() => Promise<void>> {
    const startTime = Date.now();
    await mkdir(dirname(this.lockPath), { recursive: true });

    while (true) {
      try {
        const lockId = randomUUID();
        const handle = await open(this.lockPath, 'wx');
        try {
          const lockInfo = JSON.stringify({
            pid: process.pid,
            createdAt: this.now().toISOString(),
            createdAtMs: Date.now(),
            id: lockId
          });
          await handle.writeFile(lockInfo, 'utf8');
        } finally {
          await handle.close().catch(() => {});
        }

        let released = false;
        return async () => {
          if (released) return;
          released = true;
          try {
            const currentLock = JSON.parse(await readFile(this.lockPath, 'utf8')) as { id?: string };
            if (currentLock.id === lockId) {
              await unlink(this.lockPath);
            }
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
          }
        };
      } catch (err: unknown) {
        const error = err as NodeJS.ErrnoException;
        if (error.code === 'EEXIST') {
          // Check for stale lock
          try {
            const content = await readFile(this.lockPath, 'utf8');
            const parsed = JSON.parse(content) as { pid?: number; createdAtMs?: number; createdAt?: string };
            const createdAtMs =
              typeof parsed.createdAtMs === 'number'
                ? parsed.createdAtMs
                : parsed.createdAt
                ? Date.parse(parsed.createdAt)
                : NaN;

            const ownerIsAlive = typeof parsed.pid === 'number' && isProcessAlive(parsed.pid);
            if (ownerIsAlive) {
              // A live owner keeps the lease regardless of its age.
            } else if (!Number.isNaN(createdAtMs)) {
              const lockAge = Date.now() - createdAtMs;
              if (lockAge > this.staleTimeoutMs) {
                await unlink(this.lockPath).catch(() => {});
                continue;
              }
            } else {
              const stats = await stat(this.lockPath);
              const lockAge = Date.now() - stats.mtimeMs;
              if (lockAge > this.staleTimeoutMs) {
                await unlink(this.lockPath).catch(() => {});
                continue;
              }
            }
          } catch {
            // Retry
            try {
              const stats = await stat(this.lockPath);
              const lockAge = Date.now() - stats.mtimeMs;
              if (lockAge > this.staleTimeoutMs) {
                await unlink(this.lockPath).catch(() => {});
                continue;
              }
            } catch {
              continue;
            }
          }

          const elapsed = Date.now() - startTime;
          if (elapsed > this.lockTimeoutMs) {
            throw new Error(
              `Timeout acquiring API-Football publication lease at ${this.lockPath} after ${elapsed}ms`
            );
          }

          await this.sleepFn(this.retryDelayMs);
        } else {
          throw err;
        }
      }
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

export async function withApiFootballJobLease<T>(
  dataRoot: string,
  operation: () => Promise<T>,
  options?: Omit<ApiFootballJobLeaseOptions, 'dataRoot'>
): Promise<T> {
  const lease = new ApiFootballJobLease({ ...options, dataRoot });
  return lease.withLease(operation);
}
