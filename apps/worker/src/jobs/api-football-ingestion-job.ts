import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  API_FOOTBALL_QUOTA_CONFIG,
  type ApiFootballCompetitionEntry,
  findCompetitionByLeagueId
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
import {
  ApiFootballClient,
  type ApiFootballFixtureItem
} from '../sources/api-football/api-football-client.js';
import { adaptApiFootballMatches } from '../sources/api-football/api-football-adapter.js';
import { validateApiFootballPublicationCandidate } from '../sources/api-football/api-football-publication-validator.js';
import type { CanonicalMatch, LocalMatch } from '@miraichi/shared';

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
  matches: readonly { matchId: string; kickoffUtc: string; status: string }[],
  config = API_FOOTBALL_QUOTA_CONFIG
): ConcludingWindow[] {
  const windows: ConcludingWindow[] = [];

  for (const match of matches) {
    if (match.status !== 'scheduled') continue;
    const kickoffMs = Date.parse(match.kickoffUtc);
    if (Number.isNaN(kickoffMs)) continue;

    const windowStartMs = kickoffMs + config.concludingWindowStartMinutes * 60_000;
    const windowEndMs = kickoffMs + config.concludingWindowEndMinutes * 60_000;

    // Extract provider fixture ID from match ID (e.g. match-eng-premier-league-2026-1001)
    const parts = match.matchId.split('-');
    const fixtureIdStr = parts[parts.length - 1];
    const fixtureId = fixtureIdStr ? parseInt(fixtureIdStr, 10) : NaN;

    if (!Number.isNaN(fixtureId)) {
      windows.push({
        matchId: match.matchId,
        providerFixtureId: fixtureId,
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
  const client = options.client || new ApiFootballClient({ now });
  const servingRoot = join(options.dataRoot, 'serving');
  const targetDate = options.date || now().toISOString().slice(0, 10);

  // Auto mode selection: if window_poll requested or ongoing matches in window, run window_poll, else daily_sync
  let mode = options.mode || 'auto';
  if (mode === 'auto') {
    // Check if there are active matches in concluding window
    let currentServingMatches: LocalMatch[] = [];
    try {
      const snapshot = await readServingMatchStoreSnapshot(servingRoot);
      currentServingMatches = snapshot.matches;
    } catch {
      currentServingMatches = [];
    }

    const currentMs = now().getTime();
    const activeInWindow = currentServingMatches.some((m) => {
      if (m.status !== 'scheduled') return false;
      const kMs = Date.parse(m.kickoffUtc);
      return (
        currentMs >= kMs + API_FOOTBALL_QUOTA_CONFIG.concludingWindowStartMinutes * 60_000 &&
        currentMs <= kMs + API_FOOTBALL_QUOTA_CONFIG.concludingWindowEndMinutes * 60_000
      );
    });

    mode = activeInWindow ? 'window_poll' : 'daily_sync';
  }

  if (mode === 'daily_sync') {
    return handleDailySync(options, client, registry, runId, targetDate, now);
  } else {
    return handleWindowPoll(options, client, registry, runId, now);
  }
}

async function handleDailySync(
  options: ApiFootballIngestionJobOptions,
  client: ApiFootballClient,
  registry: readonly ApiFootballCompetitionEntry[],
  runId: string,
  targetDate: string,
  now: () => Date
): Promise<ApiFootballIngestionRunResult> {
  if (!client.quotaGuard.canRequest(false, now())) {
    return {
      status: 'skipped',
      runId,
      mode: 'daily_sync',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday,
      error: 'Daily quota ceiling reached'
    };
  }

  try {
    const response = await client.fetchFixturesByDate(targetDate);
    const enabledLeagueIds = new Set(
      registry.filter((r) => r.enabled).map((r) => r.providerLeagueId)
    );

    const relevantFixtures = (response.response || []).filter((f) =>
      enabledLeagueIds.has(f.league?.id)
    );

    const adapted = adaptApiFootballMatches({
      fixtures: relevantFixtures,
      observedAt: now().toISOString()
    });

    // Merge or write to warehouse
    const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, {
      matches: adapted.matches,
      teams: adapted.teams,
      competitions: adapted.competitions,
      links: adapted.links,
      provenance: adapted.provenance
    });

    const servingMatches = await buildServingMatchesFromWarehouse({
      warehouseRoot,
      importedAt: now().toISOString()
    });

    const servingRoot = join(options.dataRoot, 'serving');
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

    const windows = computeConcludingWindows(adapted.matches);
    const completedCount = adapted.matches.filter((m) => m.status === 'completed').length;

    return {
      status: 'synced',
      runId,
      mode: 'daily_sync',
      matchesProcessed: adapted.matches.length,
      matchesCompleted: completedCount,
      concludingWindows: windows,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday
    };
  } catch (error) {
    return {
      status: 'failed',
      runId,
      mode: 'daily_sync',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function handleWindowPoll(
  options: ApiFootballIngestionJobOptions,
  client: ApiFootballClient,
  registry: readonly ApiFootballCompetitionEntry[],
  runId: string,
  now: () => Date
): Promise<ApiFootballIngestionRunResult> {
  const servingRoot = join(options.dataRoot, 'serving');
  let currentServingMatches: LocalMatch[] = [];

  try {
    const snapshot = await readServingMatchStoreSnapshot(servingRoot);
    currentServingMatches = snapshot.matches;
  } catch {
    return {
      status: 'skipped',
      runId,
      mode: 'window_poll',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday,
      error: 'Serving store snapshot not found'
    };
  }

  const currentMs = now().getTime();
  const concludingMatches: Array<{ match: LocalMatch; fixtureId: number }> = [];

  for (const match of currentServingMatches) {
    if (match.status !== 'scheduled') continue;
    const kMs = Date.parse(match.kickoffUtc);
    if (Number.isNaN(kMs)) continue;

    const inWindow =
      currentMs >= kMs + API_FOOTBALL_QUOTA_CONFIG.concludingWindowStartMinutes * 60_000 &&
      currentMs <= kMs + API_FOOTBALL_QUOTA_CONFIG.concludingWindowEndMinutes * 60_000;

    if (inWindow) {
      const parts = match.id.split('-');
      const fixtureId = parseInt(parts[parts.length - 1] || '', 10);
      if (!Number.isNaN(fixtureId)) {
        concludingMatches.push({ match, fixtureId });
      }
    }
  }

  if (concludingMatches.length === 0) {
    return {
      status: 'skipped',
      runId,
      mode: 'window_poll',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday
    };
  }

  if (!client.quotaGuard.canRequest(false, now())) {
    return {
      status: 'skipped',
      runId,
      mode: 'window_poll',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday,
      error: 'Daily quota ceiling reached'
    };
  }

  try {
    const fixtureIds = concludingMatches.map((c) => c.fixtureId);
    const response = await client.fetchFixturesByIds(fixtureIds);

    const adapted = adaptApiFootballMatches({
      fixtures: response.response || [],
      observedAt: now().toISOString()
    });

    const validation = validateApiFootballPublicationCandidate({
      candidateMatches: adapted.matches,
      priorMatches: currentServingMatches.map((m) => ({
        matchId: m.id,
        competitionId: m.competition.id,
        season: m.competition.season,
        kickoffUtc: m.kickoffUtc,
        status: m.status,
        homeTeamId: m.homeTeam.id,
        awayTeamId: m.awayTeam.id,
        scoreHome: m.score.home,
        scoreAway: m.score.away,
        updatedAt: m.updatedAt
      }))
    });

    if (!validation.ok) {
      return {
        status: 'failed',
        runId,
        mode: 'window_poll',
        matchesProcessed: adapted.matches.length,
        matchesCompleted: 0,
        quotaUsedToday: client.quotaGuard.getState(now()).usedToday,
        error: `Publication validation failed: ${validation.errors.join('; ')}`
      };
    }

    // Write updated warehouse run & rebuild serving store
    const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, {
      matches: adapted.matches,
      teams: adapted.teams,
      competitions: adapted.competitions,
      links: adapted.links,
      provenance: adapted.provenance
    });

    const servingMatches = await buildServingMatchesFromWarehouse({
      warehouseRoot,
      importedAt: now().toISOString()
    });

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

    const completedCount = adapted.matches.filter((m) => m.status === 'completed').length;

    return {
      status: 'published',
      runId,
      mode: 'window_poll',
      matchesProcessed: adapted.matches.length,
      matchesCompleted: completedCount,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday
    };
  } catch (error) {
    return {
      status: 'failed',
      runId,
      mode: 'window_poll',
      matchesProcessed: 0,
      matchesCompleted: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
