import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { SPORTSCORE_COMPETITION_REGISTRY } from '../packages/config/src/index.js';
import { readServingMatchStoreSnapshot } from '../apps/api/src/repositories/serving-match-store.js';
import { runSportScoreDailySyncJob } from '../apps/worker/src/jobs/sportscore-daily-sync-job.js';
import {
  SportScoreClient,
  type SportScoreFixturesRequest
} from '../apps/worker/src/sources/sportscore/sportscore-client.js';
import type { SportScoreFixturesResponse } from '../apps/worker/src/sources/sportscore/sportscore-response-contract.js';
import { SportScoreRawEvidenceCache } from '../apps/worker/src/sources/sportscore/sportscore-raw-evidence-cache.js';
import {
  assertPreparedSportScoreSmokeRoot,
  inspectSportScoreRuntimeStatus
} from './sportscore-operations.js';

export const SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION =
  'SPORTSCORE_ANONYMOUS_ONE_SHOT' as const;
export const SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION =
  'SPORTSCORE_ACTIVE_LOCAL_SYNC' as const;

interface SportScoreFixturesClient {
  getFixtures(request: SportScoreFixturesRequest): Promise<SportScoreFixturesResponse>;
}

export interface SportScoreLocalSyncOptions {
  mode?: 'smoke' | 'active';
  dataRoot: string;
  activeDataRoot?: string;
  activeConfirmation?: string;
  date: string;
  competitionId: string;
  season: string;
  confirmation: string;
  client?: SportScoreFixturesClient;
  now?: () => Date;
}

export interface SportScoreLocalSyncResult {
  mode: 'smoke' | 'active';
  dataRoot: string;
  date: string;
  competitionId: string;
  season: string;
  authenticated: false;
  requestsAttempted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  publications: number;
  matchCount: number;
  freshness: 'fresh' | 'stale' | 'missing';
  errors: string[];
}

function readArgValue(args: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const direct = args.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireArg(args: readonly string[], name: string): string {
  const value = readArgValue(args, name)?.trim();
  if (!value) throw new Error(`Missing required argument ${name}.`);
  return value;
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    throw new Error('--date must use YYYY-MM-DD.');
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('--date must be a real calendar date.');
  }
}

export function parseSportScoreLocalSyncArgs(
  args: readonly string[]
): Omit<SportScoreLocalSyncOptions, 'client' | 'now'> {
  const dataRoot = requireArg(args, '--data-root');
  const date = requireArg(args, '--date');
  const competitionId = requireArg(args, '--competition-id');
  const season = requireArg(args, '--season');
  const confirmation = requireArg(args, '--confirm-network');
  const modeValue = readArgValue(args, '--mode')?.trim() || 'smoke';
  if (modeValue !== 'smoke' && modeValue !== 'active') {
    throw new Error('--mode must be smoke or active.');
  }
  const mode = modeValue;
  assertCalendarDate(date);
  if (confirmation !== SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION) {
    throw new Error(
      `--confirm-network must equal ${SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION}.`
    );
  }
  if (season.length > 32 || !/^[a-z0-9][a-z0-9._/-]*$/iu.test(season)) {
    throw new Error('--season must be a short explicit season label.');
  }
  const activeConfirmation = readArgValue(args, '--confirm-active-root')?.trim();
  if (
    mode === 'active'
    && activeConfirmation !== SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION
  ) {
    throw new Error(
      `--confirm-active-root must equal ${SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION} in active mode.`
    );
  }
  return {
    mode,
    dataRoot,
    date,
    competitionId,
    season,
    confirmation,
    ...(activeConfirmation === undefined ? {} : { activeConfirmation })
  };
}

export async function runSportScoreLocalSyncOnce(
  options: SportScoreLocalSyncOptions
): Promise<SportScoreLocalSyncResult> {
  if (options.confirmation !== SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION) {
    throw new Error(
      `Network execution requires confirmation ${SPORTSCORE_ANONYMOUS_ONE_SHOT_CONFIRMATION}.`
    );
  }
  assertCalendarDate(options.date);
  const entry = SPORTSCORE_COMPETITION_REGISTRY.find((candidate) => (
    candidate.enabled && candidate.competitionId === options.competitionId
  ));
  if (!entry) {
    throw new Error(`Unknown or disabled SportScore competition: ${options.competitionId}.`);
  }
  const season = options.season.trim();
  if (season === '') {
    throw new Error('SportScore local sync season must not be empty.');
  }
  const mode = options.mode ?? 'smoke';
  const dataRoot = mode === 'active'
    ? await assertActiveSportScoreDataRoot(options)
    : await assertPreparedSportScoreSmokeRoot({
        dataRoot: options.dataRoot,
        ...(options.activeDataRoot === undefined ? {} : { activeDataRoot: options.activeDataRoot })
      });
  const now = options.now ?? (() => new Date());
  const client = options.client ?? new SportScoreClient({
    apiKey: '',
    maxRetries: 0,
    maxConcurrency: 1,
    evidenceCache: new SportScoreRawEvidenceCache({
      rootDirectory: path.join(dataRoot, 'providers', 'sportscore', 'raw'),
      maxEntries: 20
    })
  });
  const job = await runSportScoreDailySyncJob({
    dataRoot,
    client,
    registry: [entry],
    targetDate: options.date,
    now,
    resolveSeason: () => season,
    maxRequestsPerRun: 1,
    maxConcurrency: 1
  });
  const status = await inspectSportScoreRuntimeStatus({ dataRoot, now });
  return {
    mode,
    dataRoot,
    date: options.date,
    competitionId: entry.competitionId,
    season,
    authenticated: false,
    requestsAttempted: job.requestsAttempted,
    requestsSucceeded: job.requestsSucceeded,
    requestsFailed: job.requestsFailed,
    publications: job.publications,
    matchCount: status.serving.matchCount,
    freshness: status.serving.freshness,
    errors: job.errors
  };
}

async function assertActiveSportScoreDataRoot(
  options: SportScoreLocalSyncOptions
): Promise<string> {
  if (options.activeConfirmation !== SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION) {
    throw new Error(
      `Active-root sync requires confirmation ${SPORTSCORE_ACTIVE_LOCAL_SYNC_CONFIRMATION}.`
    );
  }
  const dataRoot = path.resolve(options.dataRoot);
  const configuredActiveRoot = path.resolve(
    options.activeDataRoot ?? path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      '..',
      'apps',
      'api',
      'data'
    )
  );
  if (dataRoot !== configuredActiveRoot) {
    throw new Error('Active SportScore sync may target only the configured apps/api/data root.');
  }
  const snapshot = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
  if (
    snapshot.matches.length === 0
    || !snapshot.sources.some((source) => source.sourceId === 'sportscore')
  ) {
    throw new Error('Active SportScore root must contain a validated bootstrapped snapshot.');
  }
  return dataRoot;
}

async function main(): Promise<void> {
  const options = parseSportScoreLocalSyncArgs(process.argv.slice(2));
  const result = await runSportScoreLocalSyncOnce(options);
  console.log(JSON.stringify(result, null, 2));
  if (result.requestsFailed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
