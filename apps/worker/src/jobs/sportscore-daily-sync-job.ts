import { randomUUID } from 'node:crypto';
import path from 'node:path';
import {
  SPORTSCORE_COMPETITION_REGISTRY,
  type SportScoreCompetitionEntry
} from '@miraichi/config';
import type { LocalMatch } from '@miraichi/shared';
import { readServingMatchStoreSnapshot } from '../../../api/src/repositories/serving-match-store.js';
import { SportScoreClient } from '../sources/sportscore/sportscore-client.js';
import { SportScoreJobLease } from '../sources/sportscore/sportscore-job-lease.js';
import {
  planSportScoreSchedule,
  sportScoreTerminalWindowKey,
  SPORTSCORE_SCHEDULE_CONFIG,
  type SportScoreScheduleAction,
  type SportScoreTerminalWindowPlan
} from '../sources/sportscore/sportscore-schedule-planner.js';
import { SportScoreSourceLedger } from '../sources/sportscore/sportscore-source-ledger.js';
import type { SportScoreFixturesResponse } from '../sources/sportscore/sportscore-response-contract.js';
import {
  mapSportScoreStatus,
  resolveSportScoreMatchSlug
} from '../sources/sportscore/sportscore-adapter.js';
import { runSportScorePublicationJob } from './sportscore-publication-job.js';

export interface SportScoreFixturesClient {
  getFixtures(request: {
    date: string;
    competition: string;
    limit?: number;
    maxRetries?: number;
  }): Promise<SportScoreFixturesResponse>;
}

export interface SportScoreDailySyncJobOptions {
  dataRoot: string;
  client?: SportScoreFixturesClient;
  registry?: readonly SportScoreCompetitionEntry[];
  targetDate: string;
  now?: () => Date;
  resolveSeason: (entry: SportScoreCompetitionEntry, date: string) => string;
  maxRequestsPerRun?: number;
  maxConcurrency?: number;
  failureDeferralMinutes?: number;
  leaseStaleAfterMs?: number;
}

export interface SportScoreDailySyncJobResult {
  status: 'completed' | 'partial' | 'idle' | 'lease_busy';
  requestsAttempted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  publications: number;
  terminalWindowsChecked: number;
  nextRotationCursor: number;
  errors: string[];
}

interface PreparedAction {
  action: SportScoreScheduleAction;
  season: string;
  index: number;
}

type FetchOutcome =
  | { ok: true; prepared: PreparedAction; response: SportScoreFixturesResponse }
  | { ok: false; prepared: PreparedAction; error: unknown };

const TERMINAL_STATUSES = new Set(['completed', 'postponed', 'cancelled']);

export async function runSportScoreDailySyncJob(
  options: SportScoreDailySyncJobOptions
): Promise<SportScoreDailySyncJobResult> {
  const nowProvider = options.now ?? (() => new Date());
  const observedAt = nowProvider();
  if (Number.isNaN(observedAt.valueOf())) {
    throw new Error('SportScore job now() returned an invalid date.');
  }
  const targetDate = options.targetDate;
  const registry = options.registry ?? SPORTSCORE_COMPETITION_REGISTRY;
  const maxRequestsPerRun = options.maxRequestsPerRun
    ?? SPORTSCORE_SCHEDULE_CONFIG.defaultMaxRequestsPerRun;
  const maxConcurrency = options.maxConcurrency
    ?? SPORTSCORE_SCHEDULE_CONFIG.defaultMaxConcurrency;
  const failureDeferralMinutes = options.failureDeferralMinutes ?? 15;
  assertPositiveInteger(maxRequestsPerRun, 'maxRequestsPerRun');
  assertPositiveInteger(maxConcurrency, 'maxConcurrency');
  assertPositiveInteger(failureDeferralMinutes, 'failureDeferralMinutes');

  const lease = new SportScoreJobLease({
    dataRoot: options.dataRoot,
    now: () => observedAt,
    ...(options.leaseStaleAfterMs === undefined
      ? {}
      : { staleAfterMs: options.leaseStaleAfterMs })
  });
  const leaseResult = await lease.tryWithLease(async () => executeUnderLease({
    ...options,
    registry,
    targetDate,
    observedAt,
    maxRequestsPerRun,
    maxConcurrency,
    failureDeferralMinutes
  }));
  if (!leaseResult.acquired) {
    return emptyResult('lease_busy', 0);
  }
  return leaseResult.value;
}

