import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  API_FOOTBALL_QUOTA_CONFIG,
  type ApiFootballCompetitionEntry
} from '@miraichi/config';
import {
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchStore,
  buildServingMatchesFromWarehouse,
  readServingMatchStoreSnapshot
} from '../../../api/src/repositories/serving-match-store.js';
import { LocalMatchDetailStore } from '../../../api/src/repositories/local-match-detail-store.js';
import {
  ApiFootballClient,
  type ApiFootballFixtureItem
} from '../sources/api-football/api-football-client.js';
import { ApiFootballQuotaExceededError } from '../sources/api-football/api-football-usage-ledger.js';
import {
  adaptApiFootballMatches,
  adaptApiFootballMatchDetail
} from '../sources/api-football/api-football-adapter.js';
import { validateApiFootballPublicationCandidate } from '../sources/api-football/api-football-publication-validator.js';
import {
  loadLastGoodWarehouseSnapshot,
  mergeCanonicalWarehouseSnapshots
} from '../sources/api-football/api-football-snapshot-merge.js';
import { withApiFootballJobLease } from '../sources/api-football/api-football-job-lease.js';
import {
  planApiFootballIngestion,
  resolveProviderFixtureIdFromMatch,
  SCHEDULE_PLANNER_CONFIG,
  TERMINAL_STATUS_CODES
} from '../sources/api-football/api-football-schedule-planner.js';
import type { LocalMatch } from '@miraichi/shared';

export interface ConcludingWindow {
  matchId: string;
  providerFixtureId: number;
  kickoffUtc: string;
  windowStartUtc: string;
  windowEndUtc: string;
  status: string;
}

export interface ApiFootballIngestionJobOptions {
  dataRoot: string;
  mode?: 'daily_sync' | 'window_poll' | 'auto';
  date?: string;
  client?: ApiFootballClient;
  registry?: readonly ApiFootballCompetitionEntry[];
  now?: () => Date;
}

export interface ApiFootballIngestionRunResult {
  status: 'published' | 'synced' | 'not_modified' | 'skipped' | 'failed';
  runId: string;
  mode: 'daily_sync' | 'window_poll';
  matchesProcessed: number;
  matchesCompleted: number;
  concludingWindows?: ConcludingWindow[];
  quotaUsedToday: number;
  error?: string;
}

export function computeConcludingWindows(
  matches: readonly { matchId: string; providerFixtureId?: number; kickoffUtc: string; status: string }[],
  config = API_FOOTBALL_QUOTA_CONFIG
): ConcludingWindow[] {
  const windows: ConcludingWindow[] = [];

  for (const match of matches) {
    if (match.status !== 'scheduled') continue;
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (Number.isNaN(kickoffMs)) continue;

    const windowStartMs = kickoffMs + config.concludingWindowStartMinutes * 60_000;
    const windowEndMs = kickoffMs + config.concludingWindowEndMinutes * 60_000;

    const fixtureId = match.providerFixtureId;
    if (Number.isInteger(fixtureId) && fixtureId! > 0) {
      windows.push({
        matchId: match.matchId,
        providerFixtureId: fixtureId!,
        kickoffUtc: match.kickoffUtc,
        windowStartUtc: new Date(windowStartMs).toISOString(),
        windowEndUtc: new Date(windowEndMs).toISOString(),
        status: match.status
      });
    }
  }

  return windows;
}

