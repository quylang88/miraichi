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
  buildServingMatchesFromWarehouse,
} from '../../../api/src/repositories/serving-match-store.js';
import {
  ApiFootballClient,
  ApiFootballQuotaExceededError
} from '../sources/api-football/api-football-client.js';
import { adaptApiFootballMatches } from '../sources/api-football/api-football-adapter.js';
import { HydrationCheckpointManager } from '../sources/api-football/hydration-checkpoint-manager.js';

export interface ApiFootballHydrationJobOptions {
  dataRoot: string;
  client?: ApiFootballClient;
  checkpointManager?: HydrationCheckpointManager;
  registry?: readonly ApiFootballCompetitionEntry[];
  maxBatchesPerRun?: number;
  now?: () => Date;
}

export interface ApiFootballHydrationRunResult {
  status: 'completed' | 'partial' | 'skipped' | 'failed';
  runId: string;
  seasonsHydrated: number;
  matchesHydrated: number;
  pendingCount: number;
  quotaUsedToday: number;
  error?: string;
}

export async function runApiFootballHydrationJob(
  options: ApiFootballHydrationJobOptions
): Promise<ApiFootballHydrationRunResult> {
  const now = options.now || (() => new Date());
  const runId = `api-football-hydration-${now().toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().slice(0, 8)}`;
  const registry = options.registry || API_FOOTBALL_COMPETITION_REGISTRY;
  const client = options.client || new ApiFootballClient({ now });
  const checkpointStoragePath = join(options.dataRoot, 'hydration-checkpoints.json');
  const checkpointManager = options.checkpointManager || new HydrationCheckpointManager({ storagePath: checkpointStoragePath });

  await checkpointManager.load();

  const pendingTargets = checkpointManager.getPendingHydrations(registry);

  if (pendingTargets.length === 0) {
    return {
      status: 'skipped',
      runId,
      seasonsHydrated: 0,
      matchesHydrated: 0,
      pendingCount: 0,
      quotaUsedToday: client.quotaGuard.getState(now()).usedToday
    };
  }

  const maxBatches = options.maxBatchesPerRun || 50;
  const targetsToProcess = pendingTargets.slice(0, maxBatches);

  let seasonsHydrated = 0;
  let matchesHydrated = 0;
  let hitQuotaLimit = false;

  const accumulatedSnapshot: CanonicalWarehouseSnapshot = {
    matches: [],
    teams: [],
    competitions: [],
    links: [],
    provenance: []
  };

  for (const target of targetsToProcess) {
    if (!client.quotaGuard.canRequest(false, now())) {
      hitQuotaLimit = true;
      break;
    }

    try {
      const response = await client.fetchSeasonFixtures(target.entry.providerLeagueId, target.season);
      const adapted = adaptApiFootballMatches({
        competitionEntry: target.entry,
        fixtures: response.response || [],
        observedAt: now().toISOString()
      });

      accumulatedSnapshot.matches.push(...adapted.matches);
      accumulatedSnapshot.teams.push(...adapted.teams);
      accumulatedSnapshot.competitions.push(...adapted.competitions);
      accumulatedSnapshot.links.push(...adapted.links);
      accumulatedSnapshot.provenance.push(...adapted.provenance);

      await checkpointManager.markCompleted(
        target.entry.competitionId,
        target.entry.providerLeagueId,
        target.season,
        adapted.matches.length,
        now()
      );

      seasonsHydrated += 1;
      matchesHydrated += adapted.matches.length;
    } catch (error) {
      if (error instanceof ApiFootballQuotaExceededError) {
        hitQuotaLimit = true;
        break;
      }
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

  // Publish whatever we have accumulated to warehouse and serving store
  if (accumulatedSnapshot.matches.length > 0) {
    const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, accumulatedSnapshot);
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
  }

  const remainingPending = checkpointManager.getPendingHydrations(registry).length;

  return {
    status: remainingPending === 0 ? 'completed' : hitQuotaLimit ? 'partial' : 'partial',
    runId,
    seasonsHydrated,
    matchesHydrated,
    pendingCount: remainingPending,
    quotaUsedToday: client.quotaGuard.getState(now()).usedToday
  };
}
