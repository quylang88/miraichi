import path from 'node:path';
import fs from 'node:fs';
import { toProviderNeutralLocalMatch, type LocalMatch } from '@miraichi/shared';
import { LocalMatchDetailStore } from '../../../api/src/repositories/local-match-detail-store.js';
import {
  MatchDetailRefreshQueue,
  type MatchDetailRefreshItem
} from '../../../api/src/repositories/match-detail-refresh-queue.js';
import type { MatchSnapshotRepository } from '../../../api/src/repositories/match-snapshot-repository.js';
import { ServingMatchStoreRepository } from '../../../api/src/repositories/serving-match-store-repository.js';
import {
  ApiFootballClient,
  ApiFootballQuotaExceededError,
  type ApiFootballApiResponse,
  type ApiFootballFixtureItem
} from '../sources/api-football/api-football-client.js';
import { ApiFootballUsageLedger } from '../sources/api-football/api-football-usage-ledger.js';
import { adaptApiFootballMatchDetail } from '../sources/api-football/api-football-adapter.js';
import {
  chunkFixtureIds,
  resolveProviderFixtureIdFromMatch
} from '../sources/api-football/api-football-schedule-planner.js';

function findRootDir(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

export function defaultDataRoot(): string {
  const rootDir = findRootDir(process.cwd());
  return path.resolve(rootDir, 'apps/api/data');
}

export interface ApiFootballMatchDetailJobOptions {
  dataRoot?: string;
  servingRoot?: string;
  client?: ApiFootballClient;
  ledger?: ApiFootballUsageLedger;
  queue?: MatchDetailRefreshQueue;
  detailStore?: LocalMatchDetailStore;
  repository?: MatchSnapshotRepository;
  batchSize?: number;
  retryDelayMs?: number;
  now?: () => Date;
  logger?: (msg: string) => void;
}

export interface ApiFootballMatchDetailJobResult {
  status: 'idle' | 'success' | 'skipped' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsCompleted: number;
  itemsDeferred: number;
  itemsFailed: number;
  quotaUsedToday: number;
  error?: string;
}

interface ValidQueueItem {
  item: MatchDetailRefreshItem;
  match: LocalMatch;
  fixtureId: number;
}

export async function runApiFootballMatchDetailJob(
  options: ApiFootballMatchDetailJobOptions = {}
): Promise<ApiFootballMatchDetailJobResult> {
  const nowFn = options.now || (() => new Date());
  const now = nowFn();
  const logger = options.logger || (() => {});

  const configuredDataRoot = options.dataRoot || process.env.PROVIDER_CAPTURE_ROOT || defaultDataRoot();
  const dataRoot = path.isAbsolute(configuredDataRoot)
    ? configuredDataRoot
    : path.resolve(findRootDir(process.cwd()), configuredDataRoot);

  const configuredServingRoot =
    options.servingRoot || process.env.LOCAL_MATCH_SERVING_ROOT || path.resolve(dataRoot, 'serving');
  const servingRoot = path.isAbsolute(configuredServingRoot)
    ? configuredServingRoot
    : path.resolve(findRootDir(process.cwd()), configuredServingRoot);

  const ledger = options.ledger ?? (options.client ? options.client.ledger : new ApiFootballUsageLedger({ dataRoot, now: nowFn }));
  const client = options.client ?? new ApiFootballClient({ dataRoot, ledger, now: nowFn });
  const queue = options.queue ?? new MatchDetailRefreshQueue({ dataRoot, now: nowFn });
  const detailStore = options.detailStore ?? new LocalMatchDetailStore({ dataRoot });
  const repository = options.repository ?? new ServingMatchStoreRepository({ servingRoot, now: nowFn });

  try {
    const rawBatchSize = options.batchSize ?? 20;
    const batchSize = Math.max(1, rawBatchSize);
    const dueItems = await queue.getDueItems(batchSize, now);

    if (dueItems.length === 0) {
      const ledgerState = await ledger.getState(now);
      return {
        status: 'idle',
        itemsProcessed: 0,
        itemsCompleted: 0,
        itemsDeferred: 0,
        itemsFailed: 0,
        quotaUsedToday: ledgerState.dailyUsage.reserved
      };
    }

    const validItems: ValidQueueItem[] = [];
    let itemsFailed = 0;
    let itemsCompleted = 0;
    let itemsDeferred = 0;

    for (const item of dueItems) {
      let match: LocalMatch | null = null;
      try {
        match = await repository.findById(item.matchId);
      } catch {
        await queue.markProcessing([item.matchId], now);
        await queue.markFailed(
          [item.matchId],
          'serving_store_unavailable',
          new Date(now.getTime() + (options.retryDelayMs ?? 15 * 60 * 1000)).toISOString(),
          now
        );
        itemsFailed += 1;
        continue;
      }

      if (!match) {
        await queue.markFailed(
          [item.matchId],
          'match_not_found',
          { terminal: true, now }
        );
        itemsFailed += 1;
        continue;
      }

      if (match.status !== 'completed') {
        await queue.markFailed(
          [item.matchId],
          'match_not_completed',
          { terminal: true, now }
        );
        itemsFailed += 1;
        continue;
      }

      if (item.attempts >= item.maxAttempts) {
        await cacheUnavailableDetail(
          detailStore,
          queue,
          item.matchId,
          match,
          now,
          'provider_detail_refresh_failed'
        );
        itemsCompleted += 1;
        continue;
      }

      const fixtureId = resolveProviderFixtureIdFromMatch(match);
      if (fixtureId === null) {
        await cacheUnavailableDetail(detailStore, queue, item.matchId, match, now);
        itemsCompleted += 1;
        continue;
      }

      validItems.push({
        item,
        match,
        fixtureId
      });
    }

    if (validItems.length === 0) {
      const ledgerState = await ledger.getState(now);
      return {
        status: itemsCompleted > 0 && itemsFailed === 0 ? 'success' : 'failed',
        itemsProcessed: itemsFailed + itemsCompleted,
        itemsCompleted,
        itemsDeferred: 0,
        itemsFailed,
        quotaUsedToday: ledgerState.dailyUsage.reserved
      };
    }

    if (!(await ledger.canRequest(false, now))) {
      const validMatchIds = validItems.map(({ item }) => item.matchId);
      await queue.markDeferred(validMatchIds, 'quota_deferred', {
        now,
        nextAttemptAt: nextQuotaRetryAt(now)
      });
      logger(`[MatchDetailJob] Normal quota unavailable. Deferred ${validMatchIds.length} items.`);
      const ledgerState = await ledger.getState(now);
      return {
        status: itemsCompleted > 0 || itemsFailed > 0 ? 'partial' : 'skipped',
        itemsProcessed: itemsCompleted + itemsFailed,
        itemsCompleted,
        itemsDeferred: validMatchIds.length,
        itemsFailed,
        quotaUsedToday: ledgerState.dailyUsage.reserved
      };
    }

    const fixtureIds = validItems.map((v) => v.fixtureId);
    const chunks = chunkFixtureIds(fixtureIds, 20);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const chunkSet = new Set(chunk);
      const chunkItems = validItems.filter((v) => chunkSet.has(v.fixtureId));
      const chunkMatchIds = chunkItems.map((v) => v.item.matchId);

      if (!(await ledger.canRequest(false, now))) {
        const remainingChunks = chunks.slice(i);
        const remainingSet = new Set(remainingChunks.flat());
        const remainingItems = validItems.filter((v) => remainingSet.has(v.fixtureId));
        const remainingMatchIds = remainingItems.map((v) => v.item.matchId);

        await queue.markDeferred(remainingMatchIds, 'quota_deferred', {
          now,
          nextAttemptAt: nextQuotaRetryAt(now)
        });
        logger(`[MatchDetailJob] Normal quota unavailable during execution. Deferred ${remainingMatchIds.length} items.`);
        itemsDeferred += remainingMatchIds.length;
        break;
      }

      await queue.markProcessing(chunkMatchIds, now);

      let response: ApiFootballApiResponse<ApiFootballFixtureItem>;
      try {
        response = await client.fetchFixturesByIds(chunk);
      } catch (error) {
        if (error instanceof ApiFootballQuotaExceededError) {
          await queue.markDeferred(chunkMatchIds, 'quota_deferred', {
            now,
            nextAttemptAt: nextQuotaRetryAt(now)
          });
          itemsDeferred += chunkMatchIds.length;

          const remainingChunks = chunks.slice(i + 1);
          if (remainingChunks.length > 0) {
            const remainingSet = new Set(remainingChunks.flat());
            const remainingItems = validItems.filter((v) => remainingSet.has(v.fixtureId));
            const remainingMatchIds = remainingItems.map((v) => v.item.matchId);
            await queue.markDeferred(remainingMatchIds, 'quota_deferred', {
              now,
              nextAttemptAt: nextQuotaRetryAt(now)
            });
            itemsDeferred += remainingMatchIds.length;
          }
          break;
        }

        for (const chunkItem of chunkItems) {
          const outcome = await recordProviderFailure({
            item: chunkItem.item,
            match: chunkItem.match,
            detailStore,
            queue,
            now,
            ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
            errorCode: 'provider_request_failed'
          });
          if (outcome === 'completed') itemsCompleted += 1;
          else itemsFailed += 1;
        }
        logger(`[MatchDetailJob] Provider request failed for ${chunkMatchIds.length} queued items.`);
        continue;
      }

      const returnedFixtures = response.response || [];
      const returnedFixtureMap = new Map<number, ApiFootballFixtureItem>();
      for (const fixture of returnedFixtures) {
        if (fixture.fixture?.id !== undefined && fixture.fixture.id !== null) {
          returnedFixtureMap.set(fixture.fixture.id, fixture);
        }
      }

      for (const validItem of chunkItems) {
        const fixtureItem = returnedFixtureMap.get(validItem.fixtureId);
        if (!fixtureItem) {
          await cacheUnavailableDetail(
            detailStore,
            queue,
            validItem.item.matchId,
            validItem.match,
            now
          );
          itemsCompleted += 1;
          continue;
        }

        const providerStatus = fixtureItem.fixture?.status?.short?.toUpperCase();
        if (!providerStatus || !['FT', 'AET', 'PEN'].includes(providerStatus)) {
          const outcome = await recordProviderFailure({
            item: validItem.item,
            match: validItem.match,
            detailStore,
            queue,
            now,
            ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
            errorCode: 'provider_non_terminal_response'
          });
          if (outcome === 'completed') itemsCompleted += 1;
          else itemsFailed += 1;
          continue;
        }

        try {
          const adaptedDetail = adaptApiFootballMatchDetail({
            fixtureItem,
            canonicalMatch: validItem.match,
            observedAt: now.toISOString()
          });

          await detailStore.upsertDetail(adaptedDetail);
          await queue.markCompleted([validItem.item.matchId], now);
          itemsCompleted += 1;
        } catch (adaptError) {
          const outcome = await recordProviderFailure({
            item: validItem.item,
            match: validItem.match,
            detailStore,
            queue,
            now,
            ...(options.retryDelayMs === undefined ? {} : { retryDelayMs: options.retryDelayMs }),
            errorCode: 'provider_detail_invalid'
          });
          if (outcome === 'completed') itemsCompleted += 1;
          else itemsFailed += 1;
        }
      }
    }

    const itemsProcessed = itemsCompleted + itemsFailed + itemsDeferred;
    const ledgerState = await ledger.getState(now);
    const quotaUsedToday = ledgerState.dailyUsage.reserved;

    let status: 'idle' | 'success' | 'skipped' | 'partial' | 'failed';
    if (itemsCompleted > 0 && itemsFailed === 0 && itemsDeferred === 0) {
      status = 'success';
    } else if (itemsCompleted > 0 && (itemsFailed > 0 || itemsDeferred > 0)) {
      status = 'partial';
    } else if (itemsCompleted === 0 && itemsDeferred > 0 && itemsFailed === 0) {
      status = 'skipped';
    } else if (itemsCompleted === 0 && itemsFailed > 0 && itemsDeferred === 0) {
      status = 'failed';
    } else if (itemsCompleted === 0 && itemsFailed > 0 && itemsDeferred > 0) {
      status = 'partial';
    } else {
      status = 'idle';
    }

    return {
      status,
      itemsProcessed,
      itemsCompleted,
      itemsDeferred,
      itemsFailed,
      quotaUsedToday
    };
  } catch (fatalError) {
    logger('[MatchDetailJob] Fatal job failure.');
    let quotaUsedToday = 0;
    try {
      const ledgerState = await ledger.getState(now);
      quotaUsedToday = ledgerState.dailyUsage.reserved;
    } catch {
      quotaUsedToday = 0;
    }
    return {
      status: 'failed',
      itemsProcessed: 0,
      itemsCompleted: 0,
      itemsDeferred: 0,
      itemsFailed: 0,
      quotaUsedToday,
      error: 'match_detail_refresh_failed'
    };
  }
}