export async function runApiFootballIngestionJob(
  options: ApiFootballIngestionJobOptions
): Promise<ApiFootballIngestionRunResult> {
  const now = options.now || (() => new Date());
  const runId = `api-football-run-${now().toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().slice(0, 8)}`;
  const registry = options.registry || API_FOOTBALL_COMPETITION_REGISTRY;
  const client = options.client || new ApiFootballClient({ now, dataRoot: options.dataRoot });
  const servingRoot = join(options.dataRoot, 'serving');

  let currentServingMatches: LocalMatch[] = [];
  try {
    const snapshot = await readServingMatchStoreSnapshot(servingRoot);
    currentServingMatches = snapshot.matches;
  } catch {
    currentServingMatches = [];
  }

  const ledgerState = await client.ledger.getState(now());
  const canRequest = await client.ledger.canRequest(false, now());

  const lastPolledAtByMatchId = new Map<string, string>();
  const nextDueAtByMatchId = new Map<string, string>();
  const lastReportedStatusByMatchId = new Map<string, string>();
  if (ledgerState.matchPollStates) {
    for (const [id, poll] of Object.entries(ledgerState.matchPollStates)) {
      if (poll.lastPolledAt) lastPolledAtByMatchId.set(id, poll.lastPolledAt);
      if (poll.nextDueAt) nextDueAtByMatchId.set(id, poll.nextDueAt);
      if (poll.lastReportedStatus) lastReportedStatusByMatchId.set(id, poll.lastReportedStatus);
    }
  }

  const plan = planApiFootballIngestion({
    mode: options.mode || 'auto',
    now: now(),
    targetDate: options.date,
    lastSuccessfulDailySyncDate: ledgerState.lastSuccessfulDailySyncDate,
    canRequest,
    matches: currentServingMatches,
    lastPolledAtByMatchId,
    nextDueAtByMatchId,
    lastReportedStatusByMatchId
  });

  const effectiveMode: 'daily_sync' | 'window_poll' =
    options.mode === 'window_poll' ? 'window_poll' : 'daily_sync';

  if (plan.actions.length === 0) {
    const quotaUsedToday = ledgerState.dailyUsage.reserved;
    if (plan.reason === 'quota_deferred') {
      await Promise.all(plan.dueMatches.map(({ match }) =>
        client.ledger.recordMatchPoll(match.id, {
          polledAt: null,
          nextDueAt: addSeconds(now(), API_FOOTBALL_QUOTA_CONFIG.pollingIntervalSeconds),
          sloEligibleAt: sloEligibleAt(match),
          deferralReason: 'quota'
        }, now())
      ));
      return {
        status: 'skipped',
        runId,
        mode: effectiveMode,
        matchesProcessed: 0,
        matchesCompleted: 0,
        quotaUsedToday,
        error: 'Normal API-Football quota ceiling reached'
      };
    }

    return {
      status: 'skipped',
      runId,
      mode: effectiveMode,
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday
    };
  }

  const dailySyncAction = plan.actions.find((a) => a.type === 'daily_sync');
  if (dailySyncAction && dailySyncAction.type === 'daily_sync') {
    return handleDailySync(options, client, registry, runId, dailySyncAction.date, now);
  }

  const windowPollActions = plan.actions.filter(
    (a): a is { type: 'window_poll'; fixtureIds: number[]; matches: LocalMatch[] } =>
      a.type === 'window_poll'
  );
  if (windowPollActions.length > 0) {
    return handleWindowPoll(options, client, registry, runId, windowPollActions, now);
  }

  return {
    status: 'skipped',
    runId,
    mode: effectiveMode,
    matchesProcessed: 0,
    matchesCompleted: 0,
    quotaUsedToday: await getReservedQuota(client, now())
  };
}

