import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry
} from '@miraichi/config';
import {
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchStore,
  buildServingMatchesFromWarehouse
} from '../../../api/src/repositories/serving-match-store.js';
import {
  ApiFootballClient,
  ApiFootballQuotaExceededError
} from '../sources/api-football/api-football-client.js';
import { adaptApiFootballMatches } from '../sources/api-football/api-football-adapter.js';
import {
  HydrationCheckpointManager,
  type HydrationSeasonLayer,
  type HydrationTarget
} from '../sources/api-football/hydration-checkpoint-manager.js';
import {
  loadLastGoodWarehouseSnapshot,
  mergeCanonicalWarehouseSnapshots
} from '../sources/api-football/api-football-snapshot-merge.js';
import { withApiFootballJobLease } from '../sources/api-football/api-football-job-lease.js';
import { validateApiFootballPublicationCandidate } from '../sources/api-football/api-football-publication-validator.js';

export interface ApiFootballHydrationJobOptions {
  dataRoot: string;
  client?: ApiFootballClient | undefined;
  checkpointManager?: HydrationCheckpointManager | undefined;
  registry?: readonly ApiFootballCompetitionEntry[] | undefined;
  maxBatchesPerRun?: number | undefined;
  seasonLayer?: HydrationSeasonLayer | undefined;
  competitionId?: string | undefined;
  category?: string | undefined;
  now?: () => Date;
}

export interface ApiFootballHydrationRunResult {
  status: 'completed' | 'partial' | 'skipped' | 'failed';
  runId: string;
  seasonsHydrated: number;
  matchesHydrated: number;
  pendingCount: number;
  quotaUsedToday: number;
  emptyCount: number;
  failedCount: number;
  error?: string;
}

export async function runApiFootballHydrationJob(
  options: ApiFootballHydrationJobOptions
): Promise<ApiFootballHydrationRunResult> {
  const now = options.now || (() => new Date());
  const runId = `api-football-hydration-${now().toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().slice(0, 8)}`;
  const registry = options.registry || API_FOOTBALL_COMPETITION_REGISTRY;
  const client = options.client || new ApiFootballClient({ now, dataRoot: options.dataRoot });
  const checkpointStoragePath = join(options.dataRoot, 'hydration-checkpoints.json');
  const checkpointManager = options.checkpointManager || new HydrationCheckpointManager({ storagePath: checkpointStoragePath });

  await checkpointManager.load();

  const filterOpts = {
    seasonLayer: options.seasonLayer,
    competitionId: options.competitionId,
    category: options.category
  };

  const pendingTargets = checkpointManager.getPendingHydrations(registry, filterOpts);

  if (pendingTargets.length === 0) {
    return {
      status: 'skipped',
      runId,
      seasonsHydrated: 0,
      matchesHydrated: 0,
      pendingCount: 0,
      emptyCount: 0,
      failedCount: 0,
      quotaUsedToday: await getReservedQuota(client, now())
    };
  }

  const maxBatches = options.maxBatchesPerRun || 50;
  const targetsToProcess = pendingTargets.slice(0, maxBatches);

  let seasonsHydrated = 0;
  let matchesHydrated = 0;
  let emptyCount = 0;
  let failedCount = 0;
  const accumulatedSnapshot: CanonicalWarehouseSnapshot = {
    matches: [],
    teams: [],
    competitions: [],
    links: [],
    provenance: []
  };

  const stagedSuccessfulTargets: Array<{ target: HydrationTarget; matchCount: number }> = [];

  for (const target of targetsToProcess) {
    if (!(await client.ledger.canRequest(false, now()))) {
      break;
    }

    try {
      const response = await client.fetchSeasonFixtures(target.entry.providerLeagueId, target.season);
      const fixtures = response.response || [];

      if (fixtures.length === 0) {
        emptyCount += 1;
        await checkpointManager.markEmpty(
          target.entry.competitionId,
          target.entry.providerLeagueId,
          target.season,
          now()
        );
        continue;
      }

      const adapted = adaptApiFootballMatches({
        competitionEntry: target.entry,
        expectedSeason: target.season,
        fixtures,
        observedAt: now().toISOString()
      });

      if (adapted.matches.length === 0 || adapted.issues.length > 0) {
        const issueSummary = adapted.issues.length > 0
          ? adapted.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
          : 'adapter produced no canonical matches';
        throw new Error(`api_football_hydration_adaptation_failed: ${issueSummary}`);
      }

      accumulatedSnapshot.matches.push(...adapted.matches);
      accumulatedSnapshot.teams.push(...adapted.teams);
      accumulatedSnapshot.competitions.push(...adapted.competitions);
      accumulatedSnapshot.links.push(...adapted.links);
      accumulatedSnapshot.provenance.push(...adapted.provenance);

      stagedSuccessfulTargets.push({ target, matchCount: adapted.matches.length });
      seasonsHydrated += 1;
      matchesHydrated += adapted.matches.length;
    } catch (error) {
      if (error instanceof ApiFootballQuotaExceededError) {
        break;
      }
      failedCount += 1;
      const errMsg = error instanceof Error ? error.message : String(error);
      await checkpointManager.markFailed(
        target.entry.competitionId,
        target.entry.providerLeagueId,
        target.season,
        errMsg,
        now()
      );
    }
  }

  if (stagedSuccessfulTargets.length > 0) {
    await withApiFootballJobLease(options.dataRoot, async () => {
      const baseSnapshot = await loadLastGoodWarehouseSnapshot(options.dataRoot);
      const mergedSnapshot = mergeCanonicalWarehouseSnapshots(baseSnapshot, accumulatedSnapshot);

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

      const servingRoot = join(options.dataRoot, 'serving');
      for (const staged of stagedSuccessfulTargets) {
        const found = servingMatches.matches.some(
          (m) =>
            m.competition.id === staged.target.entry.competitionId &&
            m.competition.season === String(staged.target.season)
        );
        if (!found && staged.matchCount > 0) {
          throw new Error(
            `Hydration target ${staged.target.entry.competitionId} season ${staged.target.season} missing in published serving store`
          );
        }
      }

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

      await checkpointManager.markCompletedBatch(
        stagedSuccessfulTargets.map((staged) => ({
          competitionId: staged.target.entry.competitionId,
          leagueId: staged.target.entry.providerLeagueId,
          season: staged.target.season,
          matchCount: staged.matchCount
        })),
        now()
      );
    });
  }

  const remainingPending = checkpointManager.getPendingHydrations(registry, filterOpts).length;

  return {
    status: remainingPending === 0 ? 'completed' : (seasonsHydrated === 0 && emptyCount === 0 && failedCount > 0 ? 'failed' : 'partial'),
    runId,
    seasonsHydrated,
    matchesHydrated,
    pendingCount: remainingPending,
    emptyCount,
    failedCount,
    quotaUsedToday: await getReservedQuota(client, now())
  };
}

async function getReservedQuota(client: ApiFootballClient, now: Date): Promise<number> {
  return (await client.ledger.getState(now)).dailyUsage.reserved;
}
