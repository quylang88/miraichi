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
 * Keep the worker executable explicit while no external source is implemented.
 * A future provider slice must replace this boundary only after its scheduler and
 * terminal-only publication tests pass.
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