async function executeUnderLease(options: SportScoreDailySyncJobOptions & {
  registry: readonly SportScoreCompetitionEntry[];
  targetDate: string;
  observedAt: Date;
  maxRequestsPerRun: number;
  maxConcurrency: number;
  failureDeferralMinutes: number;
}): Promise<SportScoreDailySyncJobResult> {
  const ledger = new SportScoreSourceLedger({
    dataRoot: options.dataRoot,
    now: () => options.observedAt
  });
  const [ledgerState, currentMatches] = await Promise.all([
    ledger.getState(),
    readCurrentServingMatches(options.dataRoot)
  ]);
  const plan = planSportScoreSchedule({
    registry: options.registry,
    targetDate: options.targetDate,
    now: options.observedAt,
    ledger: ledgerState,
    matches: currentMatches,
    maxRequestsPerRun: options.maxRequestsPerRun
  });
  if (plan.actions.length === 0) {
    return emptyResult('idle', plan.nextRotationCursor);
  }

  await ledger.recordRotationCursor(plan.nextRotationCursor, options.observedAt);
  const preparationErrors: string[] = [];
  const prepared: PreparedAction[] = [];
  for (const [index, action] of plan.actions.entries()) {
    let season: string;
    try {
      season = options.resolveSeason(action.competitionEntry, action.date).trim();
    } catch (error) {
      preparationErrors.push(safeErrorMessage(error));
      continue;
    }
    if (season === '') {
      preparationErrors.push(
        `Missing current season for ${action.competitionEntry.competitionId} on ${action.date}.`
      );
      continue;
    }
    prepared.push({ action, season, index });
  }

  if (prepared.length === 0) {
    return {
      status: 'partial',
      requestsAttempted: 0,
      requestsSucceeded: 0,
      requestsFailed: 0,
      publications: 0,
      terminalWindowsChecked: 0,
      nextRotationCursor: plan.nextRotationCursor,
      errors: preparationErrors
    };
  }

  const client = options.client ?? new SportScoreClient();
  const outcomes = await fetchWithConcurrency(prepared, options.maxConcurrency, async (item) => {
    try {
      const response = await client.getFixtures({
        date: item.action.date,
        competition: item.action.competitionEntry.providerCompetitionSlug,
        limit: 200,
        maxRetries: 0
      });
      return { ok: true, prepared: item, response } satisfies FetchOutcome;
    } catch (error) {
      return { ok: false, prepared: item, error } satisfies FetchOutcome;
    }
  });

  let requestsSucceeded = 0;
  let requestsFailed = 0;
  let publications = 0;
  let terminalWindowsChecked = 0;
  const errors = [...preparationErrors];

  for (const outcome of outcomes) {
    const { action } = outcome.prepared;
    if (!outcome.ok) {
      requestsFailed += 1;
      errors.push(safeErrorMessage(outcome.error));
      await deferAction(
        ledger,
        action,
        options.observedAt,
        options.failureDeferralMinutes
      );
      continue;
    }

    const publication = await runSportScorePublicationJob({
      dataRoot: options.dataRoot,
      runId: createRunId(options.observedAt, action, outcome.prepared.index),
      competitionEntry: action.competitionEntry,
      season: outcome.prepared.season,
      response: outcome.response,
      observedAt: options.observedAt.toISOString()
    });
    if (publication.status === 'rejected') {
      requestsFailed += 1;
      errors.push(
        `SportScore publication rejected ${action.competitionEntry.competitionId}/${action.date}: ${publication.reason ?? 'unknown'}.`
      );
      await deferAction(
        ledger,
        action,
        options.observedAt,
        options.failureDeferralMinutes
      );
      continue;
    }

    requestsSucceeded += 1;
    if (publication.status === 'published') publications += 1;
    await ledger.recordTerminalSchedules(
      extractTerminalSchedules(action, outcome.response),
      options.observedAt
    );
    if (action.daily) {
      await ledger.recordDailySuccess(
        action.competitionEntry.competitionId,
        action.date,
        options.observedAt
      );
    }
    for (const window of action.terminalWindows) {
      const coverage = terminalCoverage(window, outcome.response);
      if (!coverage.complete) {
        await deferTerminalWindow(
          ledger,
          window,
          options.observedAt,
          options.failureDeferralMinutes
        );
        continue;
      }
      terminalWindowsChecked += 1;
      await ledger.recordTerminalSuccess(
        window.windowKey,
        window.stage,
        coverage.terminal,
        options.observedAt,
        terminalFollowUp(window, coverage.terminal, options.observedAt)
      );
    }
  }

  return {
    status: requestsFailed > 0 || preparationErrors.length > 0 ? 'partial' : 'completed',
    requestsAttempted: outcomes.length,
    requestsSucceeded,
    requestsFailed,
    publications,
    terminalWindowsChecked,
    nextRotationCursor: plan.nextRotationCursor,
    errors
  };
}

