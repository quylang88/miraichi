import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { COMPETITION_SOURCE_REGISTRY } from '../packages/config/src/index.js';
import {
  runSeasonHydrationJob,
  type FotMobSeasonFetcher,
  type OpenFootballSeasonFetcher
} from '../apps/worker/src/jobs/season-hydration-job.js';
import { SeasonHydrationLedger } from '../apps/worker/src/sources/hydration/season-hydration-ledger.js';
import { resolveCompetitionSeason } from '../apps/worker/src/sources/hydration/season-hydration-plan.js';
import { ServingMatchStoreRepository } from '../apps/api/src/repositories/serving-match-store-repository.js';
import {
  assertBootstrappedOwnerActiveDataRoot,
  defaultOwnerActiveDataRoot
} from './providers/shared/active-data-root.js';

export const SEASON_HYDRATION_NETWORK_CONFIRMATION =
  'SEASON_HYDRATION_NETWORK' as const;
export const DEFAULT_OWNER_TIME_ZONE = 'Asia/Tokyo' as const;
const DEFAULT_MAX_REQUESTS_PER_RUN = 9;
const DEFAULT_REQUEST_INTERVAL_MS = 2_000;

export interface LocalSeasonHydrationOptions {
  dataRoot: string;
  activeDataRoot?: string;
  date: string;
  confirmation: string;
  maxRequestsPerRun?: number;
  openFootballClient?: OpenFootballSeasonFetcher;
  fotMobClient?: FotMobSeasonFetcher;
  now?: () => Date;
  pastSeasons?: number;
  requestIntervalMs?: number;
  mode?: 'hydrate' | 'revalidate-current';
}

export interface SeasonHydrationRuntimeArgs {
  mode: 'hydrate' | 'revalidate-current';
  dataRoot: string;
  date?: string;
  timeZone: string;
  confirmation: string;
  maxRequestsPerRun: number;
  pastSeasons: number;
  requestIntervalMs: number;
}

