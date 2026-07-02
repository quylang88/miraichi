import type { IncomingMessage, ServerResponse } from 'http';
import { LocalMatchSnapshotRepository } from '../repositories/local-match-snapshot-repository.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';

const repository = new LocalMatchSnapshotRepository();

export async function handleDataSnapshotStatus(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { repository?: MatchSnapshotRepository } = {}
): Promise<void> {
  const repo = dependencies.repository ?? repository;

  try {
    const status = await repo.getStatus();

    if (status.freshness === 'missing') {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: {
          code: 'local_snapshot_missing',
          message: 'Local match snapshot is missing. Run the national-team data update before using match workflows.'
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
    const code = err.code || 'local_snapshot_invalid';
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code,
        message: err.message || 'Failed to retrieve snapshot status.'
      }
    }));
  }
}
