import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { OPENFOOTBALL_SOURCE_REGISTRY } from '@miraichi/config';
import {
  runOpenFootballIngestionJob,
  type OpenFootballIngestionRunResult
} from './jobs/openfootball-ingestion-job.js';

export const OPENFOOTBALL_SCHEDULE_INTERVAL_MS = 360 * 60_000;

export interface ScheduleDependencies {
  runJob: () => Promise<OpenFootballIngestionRunResult>;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
  log: (message: string) => void;
}

export function startOpenFootballSchedule(dependencies: ScheduleDependencies): {
  intervalMilliseconds: number;
  stop: () => void;
} {
  let running = false;

  const runDueJob = async (): Promise<void> => {
    if (running) return;
    running = true;
    try {
      const result = await dependencies.runJob();
      if (result.status === 'failed') {
        dependencies.log(`[OpenFootball] Capture failed: ${result.errorCodes.join(', ')}`);
      }
    } catch (error) {
      dependencies.log(`[OpenFootball] Capture failed: ${messageFor(error)}`);
    } finally {
      running = false;
    }
  };

  void runDueJob();
  const interval = dependencies.setIntervalFn(() => {
    void runDueJob();
  }, OPENFOOTBALL_SCHEDULE_INTERVAL_MS);

  return {
    intervalMilliseconds: OPENFOOTBALL_SCHEDULE_INTERVAL_MS,
    stop: () => dependencies.clearIntervalFn(interval)
  };
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function defaultDataRoot(): string {
  const workspaceRoot = fileURLToPath(new URL('../../../', import.meta.url));
  return path.resolve(workspaceRoot, 'apps/api/data');
}

function startWorker(): void {
  console.log('[Worker Daemon] Starting six-hour OpenFootball ingestion scheduler...');
  startOpenFootballSchedule({
    runJob: () => runOpenFootballIngestionJob({
      dataRoot: defaultDataRoot(),
      sources: OPENFOOTBALL_SOURCE_REGISTRY,
      now: () => new Date()
    }),
    setIntervalFn: setInterval,
    clearIntervalFn: clearInterval,
    log: console.error
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  startWorker();
}
