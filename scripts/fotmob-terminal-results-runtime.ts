import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ServingMatchStoreRepository } from '../apps/api/src/repositories/serving-match-store-repository.js';
import {
  runFotMobTerminalResultJob,
  type FotMobDailyFetcher
} from '../apps/worker/src/jobs/fotmob-terminal-result-job.js';
import {
  assertBootstrappedOwnerActiveDataRoot,
  defaultOwnerActiveDataRoot
} from './providers/shared/active-data-root.js';

export const FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION =
  'FOTMOB_TERMINAL_RESULTS_NETWORK' as const;
export const DEFAULT_FOTMOB_OWNER_TIME_ZONE = 'Asia/Tokyo' as const;
export const DEFAULT_FOTMOB_OWNER_COUNTRY_CODE = 'JPN' as const;
export const FOTMOB_TERMINAL_WATCH_INTERVAL_MS = 30_000 as const;
const DEFAULT_MAX_REQUESTS_PER_RUN = 2;

export interface FotMobTerminalResultsRuntimeArgs {
  mode: 'once' | 'watch';
  dataRoot: string;
  confirmation: string;
  timeZone: string;
  ownerCountryCode: string;
  maxRequestsPerRun: number;
  watchIntervalMs: typeof FOTMOB_TERMINAL_WATCH_INTERVAL_MS;
}

export interface LocalFotMobTerminalResultsOptions {
  dataRoot: string;
  activeDataRoot?: string;
  confirmation: string;
  timeZone: string;
  ownerCountryCode: string;
  maxRequestsPerRun?: number;
  client?: FotMobDailyFetcher;
  now?: () => Date;
}

export interface LocalFotMobTerminalResultsSummary {
  provider: 'fotmob-unofficial';
  scope: 'owner-local';
  status: 'completed' | 'partial' | 'idle' | 'lease_busy';
  dataRoot: string;
  requestsAttempted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  matchesTerminal: number;
  matchesRetried: number;
  matchesMissing: number;
  matchesExhausted: number;
  nonTerminalObserved: number;
  publications: number;
  circuitOpen: boolean;
  snapshotId: string;
  matchCount: number;
  freshness: 'fresh' | 'stale' | 'missing';
  errors: string[];
}

export interface FotMobTerminalWatchOptions<TResult> {
  runOnce: () => Promise<TResult>;
  onResult?: (result: TResult) => void | Promise<void>;
  wait?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  signal?: AbortSignal;
  maxTicks?: number;
}

