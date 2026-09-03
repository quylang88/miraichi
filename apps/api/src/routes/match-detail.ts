import type { IncomingMessage, ServerResponse } from 'http';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import {
  toProviderNeutralLocalMatch,
  type LocalMatch,
  type LocalMatchDetail
} from '@miraichi/shared';

export interface MatchDetailStore {
  getDetail(matchId: string): Promise<LocalMatchDetail | null>;
}

export interface MatchDetailQueue {
  enqueue(matchId: string): Promise<{ status: string }>;
}

export interface MatchDetailRouteDependencies {
  repository?: MatchSnapshotRepository;
  detailStore?: MatchDetailStore;
  queue?: MatchDetailQueue;
  /** Retained temporarily for source-compatible tests; runtime path resolution is Node-only. */
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
  const repo = dependencies.repository;
  const detailStore = dependencies.detailStore;
  const queue = dependencies.queue;

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

  try {
    if (!repo) throw new Error('Match repository is not configured');
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

    const cachedDetail = detailStore ? await detailStore.getDetail(id) : null;
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
        ...(cachedDetail.lineups !== undefined ? { lineups: cachedDetail.lineups } : {}),
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

    if (!queue) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'detail_unavailable',
          message: 'Match detail is currently unavailable.'
        }
      }));
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
