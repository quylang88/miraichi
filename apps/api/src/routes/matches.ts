import type { IncomingMessage, ServerResponse } from 'http';
import { ServingMatchStoreRepository } from '../repositories/serving-match-store-repository.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import type { LocalMatchFeedResponse, LocalMatchStatus } from '@miraichi/shared';

const repository = new ServingMatchStoreRepository();

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

const VALID_STATUSES: string[] = ['scheduled', 'completed', 'postponed', 'cancelled', 'unknown'];

export async function handleMatches(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { repository?: MatchSnapshotRepository } = {}
): Promise<void> {
  const repo = dependencies.repository ?? repository;
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const date = parsedUrl.searchParams.get('date');
  const competitionId = parsedUrl.searchParams.get('competitionId') || undefined;
  const status = parsedUrl.searchParams.get('status') || undefined;

  if (date !== null && !validDate(date)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'invalid_date',
        message: 'date must use YYYY-MM-DD format.'
      }
    }));
    return;
  }

  if (status !== undefined) {
    if (status === 'in_play') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'unsupported_match_status',
          message: 'This app does not support live match status in Phase 9.'
        }
      }));
      return;
    }
    if (!VALID_STATUSES.includes(status)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'unsupported_match_status',
          message: `status must be one of: ${VALID_STATUSES.join(', ')}`
        }
      }));
      return;
    }
  }

  try {
    const payload = await repo.listMatches({
      date: date || undefined,
      competitionId,
      status: status as LocalMatchStatus
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (error) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = err.statusCode || 500;
    const code = err.code || 'serving_match_store_invalid';
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code,
        message: err.message || 'Failed to load matches.'
      }
    }));
  }
}
export type MatchFeedResponse = LocalMatchFeedResponse;
