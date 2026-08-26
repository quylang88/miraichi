import type { SportScoreDailySyncJobResult } from './sportscore-daily-sync-job.js';

export interface SportScoreWorkerScheduleOptions {
  run: () => Promise<SportScoreDailySyncJobResult>;
  intervalMs?: number;
  log?: (message: string) => void;
  setIntervalFn?: typeof setInterval;
  clearIntervalFn?: typeof clearInterval;
}

export interface SportScoreWorkerScheduleHandle {
  status: 'sportscore-scheduled';
  stop: () => void;
}

export function startSportScoreWorkerSchedule(
  options: SportScoreWorkerScheduleOptions
): SportScoreWorkerScheduleHandle {
  const intervalMs = options.intervalMs ?? 60_000;
  if (!Number.isInteger(intervalMs) || intervalMs < 1_000) {
    throw new Error('SportScore worker intervalMs must be an integer of at least 1000ms.');
  }
  const log = options.log ?? console.error;
  const setIntervalFn = options.setIntervalFn ?? setInterval;
  const clearIntervalFn = options.clearIntervalFn ?? clearInterval;
  let running = false;
  let stopped = false;

  const timer = setIntervalFn(() => {
    if (running || stopped) return;
    running = true;
    void options.run().then((result) => {
      if (result.status === 'partial') {
        log(`[Worker Daemon] SportScore sync partial: ${result.requestsFailed} action(s) failed.`);
      }
    }).catch((error: unknown) => {
      log(`[Worker Daemon] SportScore sync failed: ${safeMessage(error)}`);
    }).finally(() => {
      running = false;
    });
  }, intervalMs);

  return {
    status: 'sportscore-scheduled',
    stop: () => {
      if (stopped) return;
      stopped = true;
      clearIntervalFn(timer);
    }
  };
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