async function handleDailySync(
  options: ApiFootballIngestionJobOptions,
  client: ApiFootballClient,
  registry: readonly ApiFootballCompetitionEntry[],
  runId: string,
  targetDate: string,
  now: () => Date
): Promise<ApiFootballIngestionRunResult> {
  const servingRoot = join(options.dataRoot, 'serving');

  try {
    const response = await client.fetchFixturesByDate(targetDate, {
      timezone: API_FOOTBALL_QUOTA_CONFIG.ownerTimezone
    });
    const enabledLeagueIds = new Set(
      registry.filter((r) => r.enabled).map((r) => r.providerLeagueId)
    );

    const relevantFixtures = (response.response || []).filter((f) =>
      enabledLeagueIds.has(f.league?.id)
    );

    const adapted = adaptApiFootballMatches({
      registry,
      fixtures: relevantFixtures,
      observedAt: now().toISOString()
    });

    let publishedMatches: LocalMatch[] = [];

    // Merge base warehouse snapshot with daily sync delta under exclusive job lease
    await withApiFootballJobLease(options.dataRoot, async () => {
      const baseSnapshot = await loadLastGoodWarehouseSnapshot(options.dataRoot);
      const deltaSnapshot: CanonicalWarehouseSnapshot = {
        matches: adapted.matches,
        teams: adapted.teams,
        competitions: adapted.competitions,
        links: adapted.links,
        provenance: adapted.provenance
      };

      const mergedSnapshot = mergeCanonicalWarehouseSnapshots(baseSnapshot, deltaSnapshot);

      const validation = validateApiFootballPublicationCandidate({
        candidateMatches: mergedSnapshot.matches,
        priorMatches: baseSnapshot.matches
      });

      if (!validation.ok) {
        throw new Error(`Publication validation failed: ${validation.errors.join('; ')}`);
      }

      const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, mergedSnapshot);

      const servingMatches = await buildServingMatchesFromWarehouse({
        warehouseRoot,
        importedAt: now().toISOString()
      });
      publishedMatches = servingMatches.matches;

      await upsertFixtureDetails(
        options.dataRoot,
        relevantFixtures,
        publishedMatches,
        now
      );

      await buildServingMatchStore({
        servingRoot,
        version: runId,
        snapshotId: runId,
        generatedAt: now().toISOString(),
        importedAt: now().toISOString(),
        sources: servingMatches.sources,
        matches: servingMatches.matches,
        warehouseRunId: runId
      });
    });

    // Record successful daily sync
    await client.ledger.recordSuccessfulDailySync(targetDate, now());

    const providerFixtureIdsByMatchId = new Map(
      adapted.links
        .filter((link) =>
          link.entityType === 'match' &&
          link.provider === 'api-football' &&
          link.providerEntityType === 'fixture'
        )
        .map((link) => [link.entityId, parseProviderFixtureId(link.providerEntityId)] as const)
        .filter((entry): entry is readonly [string, number] => entry[1] !== null)
    );
    const windows = computeConcludingWindows(adapted.matches.map((match) => {
      const providerFixtureId = providerFixtureIdsByMatchId.get(match.matchId);
      return {
        matchId: match.matchId,
        kickoffUtc: match.kickoffUtc,
        status: match.status,
        ...(providerFixtureId === undefined ? {} : { providerFixtureId })
      };
    }));
    const completedCount = adapted.matches.filter((m) => m.status === 'completed').length;

    return {
      status: 'synced',
      runId,
      mode: 'daily_sync',
      matchesProcessed: adapted.matches.length,
      matchesCompleted: completedCount,
      concludingWindows: windows,
      quotaUsedToday: await getReservedQuota(client, now())
    };
  } catch (error) {
    return {
      status: 'failed',
      runId,
      mode: 'daily_sync',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: await getReservedQuota(client, now()),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function handleWindowPoll(
  options: ApiFootballIngestionJobOptions,
  client: ApiFootballClient,
  registry: readonly ApiFootballCompetitionEntry[],
  runId: string,
  windowPollActions: Array<{ type: 'window_poll'; fixtureIds: number[]; matches: LocalMatch[] }>,
  now: () => Date
): Promise<ApiFootballIngestionRunResult> {
  const servingRoot = join(options.dataRoot, 'serving');
  const attemptedMatches = windowPollActions.flatMap((action) => action.matches);
  const terminalPolls: Array<{ match: LocalMatch; status: string }> = [];

  try {
    const allReturnedFixtures: ApiFootballFixtureItem[] = [];
    for (const pollAction of windowPollActions) {
      const response = await client.fetchFixturesByIds(pollAction.fixtureIds);
      const returnedFixtures = response.response || [];
      allReturnedFixtures.push(...returnedFixtures);
      for (const match of pollAction.matches) {
        const fixtureId = resolveProviderFixtureIdFromMatch(match);
        const fixtureItem = returnedFixtures.find((f) => f.fixture?.id === fixtureId);
        const statusShort = fixtureItem?.fixture?.status?.short?.toUpperCase();
        if (!fixtureItem || !statusShort) {
          await recordPollDeferral(client, match, 'unknown_fixture', now);
        } else if (TERMINAL_STATUS_CODES.has(statusShort)) {
          terminalPolls.push({ match, status: statusShort });
        } else {
          await client.ledger.recordMatchPoll(match.id, {
            polledAt: now().toISOString(),
            lastReportedStatus: statusShort,
            nextDueAt: addSeconds(now(), API_FOOTBALL_QUOTA_CONFIG.pollingIntervalSeconds),
            sloEligibleAt: sloEligibleAt(match)
          }, now());
        }
      }
    }

    const adapted = adaptApiFootballMatches({
      registry,
      fixtures: allReturnedFixtures,
      observedAt: now().toISOString()
    });

    const completedCount = adapted.matches.filter((match) => match.status === 'completed').length;

    const adaptedFixtureIds = new Set(adapted.links
      .filter((link) =>
        link.entityType === 'match' &&
        link.provider === 'api-football' &&
        link.providerEntityType === 'fixture'
      )
      .map((link) => parseProviderFixtureId(link.providerEntityId))
      .filter((fixtureId): fixtureId is number => fixtureId !== null));
    for (const terminalPoll of terminalPolls) {
      const fixtureId = resolveProviderFixtureIdFromMatch(terminalPoll.match);
      if (fixtureId !== null && !adaptedFixtureIds.has(fixtureId)) {
        await recordPollDeferral(client, terminalPoll.match, 'coverage', now);
      }
    }

    // Check if any returned fixture is live/non-terminal
    const hasLiveOrNonTerminal = allReturnedFixtures.some((f) => {
      const short = f.fixture?.status?.short?.toUpperCase() || '';
      return !TERMINAL_STATUS_CODES.has(short);
    });

    const allMatchesTerminal =
      !hasLiveOrNonTerminal &&
      terminalPolls.length === attemptedMatches.length &&
      adapted.matches.length === attemptedMatches.length &&
      adapted.matches.every(
        (m) => m.status === 'completed' || m.status === 'postponed' || m.status === 'cancelled'
      );

    if (!allMatchesTerminal) {
      return {
        status: 'not_modified',
        runId,
        mode: 'window_poll',
        matchesProcessed: adapted.matches.length,
        matchesCompleted: completedCount,
        quotaUsedToday: await getReservedQuota(client, now())
      };
    }

    if (terminalPolls.some(({ match }) => {
      const fixtureId = resolveProviderFixtureIdFromMatch(match);
      return fixtureId === null || !adaptedFixtureIds.has(fixtureId);
    })) {
      return {
        status: 'not_modified',
        runId,
        mode: 'window_poll',
        matchesProcessed: adapted.matches.length,
        matchesCompleted: completedCount,
        quotaUsedToday: await getReservedQuota(client, now())
      };
    }

    let publishedMatches: LocalMatch[] = [];

    // Merge base warehouse snapshot with window poll delta under exclusive job lease
    await withApiFootballJobLease(options.dataRoot, async () => {
      const baseSnapshot = await loadLastGoodWarehouseSnapshot(options.dataRoot);
      const deltaSnapshot: CanonicalWarehouseSnapshot = {
        matches: adapted.matches,
        teams: adapted.teams,
        competitions: adapted.competitions,
        links: adapted.links,
        provenance: adapted.provenance
      };

      const mergedSnapshot = mergeCanonicalWarehouseSnapshots(baseSnapshot, deltaSnapshot);

      const validation = validateApiFootballPublicationCandidate({
        candidateMatches: mergedSnapshot.matches,
        priorMatches: baseSnapshot.matches
      });

      if (!validation.ok) {
        throw new Error(`Publication validation failed: ${validation.errors.join('; ')}`);
      }

      const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, mergedSnapshot);

      const servingMatches = await buildServingMatchesFromWarehouse({
        warehouseRoot,
        importedAt: now().toISOString()
      });
      publishedMatches = servingMatches.matches;

      await upsertFixtureDetails(
        options.dataRoot,
        allReturnedFixtures,
        publishedMatches,
        now
      );

      await buildServingMatchStore({
        servingRoot,
        version: runId,
        snapshotId: runId,
        generatedAt: now().toISOString(),
        importedAt: now().toISOString(),
        sources: servingMatches.sources,
        matches: servingMatches.matches,
        warehouseRunId: runId
      });
    });

    for (const { match, status } of terminalPolls) {
      await client.ledger.recordMatchPoll(match.id, {
        polledAt: now().toISOString(),
        lastReportedStatus: status,
        nextDueAt: null,
        sloEligibleAt: sloEligibleAt(match)
      }, now());
    }

    return {
      status: 'published',
      runId,
      mode: 'window_poll',
      matchesProcessed: adapted.matches.length,
      matchesCompleted: completedCount,
      quotaUsedToday: await getReservedQuota(client, now())
    };
  } catch (error) {
    const reason = error instanceof ApiFootballQuotaExceededError ? 'quota' : 'provider_error';
    await Promise.all(attemptedMatches.map((match) =>
      recordPollDeferral(client, match, reason, now).catch(() => undefined)
    ));
    return {
      status: 'failed',
      runId,
      mode: 'window_poll',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: await getReservedQuota(client, now()),
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function addSeconds(date: Date, seconds: number): string {
  return new Date(date.getTime() + seconds * 1000).toISOString();
}

function sloEligibleAt(match: LocalMatch): string {
  const kickoffMs = Date.parse(match.kickoffUtc);
  return new Date(
    kickoffMs + SCHEDULE_PLANNER_CONFIG.concludingWindowStartMinutes * 60_000
  ).toISOString();
}

async function recordPollDeferral(
  client: ApiFootballClient,
  match: LocalMatch,
  reason: 'quota' | 'provider_error' | 'unknown_fixture' | 'coverage',
  now: () => Date
): Promise<void> {
  await client.ledger.recordMatchPoll(match.id, {
    polledAt: reason === 'quota' ? null : now().toISOString(),
    nextDueAt: addSeconds(now(), API_FOOTBALL_QUOTA_CONFIG.pollingIntervalSeconds),
    sloEligibleAt: sloEligibleAt(match),
    deferralReason: reason
  }, now());
}

async function upsertFixtureDetails(
  dataRoot: string,
  fixtures: readonly ApiFootballFixtureItem[],
  publishedMatches: readonly LocalMatch[],
  now: () => Date
): Promise<void> {
  const detailStore = new LocalMatchDetailStore({ dataRoot });
  for (const fixture of fixtures) {
    if (!fixture.fixture?.id) continue;
    const fixtureId = String(fixture.fixture.id);
    const localMatch = publishedMatches.find((match) =>
      match.sourceRefs.some(
        (ref) => ref.sourceId === 'api-football' && String(ref.sourceMatchId) === fixtureId
      )
    );
    if (!localMatch || localMatch.status !== 'completed') continue;

    await detailStore.upsertDetail(adaptApiFootballMatchDetail({
      fixtureItem: fixture,
      canonicalMatch: localMatch,
      observedAt: now().toISOString()
    }));
  }
}

function parseProviderFixtureId(value: string | undefined): number | null {
  if (value === undefined || !/^\d+$/u.test(value)) return null;
  const fixtureId = Number(value);
  return Number.isSafeInteger(fixtureId) && fixtureId > 0 ? fixtureId : null;
}

async function getReservedQuota(client: ApiFootballClient, now: Date): Promise<number> {
  return (await client.ledger.getState(now)).dailyUsage.reserved;
}
