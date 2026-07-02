import type { IncomingMessage, ServerResponse } from 'http';
import { LocalMatchSnapshotRepository } from '../repositories/local-match-snapshot-repository.js';
import type { LocalMatchDetail } from '@miraichi/shared';

const repository = new LocalMatchSnapshotRepository();

export async function handleMatchDetail(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { repository?: LocalMatchSnapshotRepository } = {}
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
          message: `Match with ID ${id} was not found in the local snapshot.`
        }
      }));
      return;
    }

    const payload: LocalMatchDetail = {
      match,
      referee: undefined,
      events: [],
      notes: [
        'Local snapshot detail does not include live event telemetry.'
      ]
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
