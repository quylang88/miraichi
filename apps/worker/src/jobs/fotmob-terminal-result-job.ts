import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COMPETITION_SOURCE_REGISTRY,
  type CompetitionSourceEntry
} from '@miraichi/config';
import type { CanonicalWarehouseSnapshot } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import { writeCanonicalWarehouseRun } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchesFromWarehouse,
  buildServingMatchStore
} from '../../../api/src/repositories/serving-match-store.js';
import {
  adaptFotMobDailyTerminalResults,
  type FotMobDailyObservation
} from '../sources/fotmob/fotmob-daily-adapter.js';
import {
  FotMobDailyClient,
  type FotMobDailyRequest,
  type FotMobDailyResponse
} from '../sources/fotmob/fotmob-daily-client.js';
import {
  FotMobResultJobLease,
  FotMobResultLedger,
  type FotMobDateOutcome,
  type FotMobMatchOutcome
} from '../sources/fotmob/fotmob-result-ledger.js';
import { FotMobAccessBlockedError } from '../sources/fotmob/fotmob-season-client.js';
import {
  buildFotMobTerminalPlan,
  type FotMobTerminalPlanGroup
} from '../sources/fotmob/fotmob-terminal-plan.js';
import {
  loadLastGoodWarehouseSnapshot,
  mergeCanonicalWarehouseSnapshots
} from '../sources/shared/canonical-snapshot-merge.js';

const PROVIDER_FAILURE_DELAY_MINUTES = 15;
const NON_TERMINAL_DELAY_MINUTES = 2;
const MISSING_OR_INVALID_DELAY_MINUTES = 5;

export interface FotMobDailyFetcher {
  getDailyMatches(request: FotMobDailyRequest): Promise<FotMobDailyResponse>;
}

export interface FotMobTerminalResultJobOptions {
  dataRoot: string;
  client?: FotMobDailyFetcher;
  registry?: readonly CompetitionSourceEntry[];
  timeZone: string;
  ownerCountryCode: string;
  maxRequestsPerRun?: number;
  now?: () => Date;
  leaseStaleAfterMs?: number;
}

export interface FotMobTerminalResultJobResult {
  status: 'completed' | 'partial' | 'idle' | 'lease_busy';
  datesPlanned: number;
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
  errors: string[];
}

interface SuccessfulGroup {
  group: FotMobTerminalPlanGroup;
  dateOutcome: FotMobDateOutcome;
  matchOutcomes: FotMobMatchOutcome[];
  delta: CanonicalWarehouseSnapshot;
  terminalEvidence: TerminalEvidenceMatch[];
}

interface FailedGroup {
  group: FotMobTerminalPlanGroup;
  message: string;
}

interface TerminalEvidenceMatch {
  matchId: string;
  providerMatchId: string;
  status: string;
  scoreHome: number | null;
  scoreAway: number | null;
}

export async function runFotMobTerminalResultJob(
  options: FotMobTerminalResultJobOptions
): Promise<FotMobTerminalResultJobResult> {
  const now = options.now ?? (() => new Date());
  const observedAt = now();
  if (Number.isNaN(observedAt.valueOf())) {
    throw new Error('FotMob terminal result clock is invalid.');
  }
  const maxRequests = options.maxRequestsPerRun ?? 2;
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 2) {
    throw new Error('FotMob terminal maxRequestsPerRun must be between 1 and 2.');
  }
  if (!/^[A-Z]{3}$/u.test(options.ownerCountryCode)) {
    throw new Error('FotMob terminal ownerCountryCode must be an ISO alpha-3 code.');
  }

  const lease = new FotMobResultJobLease({
    dataRoot: options.dataRoot,
    now: () => observedAt,
    ...(options.leaseStaleAfterMs === undefined
      ? {}
      : { staleAfterMs: options.leaseStaleAfterMs })
  });
  const leased = await lease.tryWithLease(() => execute({
    ...options,
    observedAt,
    maxRequests
  }));
  return leased.acquired ? leased.value : emptyResult('lease_busy');
}

