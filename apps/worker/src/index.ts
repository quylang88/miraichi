import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const WORKER_PROVIDER_STATUS = 'idle' as const;

export interface WorkerOptions {
  log?: (message: string) => void;
}

export interface WorkerHandle {
  status: typeof WORKER_PROVIDER_STATUS;
  stop: () => void;
}

/**
 * Network hydration is an explicit owner-local command. The daemon has no provider
 * injection path and importing or starting it never performs network I/O.
 */
export function startWorker(options: WorkerOptions = {}): WorkerHandle {
  const log = options.log ?? console.error;
  log('[Worker Daemon] No external match provider is configured; worker is idle.');

  return {
    status: WORKER_PROVIDER_STATUS,
    stop: () => undefined
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startWorker();
}
