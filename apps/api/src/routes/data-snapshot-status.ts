import type { IncomingMessage, ServerResponse } from 'http';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { toPublicSnapshotStatus } from './public-match-metadata.js';

export async function handleDataSnapshotStatus(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { repository?: MatchSnapshotRepository } = {}
): Promise<void> {
  const repo = dependencies.repository;

  try {
    if (!repo) throw new Error('Match repository is not configured');
    const status = toPublicSnapshotStatus(await repo.getStatus());

    if (status.freshness === 'missing') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'serving_match_store_missing',
          message: 'Serving match store is missing. Build the serving match store from canonical warehouse before using match workflows.'
        },
        snapshot: status
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(status));
  } catch (error) {
    const err = error as { statusCode?: number; code?: string; message?: string };
    const statusCode = err.statusCode || 500;
    const code = err.code || 'serving_match_store_invalid';
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code,
        message: err.message || 'Failed to retrieve snapshot status.'
      }
    }));
  }
}