async function execute(options: FotMobTerminalResultJobOptions & {
  observedAt: Date;
  maxRequests: number;
}): Promise<FotMobTerminalResultJobResult> {
  const registry = options.registry ?? COMPETITION_SOURCE_REGISTRY;
  const ledger = new FotMobResultLedger({
    dataRoot: options.dataRoot,
    now: () => options.observedAt
  });
  const [base, state] = await Promise.all([
    loadLastGoodWarehouseSnapshot(options.dataRoot),
    ledger.getState()
  ]);
  const plan = buildFotMobTerminalPlan({
    base,
    ledger: state,
    now: options.observedAt,
    timeZone: options.timeZone,
    maxDates: options.maxRequests
  });
  if (plan.groups.length === 0) {
    if (plan.exhaustedMatchIds.length > 0) {
      await ledger.recordBatch({
        dates: [],
        matches: plan.exhaustedMatchIds.map((matchId) => ({
          kind: 'exhausted' as const,
          matchId
        }))
      }, options.observedAt);
      return {
        ...emptyResult('completed'),
        matchesExhausted: plan.exhaustedMatchIds.length
      };
    }
    return emptyResult('idle');
  }

  const client = options.client ?? new FotMobDailyClient();
  const successfulGroups: SuccessfulGroup[] = [];
  const failedGroups: FailedGroup[] = [];
  let requestsAttempted = 0;
  let requestsSucceeded = 0;
  let requestsFailed = 0;
  let matchesMissing = 0;
  let nonTerminalObserved = 0;
  let circuitOpen = false;

  for (const [index, group] of plan.groups.entries()) {
    if (circuitOpen) {
      failedGroups.push({
        group,
        message: 'FotMob access circuit is open; provider date was not requested.'
      });
      continue;
    }
    requestsAttempted += 1;
    try {
      const response = await client.getDailyMatches({
        date: group.date,
        timeZone: options.timeZone,
        ownerCountryCode: options.ownerCountryCode,
        ...(group.etag === undefined ? {} : { etag: group.etag })
      });
      if (response.status === 'not_modified') {
        requestsSucceeded += 1;
        successfulGroups.push({
          group,
          dateOutcome: {
            kind: 'success',
            date: group.date,
            ...(response.etag === undefined ? {} : { etag: response.etag })
          },
          matchOutcomes: group.matches.map((match) => ({
            kind: 'retry',
            matchId: match.matchId,
            delayMinutes: NON_TERMINAL_DELAY_MINUTES
          })),
          delta: emptySnapshot(),
          terminalEvidence: []
        });
        continue;
      }

      const adapted = adaptFotMobDailyTerminalResults({
        registry,
        base,
        rawPayload: response.payload,
        observedAt: options.observedAt.toISOString()
      });
      const observations = uniqueObservations(adapted.observations);
      const matchOutcomes: FotMobMatchOutcome[] = [];
      for (const planned of group.matches) {
        const observation = observations.get(planned.matchId);
        if (!observation) {
          matchesMissing += 1;
          matchOutcomes.push({
            kind: 'retry',
            matchId: planned.matchId,
            delayMinutes: MISSING_OR_INVALID_DELAY_MINUTES
          });
        } else if (observation.outcome === 'terminal') {
          matchOutcomes.push({ kind: 'terminal', matchId: planned.matchId });
        } else {
          if (observation.outcome === 'non_terminal') nonTerminalObserved += 1;
          matchOutcomes.push({
            kind: 'retry',
            matchId: planned.matchId,
            delayMinutes: observation.outcome === 'non_terminal'
              ? NON_TERMINAL_DELAY_MINUTES
              : MISSING_OR_INVALID_DELAY_MINUTES
          });
        }
      }
      const plannedIds = new Set(group.matches.map((match) => match.matchId));
      const terminalObservedIds = new Set([...observations.values()]
        .filter((observation) => observation.outcome === 'terminal')
        .map((observation) => observation.matchId));
      const terminalMatches = adapted.delta.matches.filter((match) => (
        plannedIds.has(match.matchId) && terminalObservedIds.has(match.matchId)
      ));
      const terminalMatchIds = new Set(terminalMatches.map((match) => match.matchId));
      const terminalProvenance = adapted.delta.provenance.filter((item) => (
        terminalMatchIds.has(item.entityId)
      ));
      successfulGroups.push({
        group,
        dateOutcome: {
          kind: 'success',
          date: group.date,
          ...(response.etag === undefined ? {} : { etag: response.etag })
        },
        matchOutcomes,
        delta: {
          matches: terminalMatches,
          teams: [],
          competitions: [],
          links: [],
          provenance: terminalProvenance
        },
        terminalEvidence: terminalMatches.map((match) => ({
          matchId: match.matchId,
          providerMatchId: observations.get(match.matchId)!.providerMatchId,
          status: match.status,
          scoreHome: match.scoreHome,
          scoreAway: match.scoreAway
        }))
      });
      requestsSucceeded += 1;
    } catch (error) {
      requestsFailed += 1;
      const message = safeMessage(error);
      failedGroups.push({ group, message });
      if (error instanceof FotMobAccessBlockedError) {
        circuitOpen = true;
        for (const remaining of plan.groups.slice(index + 1)) {
          if (!failedGroups.some((failure) => failure.group.date === remaining.date)) {
            failedGroups.push({
              group: remaining,
              message: 'FotMob access circuit is open; provider date was not requested.'
            });
          }
        }
        break;
      }
    }
  }

  let publications = 0;
  const deltas = successfulGroups.filter((group) => group.delta.matches.length > 0);
  if (deltas.length > 0) {
    try {
      let candidate = base;
      for (const group of deltas) {
        candidate = mergeCanonicalWarehouseSnapshots(candidate, group.delta);
      }
      await Promise.all(deltas.map((group) => writeTerminalEvidence({
        dataRoot: options.dataRoot,
        date: group.group.date,
        observedAt: options.observedAt.toISOString(),
        ...(group.dateOutcome.kind === 'success' && group.dateOutcome.etag !== undefined
          ? { etag: group.dateOutcome.etag }
          : {}),
        matches: group.terminalEvidence
      })));
      const runId = resultRunId(options.observedAt);
      const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, candidate);
      const serving = await buildServingMatchesFromWarehouse({
        warehouseRoot,
        importedAt: options.observedAt.toISOString()
      });
      await buildServingMatchStore({
        servingRoot: path.join(options.dataRoot, 'serving'),
        version: runId,
        snapshotId: runId,
        generatedAt: options.observedAt.toISOString(),
        importedAt: options.observedAt.toISOString(),
        sources: serving.sources,
        matches: serving.matches,
        warehouseRunId: runId
      });
      publications = 1;
    } catch (error) {
      const message = `FotMob terminal publication failed: ${safeMessage(error)}`;
      for (const group of successfulGroups) failedGroups.push({ group: group.group, message });
      successfulGroups.length = 0;
      publications = 0;
    }
  }

  const dateOutcomes: FotMobDateOutcome[] = [
    ...successfulGroups.map((group) => group.dateOutcome),
    ...dedupeFailedGroups(failedGroups).map((failure) => ({
      kind: 'failure' as const,
      date: failure.group.date,
      error: failure.message,
      delayMinutes: PROVIDER_FAILURE_DELAY_MINUTES
    }))
  ];
  const failedMatchIds = new Set(failedGroups.flatMap((failure) => (
    failure.group.matches.map((match) => match.matchId)
  )));
  const matchOutcomes: FotMobMatchOutcome[] = [
    ...successfulGroups.flatMap((group) => group.matchOutcomes)
      .filter((outcome) => !failedMatchIds.has(outcome.matchId)),
    ...[...failedMatchIds].map((matchId) => ({
      kind: 'retry' as const,
      matchId,
      delayMinutes: MISSING_OR_INVALID_DELAY_MINUTES
    })),
    ...plan.exhaustedMatchIds.map((matchId) => ({
      kind: 'exhausted' as const,
      matchId
    }))
  ];
  await ledger.recordBatch({ dates: dateOutcomes, matches: matchOutcomes }, options.observedAt);

  const matchesTerminal = matchOutcomes.filter((outcome) => outcome.kind === 'terminal').length;
  const matchesRetried = matchOutcomes.filter((outcome) => outcome.kind === 'retry').length;
  const uniqueFailures = dedupeFailedGroups(failedGroups);
  return {
    status: uniqueFailures.length > 0 ? 'partial' : 'completed',
    datesPlanned: plan.groups.length,
    requestsAttempted,
    requestsSucceeded,
    requestsFailed,
    matchesTerminal,
    matchesRetried,
    matchesMissing,
    matchesExhausted: plan.exhaustedMatchIds.length,
    nonTerminalObserved,
    publications,
    circuitOpen,
    errors: uniqueFailures.map((failure) => `${failure.group.date}: ${failure.message}`)
  };
}

