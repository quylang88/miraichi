import type { IncomingMessage, ServerResponse } from 'http';
import { ServingMatchStoreRepository } from '../repositories/serving-match-store-repository.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { toProviderNeutralLocalMatch, type LocalMatchDetail } from '@miraichi/shared';

const repository = new ServingMatchStoreRepository();

export async function handleMatchDetail(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { repository?: MatchSnapshotRepository } = {}
): Promise<void> {
  const repo = dependencies.repository ?? repository;
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
  } catch (error) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = err.statusCode || 500;
    const code = err.code || 'match_detail_route_error';
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code,
        message: err.message || 'Failed to load match detail.'
      }
    }));
  }
}
export type MatchDetailResponse = LocalMatchDetail;
