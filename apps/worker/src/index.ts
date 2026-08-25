import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  API_FOOTBALL_QUOTA_CONFIG
} from '@miraichi/config';
import {
  runApiFootballIngestionJob,
  type ApiFootballIngestionRunResult
} from './jobs/api-football-ingestion-job.js';

export const API_FOOTBALL_SCHEDULE_INTERVAL_MS = API_FOOTBALL_QUOTA_CONFIG.pollingIntervalSeconds * 1000;

export interface ScheduleDependencies {
  runJob: () => Promise<ApiFootballIngestionRunResult>;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
  log: (message: string) => void;
}

export function startApiFootballSchedule(dependencies: ScheduleDependencies): {
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
        dependencies.log(`[API-Football] Ingestion failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      dependencies.log(`[API-Football] Ingestion failed: ${messageFor(error)}`);
    } finally {
      running = false;
    }
  };

  void runDueJob();
  const interval = dependencies.setIntervalFn(() => {
    void runDueJob();
  }, API_FOOTBALL_SCHEDULE_INTERVAL_MS);

  return {
    intervalMilliseconds: API_FOOTBALL_SCHEDULE_INTERVAL_MS,
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
  console.log(`[Worker Daemon] Starting API-Football smart-window ingestion scheduler (${API_FOOTBALL_SCHEDULE_INTERVAL_MS / 1000}s interval)...`);
  startApiFootballSchedule({
    runJob: () => runApiFootballIngestionJob({
      dataRoot: defaultDataRoot(),
      mode: 'auto',
      registry: API_FOOTBALL_COMPETITION_REGISTRY,
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