function uniqueObservations(
  observations: readonly FotMobDailyObservation[]
): Map<string, FotMobDailyObservation> {
  const byMatchId = new Map<string, FotMobDailyObservation>();
  for (const observation of observations) {
    const existing = byMatchId.get(observation.matchId);
    if (!existing) {
      byMatchId.set(observation.matchId, observation);
    } else if (existing.providerMatchId !== observation.providerMatchId
      || existing.outcome !== observation.outcome) {
      byMatchId.set(observation.matchId, {
        ...observation,
        outcome: 'invalid'
      });
    }
  }
  return byMatchId;
}

function dedupeFailedGroups(failures: readonly FailedGroup[]): FailedGroup[] {
  const byDate = new Map<string, FailedGroup>();
  for (const failure of failures) byDate.set(failure.group.date, failure);
  return [...byDate.values()].sort((left, right) => left.group.date.localeCompare(right.group.date));
}

async function writeTerminalEvidence(options: {
  dataRoot: string;
  date: string;
  observedAt: string;
  etag?: string;
  matches: readonly TerminalEvidenceMatch[];
}): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(options.date)) {
    throw new Error('FotMob terminal evidence date is unsafe.');
  }
  const directory = path.resolve(
    options.dataRoot,
    'providers',
    'fotmob-unofficial',
    'daily',
    options.date
  );
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, 'latest-terminal.json');
  const temporary = path.join(directory, `.latest-${process.pid}-${randomUUID()}.tmp`);
  const evidence = {
    schemaVersion: 'miraichi.fotmob-terminal-evidence.v1',
    provider: 'fotmob-unofficial',
    date: options.date,
    observedAt: options.observedAt,
    ...(options.etag === undefined ? {} : { etag: options.etag }),
    matches: [...options.matches].sort((left, right) => left.matchId.localeCompare(right.matchId))
  };
  try {
    await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx'
    });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

function emptySnapshot(): CanonicalWarehouseSnapshot {
  return { matches: [], teams: [], competitions: [], links: [], provenance: [] };
}

function resultRunId(observedAt: Date): string {
  return `fotmob-results-${observedAt.toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().slice(0, 8)}`;
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function emptyResult(
  status: 'completed' | 'idle' | 'lease_busy'
): FotMobTerminalResultJobResult {
  return {
    status,
    datesPlanned: 0,
    requestsAttempted: 0,
    requestsSucceeded: 0,
    requestsFailed: 0,
    matchesTerminal: 0,
    matchesRetried: 0,
    matchesMissing: 0,
    matchesExhausted: 0,
    nonTerminalObserved: 0,
    publications: 0,
    circuitOpen: false,
    errors: []
  };
}
