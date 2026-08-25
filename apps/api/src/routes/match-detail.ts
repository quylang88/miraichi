import type { IncomingMessage, ServerResponse } from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { ServingMatchStoreRepository } from '../repositories/serving-match-store-repository.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { LocalMatchDetailStore } from '../repositories/local-match-detail-store.js';
import { MatchDetailRefreshQueue } from '../repositories/match-detail-refresh-queue.js';
import {
  toProviderNeutralLocalMatch,
  type LocalMatch,
  type LocalMatchDetail
} from '@miraichi/shared';

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

export interface MatchDetailRouteDependencies {
  repository?: MatchSnapshotRepository;
  detailStore?: LocalMatchDetailStore;
  queue?: MatchDetailRefreshQueue;
  dataRoot?: string;
}

export interface MatchDetailPendingResponse {
  status: 'pending';
  code: 'detail_pending';
  message: string;
  match: LocalMatch;
  retryAfterSeconds: number;
}

export type MatchDetailResponse = LocalMatchDetail | MatchDetailPendingResponse;

export const MATCH_DETAIL_RETRY_AFTER_SECONDS = 150;

export async function handleMatchDetail(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: MatchDetailRouteDependencies = {}
): Promise<void> {
  const rootDir = findRootDir(process.cwd());
  const configuredDataRoot = dependencies.dataRoot || process.env.PROVIDER_CAPTURE_ROOT || 'apps/api/data';
  const dataRoot = path.isAbsolute(configuredDataRoot)
    ? configuredDataRoot
    : path.resolve(rootDir, configuredDataRoot);

  const repo = dependencies.repository ?? new ServingMatchStoreRepository({
    servingRoot: path.resolve(dataRoot, 'serving')
  });
  const detailStore = dependencies.detailStore ?? new LocalMatchDetailStore({ dataRoot });
  const queue = dependencies.queue ?? new MatchDetailRefreshQueue({ dataRoot });

  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const id = parsedUrl.searchParams.get('id');

  if (!id || id.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'match_id_required',
        message: 'id parameter is required.'
      }
    }));
    return;
  }

  if (id.startsWith('api-football-fixture-')) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'legacy_provider_id_not_supported',
        message: 'API-Football fixture IDs are no longer supported in Phase 9.'
      }
    }));
    return;
  }

  try {
    const match = await repo.findById(id);
    if (!match) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'match_not_found',
          message: `Match with ID ${id} was not found in the serving match store.`
        }
      }));
      return;
    }

    const cachedDetail = await detailStore.getDetail(id);
    if (cachedDetail) {
      const sanitizedDetail: LocalMatchDetail = {
        match: toProviderNeutralLocalMatch(cachedDetail.match),
        status: cachedDetail.status,
        elapsedMinute: cachedDetail.elapsedMinute,
        events: cachedDetail.events,
        updatedAt: cachedDetail.updatedAt,
        ...(cachedDetail.referee !== undefined ? { referee: cachedDetail.referee } : {}),
        ...(cachedDetail.scoreBreakdown !== undefined ? { scoreBreakdown: cachedDetail.scoreBreakdown } : {}),
        ...(cachedDetail.teamStats !== undefined ? { teamStats: cachedDetail.teamStats } : {}),
        ...(cachedDetail.warnings !== undefined ? { warnings: cachedDetail.warnings } : {}),
        ...(cachedDetail.notes !== undefined ? { notes: cachedDetail.notes } : {})
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sanitizedDetail));
      return;
    }

    if (match.status !== 'completed') {
      const payload: LocalMatchDetail = {
        match: toProviderNeutralLocalMatch(match),
        status: match.status,
        elapsedMinute: null,
        events: [],
        notes: [
          'Serving match store detail does not include live event telemetry.'
        ],
        updatedAt: match.updatedAt
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }

    const queueItem = await queue.enqueue(id);
    if (queueItem.status === 'failed') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'detail_unavailable',
          message: 'Match detail is currently unavailable.'
        }
      }));
      return;
    }

    res.writeHead(202, {
      'Content-Type': 'application/json',
      'Retry-After': String(MATCH_DETAIL_RETRY_AFTER_SECONDS)
    });
    res.end(JSON.stringify({
      status: 'pending',
      code: 'detail_pending',
      message: 'Match detail is being fetched in the background.',
      match: toProviderNeutralLocalMatch(match),
      retryAfterSeconds: MATCH_DETAIL_RETRY_AFTER_SECONDS
    }));
  } catch (error) {
    const err = error as { statusCode?: number };
    const statusCode = Number.isInteger(err.statusCode) && err.statusCode! >= 400 && err.statusCode! <= 599
      ? err.statusCode!
      : 500;
    const code = statusCode === 503 ? 'match_detail_unavailable' : 'match_detail_route_error';
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code,
        message: statusCode === 503
          ? 'Match detail service is temporarily unavailable.'
          : 'Failed to load match detail.'
      }
    }));
  }
}