function extractTerminalSchedules(
  action: SportScoreScheduleAction,
  response: SportScoreFixturesResponse
): Array<{
  windowKey: string;
  schedule: {
    competitionId: string;
    date: string;
    expectedEndAt: string;
    sourceMatchSlugs: string[];
    matchIds: string[];
  };
}> {
  const byWindow = new Map<string, {
    competitionId: string;
    date: string;
    expectedEndAt: string;
    sourceMatchSlugs: string[];
    matchIds: string[];
  }>();
  for (const fixture of response.matches) {
    const status = mapSportScoreStatus(fixture.status)
      ?? mapSportScoreStatus(fixture.status_text);
    if (status !== 'scheduled' && status !== 'in_play') continue;
    const sourceMatchSlug = resolveSportScoreMatchSlug(fixture);
    if (sourceMatchSlug === undefined || typeof fixture.time !== 'string') continue;
    const kickoffMs = Date.parse(fixture.time);
    if (Number.isNaN(kickoffMs)) continue;
    const expectedEndAt = new Date(
      kickoffMs + SPORTSCORE_SCHEDULE_CONFIG.expectedMatchDurationMinutes * 60_000
    ).toISOString();
    const windowKey = sportScoreTerminalWindowKey(
      action.competitionEntry.competitionId,
      action.date,
      expectedEndAt
    );
    const schedule = byWindow.get(windowKey) ?? {
      competitionId: action.competitionEntry.competitionId,
      date: action.date,
      expectedEndAt,
      sourceMatchSlugs: [],
      matchIds: []
    };
    schedule.sourceMatchSlugs.push(sourceMatchSlug);
    byWindow.set(windowKey, schedule);
  }
  return [...byWindow].map(([windowKey, schedule]) => ({
    windowKey,
    schedule: {
      ...schedule,
      sourceMatchSlugs: [...new Set(schedule.sourceMatchSlugs)]
    }
  }));
}