function readArgValue(args: readonly string[], name: string): string | undefined {
  const direct = args.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

export function parseFotMobTerminalResultsRuntimeArgs(
  args: readonly string[]
): FotMobTerminalResultsRuntimeArgs {
  const confirmation = readArgValue(args, '--confirm-network')?.trim();
  if (confirmation !== FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION) {
    throw new Error(
      `--confirm-network must equal ${FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION}.`
    );
  }
  const mode = readArgValue(args, '--mode')?.trim() || 'once';
  if (mode !== 'once' && mode !== 'watch') {
    throw new Error('--mode must be once or watch.');
  }
  const timeZone = readArgValue(args, '--timezone')?.trim()
    || DEFAULT_FOTMOB_OWNER_TIME_ZONE;
  assertTimeZone(timeZone);
  const ownerCountryCode = readArgValue(args, '--owner-country')?.trim()
    || DEFAULT_FOTMOB_OWNER_COUNTRY_CODE;
  if (!/^[A-Z]{3}$/u.test(ownerCountryCode)) {
    throw new Error('--owner-country must be an uppercase ISO alpha-3 code.');
  }
  const maxRequestsPerRun = parseInteger(
    readArgValue(args, '--max-requests'),
    DEFAULT_MAX_REQUESTS_PER_RUN,
    '--max-requests',
    1,
    2
  );
  return {
    mode,
    dataRoot: path.resolve(readArgValue(args, '--data-root') ?? defaultOwnerActiveDataRoot()),
    confirmation,
    timeZone,
    ownerCountryCode,
    maxRequestsPerRun,
    watchIntervalMs: FOTMOB_TERMINAL_WATCH_INTERVAL_MS
  };
}

export async function runLocalFotMobTerminalResultsOnce(
  options: LocalFotMobTerminalResultsOptions
): Promise<LocalFotMobTerminalResultsSummary> {
  if (options.confirmation !== FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION) {
    throw new Error(
      `Network execution requires confirmation ${FOTMOB_TERMINAL_RESULTS_NETWORK_CONFIRMATION}.`
    );
  }
  assertTimeZone(options.timeZone);
  if (!/^[A-Z]{3}$/u.test(options.ownerCountryCode)) {
    throw new Error('ownerCountryCode must be an uppercase ISO alpha-3 code.');
  }
  const dataRoot = await assertBootstrappedOwnerActiveDataRoot({
    dataRoot: options.dataRoot,
    ...(options.activeDataRoot === undefined
      ? {}
      : { activeDataRoot: options.activeDataRoot })
  });
  const now = options.now ?? (() => new Date());
  const job = await runFotMobTerminalResultJob({
    dataRoot,
    timeZone: options.timeZone,
    ownerCountryCode: options.ownerCountryCode,
    maxRequestsPerRun: options.maxRequestsPerRun ?? DEFAULT_MAX_REQUESTS_PER_RUN,
    now,
    ...(options.client === undefined ? {} : { client: options.client })
  });
  const serving = await new ServingMatchStoreRepository({
    servingRoot: path.join(dataRoot, 'serving'),
    now
  }).getStatus();
  return {
    provider: 'fotmob-unofficial',
    scope: 'owner-local',
    status: job.status,
    dataRoot,
    requestsAttempted: job.requestsAttempted,
    requestsSucceeded: job.requestsSucceeded,
    requestsFailed: job.requestsFailed,
    matchesTerminal: job.matchesTerminal,
    matchesRetried: job.matchesRetried,
    matchesMissing: job.matchesMissing,
    matchesExhausted: job.matchesExhausted,
    nonTerminalObserved: job.nonTerminalObserved,
    publications: job.publications,
    circuitOpen: job.circuitOpen,
    snapshotId: serving.snapshotId,
    matchCount: serving.matchCount,
    freshness: serving.freshness,
    errors: job.errors
  };
}

export async function watchLocalFotMobTerminalResults<TResult>(
  options: FotMobTerminalWatchOptions<TResult>
): Promise<number> {
  const maxTicks = options.maxTicks ?? Number.POSITIVE_INFINITY;
  if (!(maxTicks === Number.POSITIVE_INFINITY
    || (Number.isInteger(maxTicks) && maxTicks >= 1))) {
    throw new Error('FotMob terminal watch maxTicks must be a positive integer.');
  }
  const wait = options.wait ?? abortableWait;
  let ticks = 0;
  while (!options.signal?.aborted && ticks < maxTicks) {
    const result = await options.runOnce();
    ticks += 1;
    if (options.onResult) await options.onResult(result);
    if (options.signal?.aborted || ticks >= maxTicks) break;
    await wait(FOTMOB_TERMINAL_WATCH_INTERVAL_MS, options.signal);
  }
  return ticks;
}

async function abortableWait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(done, milliseconds);
    signal?.addEventListener('abort', done, { once: true });
    function done(): void {
      clearTimeout(timer);
      signal?.removeEventListener('abort', done);
      resolve();
    }
  });
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

function assertTimeZone(value: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: value }).format(new Date(0));
  } catch {
    throw new Error('FotMob terminal time zone must be a valid IANA time zone.');
  }
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const parsed = parseFotMobTerminalResultsRuntimeArgs(args);
  const runOnce = () => runLocalFotMobTerminalResultsOnce({
    dataRoot: parsed.dataRoot,
    confirmation: parsed.confirmation,
    timeZone: parsed.timeZone,
    ownerCountryCode: parsed.ownerCountryCode,
    maxRequestsPerRun: parsed.maxRequestsPerRun
  });
  if (parsed.mode === 'once') {
    const result = await runOnce();
    console.log(JSON.stringify(result, null, 2));
    if (result.requestsFailed > 0) process.exitCode = 1;
    return;
  }

  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await watchLocalFotMobTerminalResults({
      runOnce,
      signal: controller.signal,
      onResult: (result) => {
        console.log(JSON.stringify(result));
        if (result.circuitOpen) console.error('FotMob access circuit opened for this tick.');
      }
    });
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