function readArgValue(args: readonly string[], name: string): string | undefined {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function parseInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number
): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}.`);
  }
  return parsed;
}

function assertCalendarDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) throw new Error('--date must use YYYY-MM-DD.');
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('--date must be a real calendar date.');
  }
}

function assertTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error('--timezone must be a valid IANA time zone.');
  }
}

export function currentDateInTimeZone(now: Date, timeZone: string): string {
  if (Number.isNaN(now.valueOf())) throw new Error('Season hydration clock is invalid.');
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function parseSeasonHydrationRuntimeArgs(
  args: readonly string[]
): SeasonHydrationRuntimeArgs {
  const confirmation = readArgValue(args, '--confirm-network')?.trim();
  if (confirmation !== SEASON_HYDRATION_NETWORK_CONFIRMATION) {
    throw new Error(`--confirm-network must equal ${SEASON_HYDRATION_NETWORK_CONFIRMATION}.`);
  }
  const timeZone = readArgValue(args, '--timezone')?.trim() || DEFAULT_OWNER_TIME_ZONE;
  assertTimeZone(timeZone);
  const mode = readArgValue(args, '--mode')?.trim() || 'hydrate';
  if (mode !== 'hydrate' && mode !== 'revalidate-current') {
    throw new Error('--mode must be hydrate or revalidate-current.');
  }
  const date = readArgValue(args, '--date')?.trim();
  if (date !== undefined) assertCalendarDate(date);
  const pastSeasons = parseInteger(
    readArgValue(args, '--past-seasons'),
    0,
    '--past-seasons',
    0,
    10
  );
  if (pastSeasons > 0) {
    throw new Error('Historical-season hydration is pending and cannot be executed.');
  }
  return {
    mode,
    dataRoot: path.resolve(readArgValue(args, '--data-root') ?? defaultOwnerActiveDataRoot()),
    ...(date === undefined ? {} : { date }),
    timeZone,
    confirmation,
    maxRequestsPerRun: parseInteger(
      readArgValue(args, '--max-requests'),
      DEFAULT_MAX_REQUESTS_PER_RUN,
      '--max-requests',
      1,
      mode === 'revalidate-current' ? 9 : 100
    ),
    pastSeasons,
    requestIntervalMs: parseInteger(
      readArgValue(args, '--request-interval-ms'),
      DEFAULT_REQUEST_INTERVAL_MS,
      '--request-interval-ms',
      0,
      60_000
    )
  };
}

export async function runLocalSeasonHydrationBatch(
  options: LocalSeasonHydrationOptions
): Promise<{
  status: 'completed' | 'partial' | 'idle' | 'lease_busy';
  mode: 'hydrate' | 'revalidate-current';
  dataRoot: string;
  date: string;
  executableCurrentCompetitionCount: number;
  coverage: { supported: number; partial: number; unsupported: number };
  requestsAttempted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  publications: number;
  hydrationTargetsCompleted: number;
  recordsIgnoredWithoutKickoff: number;
  recordsIgnoredLive: number;
  matchCount: number;
  freshness: 'fresh' | 'stale' | 'missing';
  errors: string[];
}> {
  if (options.confirmation !== SEASON_HYDRATION_NETWORK_CONFIRMATION) {
    throw new Error(`Network execution requires confirmation ${SEASON_HYDRATION_NETWORK_CONFIRMATION}.`);
  }
  assertCalendarDate(options.date);
  const dataRoot = await assertBootstrappedOwnerActiveDataRoot({
    dataRoot: options.dataRoot,
    ...(options.activeDataRoot === undefined ? {} : { activeDataRoot: options.activeDataRoot })
  });
  const now = options.now ?? (() => new Date());
  const job = await runSeasonHydrationJob({
    dataRoot,
    registry: COMPETITION_SOURCE_REGISTRY,
    referenceDate: options.date,
    now,
    pastSeasons: options.pastSeasons ?? 0,
    maxRequestsPerRun: options.maxRequestsPerRun ?? DEFAULT_MAX_REQUESTS_PER_RUN,
    requestIntervalMs: options.requestIntervalMs ?? DEFAULT_REQUEST_INTERVAL_MS,
    mode: options.mode ?? 'hydrate',
    ...(options.openFootballClient === undefined
      ? {}
      : { openFootballClient: options.openFootballClient }),
    ...(options.fotMobClient === undefined
      ? {}
      : { fotMobClient: options.fotMobClient })
  });
  const repository = new ServingMatchStoreRepository({
    servingRoot: path.join(dataRoot, 'serving'),
    now
  });
  const [serving, ledger] = await Promise.all([
    repository.getStatus(),
    new SeasonHydrationLedger({ dataRoot, now }).getState()
  ]);
  const currentSeasonByCompetition = new Map(COMPETITION_SOURCE_REGISTRY.map((entry) => [
    entry.competitionId,
    resolveCompetitionSeason(entry, options.date, 0).season
  ]));
  const executableCurrentCompetitionCount = COMPETITION_SOURCE_REGISTRY.filter((entry) => {
    const fixture = entry.sourceBindings.fixture;
    return fixture?.executionStatus === 'enabled'
      && fixture.availableCanonicalSeasons.includes(currentSeasonByCompetition.get(entry.competitionId)!);
  }).length;
  const coverage = {
    supported: COMPETITION_SOURCE_REGISTRY.filter((entry) => entry.coverageStatus === 'supported').length,
    partial: COMPETITION_SOURCE_REGISTRY.filter((entry) => entry.coverageStatus === 'partial').length,
    unsupported: COMPETITION_SOURCE_REGISTRY.filter((entry) => entry.coverageStatus === 'unsupported').length
  };
  return {
    status: job.status,
    mode: options.mode ?? 'hydrate',
    dataRoot,
    date: options.date,
    executableCurrentCompetitionCount,
    coverage,
    requestsAttempted: job.requestsAttempted,
    requestsSucceeded: job.requestsSucceeded,
    requestsFailed: job.requestsFailed,
    publications: job.publications,
    hydrationTargetsCompleted: Object.keys(ledger.checkpoints).length,
    recordsIgnoredWithoutKickoff: job.recordsIgnoredWithoutKickoff,
    recordsIgnoredLive: job.recordsIgnoredLive,
    matchCount: serving.matchCount,
    freshness: serving.freshness,
    errors: job.errors
  };
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const parsed = parseSeasonHydrationRuntimeArgs(args);
  const date = parsed.date ?? currentDateInTimeZone(new Date(), parsed.timeZone);
  const result = await runLocalSeasonHydrationBatch({
    dataRoot: parsed.dataRoot,
    date,
    confirmation: parsed.confirmation,
    maxRequestsPerRun: parsed.maxRequestsPerRun,
    pastSeasons: parsed.pastSeasons,
    requestIntervalMs: parsed.requestIntervalMs,
    mode: parsed.mode
  });
  console.log(JSON.stringify(result, null, 2));
  if (result.requestsFailed > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
