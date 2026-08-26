import path from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  startSportScoreWorkerSchedule,
  type SportScoreWorkerScheduleOptions
} from './jobs/sportscore-worker-schedule.js';

export const WORKER_PROVIDER_STATUS = 'idle' as const;
export const SPORTSCORE_WORKER_PROVIDER_STATUS = 'sportscore-scheduled' as const;

export interface WorkerOptions {
  log?: (message: string) => void;
  sportScoreSchedule?: Omit<SportScoreWorkerScheduleOptions, 'log'>;
}

export interface WorkerHandle {
  status: typeof WORKER_PROVIDER_STATUS | typeof SPORTSCORE_WORKER_PROVIDER_STATUS;
  stop: () => void;
}

/**
 * The executable remains idle until an approved caller injects a fully configured
 * SportScore job. Importing or starting the default worker never performs network I/O.
 */
export function startWorker(options: WorkerOptions = {}): WorkerHandle {
  const log = options.log ?? console.error;
  if (options.sportScoreSchedule) {
    const schedule = startSportScoreWorkerSchedule({
      ...options.sportScoreSchedule,
      log
    });
    log('[Worker Daemon] SportScore schedule enabled with explicit injected configuration.');
    return schedule;
  }
  log('[Worker Daemon] No external match provider is configured; worker is idle.');

  return {
    status: WORKER_PROVIDER_STATUS,
    stop: () => undefined
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startWorker();
}
