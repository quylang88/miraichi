import type { IncomingMessage, ServerResponse } from 'node:http';
import { toProviderNeutralLiveMatchSnapshot, type LiveRefreshReason, type LiveRefreshState } from '@miraichi/shared';
import type { LiveRefreshCoordinator, LiveRefreshResult } from '../live/live-refresh-coordinator.js';

function publicRefreshState(result: LiveRefreshResult) {
  const state: LiveRefreshState | null = result.state;
  return {
    outcome: result.outcome,
    status: state?.status ?? 'never',
    reason: state?.reason ?? null,
    lastAttemptAt: state?.lastAttemptAt ?? null,
    lastSuccessAt: state?.lastSuccessAt ?? null,
    lastCompletedAt: state?.lastCompletedAt ?? null,
    lastErrorCode: state?.lastErrorCode ?? null,
    refreshing: state?.status === 'running'
  };
}

function writeResult(res: ServerResponse, result: LiveRefreshResult): void {
  const status = result.outcome === 'failed' && result.snapshot === null ? 503 : 200;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({
    snapshot: result.snapshot ? toProviderNeutralLiveMatchSnapshot(result.snapshot) : null,
    refresh: publicRefreshState(result)
  }));
}

function writeError(res: ServerResponse, status: number, code: string, message: string): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify({ error: { code, message } }));
}

export async function handleLiveMatches(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { readonly coordinator: LiveRefreshCoordinator }
): Promise<void> {
  const url = new URL(req.url || '/', 'http://localhost');
  try {
    if (url.pathname === '/api/v1/live' && req.method === 'GET') {
      writeResult(res, await dependencies.coordinator.read());
      return;
    }
    if (url.pathname === '/api/v1/live/refresh' && req.method === 'POST') {
      const reason = url.searchParams.get('reason');
      if (reason !== 'visible' && reason !== 'manual' && reason !== 'hourly' && reason !== 'background') {
        writeError(res, 400, 'invalid_refresh_reason', 'reason must be visible, manual, or hourly.');
        return;
      }
      writeResult(res, await dependencies.coordinator.refresh(reason as LiveRefreshReason));
      return;
    }
    res.setHeader('Allow', url.pathname === '/api/v1/live' ? 'GET' : 'POST');
    writeError(res, 405, 'method_not_allowed', 'Method not allowed.');
  } catch {
    writeError(res, 503, 'live_data_unavailable', 'Live match data is unavailable.');
  }
}
