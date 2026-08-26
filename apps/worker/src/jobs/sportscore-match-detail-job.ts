import fs from 'node:fs';
import path from 'node:path';
import { toProviderNeutralLocalMatch, type LocalMatch } from '@miraichi/shared';
import { LocalMatchDetailStore } from '../../../api/src/repositories/local-match-detail-store.js';
import {
  MatchDetailRefreshQueue,
  type MatchDetailRefreshItem
} from '../../../api/src/repositories/match-detail-refresh-queue.js';
import type { MatchSnapshotRepository } from '../../../api/src/repositories/match-snapshot-repository.js';
import { ServingMatchStoreRepository } from '../../../api/src/repositories/serving-match-store-repository.js';
import {
  SportScoreClient,
  SportScoreClientError,
  type SportScoreMatchRequest
} from '../sources/sportscore/sportscore-client.js';
import type { SportScoreMatchResponse } from '../sources/sportscore/sportscore-response-contract.js';
import {
  adaptSportScoreMatchDetail,
  SportScoreMatchDetailAdapterError
} from '../sources/sportscore/sportscore-match-detail-adapter.js';

export interface SportScoreMatchDetailClient {
  getMatch(request: SportScoreMatchRequest): Promise<SportScoreMatchResponse>;
}

export interface SportScoreMatchDetailJobOptions {
  dataRoot?: string;
  servingRoot?: string;
  client?: SportScoreMatchDetailClient;
  queue?: MatchDetailRefreshQueue;
  detailStore?: LocalMatchDetailStore;
  repository?: MatchSnapshotRepository;
  batchSize?: number;
  maxRequestsPerRun?: number;
  retryDelayMs?: number;
  now?: () => Date;
  logger?: (message: string) => void;
}

export interface SportScoreMatchDetailJobResult {
  status: 'idle' | 'success' | 'partial' | 'failed';
  itemsProcessed: number;
  itemsCompleted: number;
  itemsDeferred: number;
  itemsFailed: number;
  requestsMade: number;
  error?: 'match_detail_refresh_failed';
}

const MATCH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_BATCH_SIZE = 4;
const DEFAULT_REQUESTS_PER_RUN = 4;
const DEFAULT_RETRY_DELAY_MS = 15 * 60 * 1000;

function findRootDir(startDir: string): string {
  let directory = startDir;
  while (directory !== path.dirname(directory)) {
    if (fs.existsSync(path.join(directory, 'pnpm-workspace.yaml'))) return directory;
    directory = path.dirname(directory);
  }
  return startDir;
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${name} must be a positive integer.`);
  return value;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${name} must be a non-negative integer.`);
  return value;
}

function resolveSportScoreSlug(match: LocalMatch): string | null {
  const sourceRef = match.sourceRefs.find((ref) => ref.sourceId === 'sportscore');
  const slug = sourceRef?.sourceMatchId;
  return typeof slug === 'string' && MATCH_SLUG_PATTERN.test(slug) ? slug : null;
}