function nextQuotaRetryAt(now: Date): string {
  return new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1,
    0,
    1
  )).toISOString();
}

async function cacheUnavailableDetail(
  detailStore: LocalMatchDetailStore,
  queue: MatchDetailRefreshQueue,
  matchId: string,
  match: LocalMatch,
  now: Date,
  warning = 'provider_detail_unavailable'
): Promise<void> {
  if (!(await detailStore.hasDetail(matchId))) {
    await detailStore.upsertDetail({
      match: toProviderNeutralLocalMatch(match),
      status: match.status,
      elapsedMinute: null,
      events: [],
      warnings: [warning],
      notes: ['Historical match detail is unavailable from the configured source.'],
      updatedAt: now.toISOString()
    });
  }
  await queue.markCompleted([matchId], now);
}

async function recordProviderFailure(options: {
  item: MatchDetailRefreshItem;
  match: LocalMatch;
  detailStore: LocalMatchDetailStore;
  queue: MatchDetailRefreshQueue;
  now: Date;
  retryDelayMs?: number;
  errorCode: string;
}): Promise<'completed' | 'failed'> {
  if (options.item.attempts + 1 >= options.item.maxAttempts) {
    await cacheUnavailableDetail(
      options.detailStore,
      options.queue,
      options.item.matchId,
      options.match,
      options.now,
      'provider_detail_refresh_failed'
    );
    return 'completed';
  }

  const retryDelayMs = options.retryDelayMs ?? 15 * 60 * 1000;
  const nextAttemptAt = new Date(options.now.getTime() + retryDelayMs).toISOString();
  await options.queue.markFailed(
    [options.item.matchId],
    options.errorCode,
    nextAttemptAt,
    options.now
  );
  return 'failed';
}