async function readCurrentServingMatches(dataRoot: string): Promise<LocalMatch[]> {
  try {
    return (await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'))).matches;
  } catch (error) {
    if ((error as Error & { code?: string }).code === 'serving_match_store_missing') {
      return [];
    }
    throw error;
  }
}

async function deferAction(
  ledger: SportScoreSourceLedger,
  action: SportScoreScheduleAction,
  observedAt: Date,
  failureDeferralMinutes: number
): Promise<void> {
  if (action.daily) {
    await ledger.recordDailyDeferral(
      action.competitionEntry.competitionId,
      action.date,
      new Date(observedAt.getTime() + failureDeferralMinutes * 60_000),
      observedAt
    );
  }
  for (const window of action.terminalWindows) {
    await deferTerminalWindow(ledger, window, observedAt, failureDeferralMinutes);
  }
}

async function deferTerminalWindow(
  ledger: SportScoreSourceLedger,
  window: SportScoreTerminalWindowPlan,
  observedAt: Date,
  failureDeferralMinutes: number
): Promise<void> {
  const nextFailureCount = (window.priorFailureCount ?? 0) + 1;
  if (nextFailureCount >= SPORTSCORE_SCHEDULE_CONFIG.maxTerminalFailureDeferrals) {
    await ledger.recordTerminalExhaustion(window.windowKey, observedAt);
    return;
  }
  await ledger.recordTerminalDeferral(
    window.windowKey,
    terminalDeferralAt(window, observedAt, failureDeferralMinutes),
    observedAt
  );
}

function terminalDeferralAt(
  window: SportScoreTerminalWindowPlan,
  observedAt: Date,
  failureDeferralMinutes: number
): Date {
  const priorFailureCount = window.priorFailureCount ?? 0;
  const delayMinutes = Math.min(
    SPORTSCORE_SCHEDULE_CONFIG.maxFailureDelayMinutes,
    Math.max(
      failureDeferralMinutes,
      SPORTSCORE_SCHEDULE_CONFIG.failureBaseDelayMinutes * (2 ** priorFailureCount)
    )
  );
  const boundedBackoff = observedAt.getTime() + delayMinutes * 60_000;
  if (window.stage === 'plus_15') {
    const plus30 = Date.parse(window.expectedEndAt)
      + SPORTSCORE_SCHEDULE_CONFIG.secondTerminalCheckDelayMinutes * 60_000;
    return new Date(Math.max(boundedBackoff, plus30));
  }
  return new Date(boundedBackoff);
}

function terminalFollowUp(
  window: SportScoreTerminalWindowPlan,
  terminal: boolean,
  observedAt: Date
): { nextAttemptAt?: Date; exhausted?: boolean } {
  if (terminal || window.stage === 'plus_15') return {};
  if (window.stage === 'recovery'
    && (window.recoveryAttempt ?? 1) >= SPORTSCORE_SCHEDULE_CONFIG.maxRecoveryChecks) {
    return { exhausted: true };
  }
  const recoveryAttempt = window.stage === 'recovery' ? (window.recoveryAttempt ?? 1) : 0;
  const delayMinutes = SPORTSCORE_SCHEDULE_CONFIG.recoveryBaseDelayMinutes
    * (2 ** recoveryAttempt);
  return { nextAttemptAt: new Date(observedAt.getTime() + delayMinutes * 60_000) };
}

function terminalCoverage(
  window: SportScoreTerminalWindowPlan,
  response: SportScoreFixturesResponse
): { complete: boolean; terminal: boolean } {
  const bySlug = new Map(response.matches.flatMap((match) => {
    const sourceMatchSlug = resolveSportScoreMatchSlug(match);
    return sourceMatchSlug === undefined ? [] : [[sourceMatchSlug, match] as const];
  }));
  const statuses = window.sourceMatchSlugs.map((slug) => {
    const fixture = bySlug.get(slug);
    if (!fixture) return null;
    return mapSportScoreStatus(fixture.status) ?? mapSportScoreStatus(fixture.status_text);
  });
  if (statuses.some((status) => status === null)) {
    return { complete: false, terminal: false };
  }
  return {
    complete: true,
    terminal: statuses.every((status) => TERMINAL_STATUSES.has(status as string))
  };
}

async function fetchWithConcurrency<T, R>(
  items: readonly T[],
  maxConcurrency: number,
  work: (item: T) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(maxConcurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await work(items[index]!);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

function createRunId(
  observedAt: Date,
  action: SportScoreScheduleAction,
  index: number
): string {
  const timestamp = observedAt.toISOString().replace(/[^0-9]/gu, '');
  return `sportscore-${timestamp}-${action.competitionEntry.competitionId}-${index}-${randomUUID().slice(0, 8)}`;
}

function safeErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function emptyResult(
  status: 'idle' | 'lease_busy',
  nextRotationCursor: number
): SportScoreDailySyncJobResult {
  return {
    status,
    requestsAttempted: 0,
    requestsSucceeded: 0,
    requestsFailed: 0,
    publications: 0,
    terminalWindowsChecked: 0,
    nextRotationCursor,
    errors: []
  };
}

function assertPositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`SportScore ${field} must be a positive integer.`);
  }
}