export async function runSportScoreMatchDetailJob(
  options: SportScoreMatchDetailJobOptions = {}
): Promise<SportScoreMatchDetailJobResult> {
  const nowFn = options.now ?? (() => new Date());
  const now = nowFn();
  const rootDir = findRootDir(process.cwd());
  const configuredDataRoot = options.dataRoot ?? process.env.PROVIDER_CAPTURE_ROOT ?? 'apps/api/data';
  const dataRoot = path.isAbsolute(configuredDataRoot)
    ? configuredDataRoot
    : path.resolve(rootDir, configuredDataRoot);
  const configuredServingRoot = options.servingRoot
    ?? process.env.LOCAL_MATCH_SERVING_ROOT
    ?? path.join(dataRoot, 'serving');
  const servingRoot = path.isAbsolute(configuredServingRoot)
    ? configuredServingRoot
    : path.resolve(rootDir, configuredServingRoot);
  const queue = options.queue ?? new MatchDetailRefreshQueue({ dataRoot, now: nowFn });
  const detailStore = options.detailStore ?? new LocalMatchDetailStore({ dataRoot });
  const repository = options.repository ?? new ServingMatchStoreRepository({ servingRoot, now: nowFn });
  const client = options.client ?? new SportScoreClient({ now: () => nowFn().getTime() });
  const logger = options.logger ?? (() => undefined);

  let requestsMade = 0;
  let itemsCompleted = 0;
  let itemsDeferred = 0;
  let itemsFailed = 0;

  try {
    const batchSize = positiveInteger(options.batchSize ?? DEFAULT_BATCH_SIZE, 'batchSize');
    const maxRequestsPerRun = nonNegativeInteger(
      options.maxRequestsPerRun ?? DEFAULT_REQUESTS_PER_RUN,
      'maxRequestsPerRun'
    );
    const retryDelayMs = positiveInteger(
      options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS,
      'retryDelayMs'
    );
    const dueItems = await queue.getDueItems(batchSize, now);
    if (dueItems.length === 0) {
      return result('idle', 0, 0, 0, 0, 0);
    }

    for (const item of dueItems) {
      let match: LocalMatch | null;
      try {
        match = await repository.findById(item.matchId);
      } catch {
        await queue.markProcessing([item.matchId], now);
        await recordRetryableFailure(queue, item, 'serving_store_unavailable', now, retryDelayMs);
        itemsFailed += 1;
        continue;
      }
      if (!match) {
        await queue.markFailed([item.matchId], 'match_not_found', { terminal: true, now });
        itemsFailed += 1;
        continue;
      }
      if (match.status !== 'completed') {
        await queue.markFailed([item.matchId], 'match_not_completed', { terminal: true, now });
        itemsFailed += 1;
        continue;
      }
      if (await detailStore.hasDetail(item.matchId)) {
        await queue.markCompleted([item.matchId], now);
        itemsCompleted += 1;
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
      const slug = resolveSportScoreSlug(match);
      if (slug === null) {
        await cacheUnavailableDetail(detailStore, queue, item.matchId, match, now);
        itemsCompleted += 1;
        continue;
      }
      if (requestsMade >= maxRequestsPerRun) {
        await queue.markDeferred([item.matchId], 'request_budget_deferred', {
          now,
          nextAttemptAt: new Date(now.getTime() + retryDelayMs).toISOString()
        });
        itemsDeferred += 1;
        continue;
      }

      await queue.markProcessing([item.matchId], now);
      requestsMade += 1;
      try {
        const response = await client.getMatch({ slug, maxRetries: 0 });
        const detail = adaptSportScoreMatchDetail({
          response,
          canonicalMatch: match,
          expectedSlug: slug,
          observedAt: now.toISOString()
        });
        await detailStore.upsertDetail(detail);
        await queue.markCompleted([item.matchId], now);
        itemsCompleted += 1;
      } catch (error) {
        if (isUnavailableCoverage(error)) {
          await cacheUnavailableDetail(detailStore, queue, item.matchId, match, now);
          itemsCompleted += 1;
          continue;
        }
        const failureCode = error instanceof SportScoreMatchDetailAdapterError
          && error.code === 'non_terminal'
          ? 'provider_non_terminal_response'
          : 'provider_detail_refresh_failed';
        const outcome = await recordRetryableFailure(
          queue,
          item,
          failureCode,
          now,
          retryDelayMs,
          detailStore,
          match
        );
        if (outcome === 'completed') itemsCompleted += 1;
        else itemsFailed += 1;
        logger('[SportScoreMatchDetailJob] One terminal detail refresh failed.');
      }
    }

    const itemsProcessed = itemsCompleted + itemsDeferred + itemsFailed;
    return result(
      deriveStatus(itemsCompleted, itemsDeferred, itemsFailed),
      itemsProcessed,
      itemsCompleted,
      itemsDeferred,
      itemsFailed,
      requestsMade
    );
  } catch {
    logger('[SportScoreMatchDetailJob] Fatal detail job failure.');
    return {
      ...result('failed', itemsCompleted + itemsDeferred + itemsFailed, itemsCompleted, itemsDeferred, itemsFailed, requestsMade),
      error: 'match_detail_refresh_failed'
    };
  }
}

function isUnavailableCoverage(error: unknown): boolean {
  return error instanceof SportScoreMatchDetailAdapterError && error.code === 'unavailable'
    || error instanceof SportScoreClientError && error.statusCode === 404;
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
      status: 'completed',
      elapsedMinute: null,
      events: [],
      warnings: [warning],
      notes: ['Terminal match detail is unavailable from the configured source.'],
      updatedAt: now.toISOString()
    });
  }
  await queue.markCompleted([matchId], now);
}

async function recordRetryableFailure(
  queue: MatchDetailRefreshQueue,
  item: MatchDetailRefreshItem,
  errorCode: string,
  now: Date,
  retryDelayMs: number,
  detailStore?: LocalMatchDetailStore,
  match?: LocalMatch
): Promise<'completed' | 'failed'> {
  if (item.attempts + 1 >= item.maxAttempts && detailStore && match) {
    await cacheUnavailableDetail(
      detailStore,
      queue,
      item.matchId,
      match,
      now,
      'provider_detail_refresh_failed'
    );
    return 'completed';
  }
  await queue.markFailed(
    [item.matchId],
    errorCode,
    new Date(now.getTime() + retryDelayMs).toISOString(),
    now
  );
  return 'failed';
}

function deriveStatus(
  completed: number,
  deferred: number,
  failed: number
): SportScoreMatchDetailJobResult['status'] {
  if (completed > 0 && deferred === 0 && failed === 0) return 'success';
  if (completed === 0 && deferred === 0 && failed > 0) return 'failed';
  if (completed === 0 && deferred === 0 && failed === 0) return 'idle';
  return 'partial';
}

function result(
  status: SportScoreMatchDetailJobResult['status'],
  itemsProcessed: number,
  itemsCompleted: number,
  itemsDeferred: number,
  itemsFailed: number,
  requestsMade: number
): SportScoreMatchDetailJobResult {
  return {
    status,
    itemsProcessed,
    itemsCompleted,
    itemsDeferred,
    itemsFailed,
    requestsMade
  };
}
