import {
  LocalMatch,
  LocalDataSnapshotStatus,
  validateLocalMatchFeedResponse
} from '@miraichi/shared';

declare global {
  interface Window {
    MIRAICHI_ENV?: {
      API_URL?: string;
    };
  }
}

const API_BASE_URL = (typeof window !== 'undefined' && window.MIRAICHI_ENV?.API_URL) || '';

export type MatchFeedViewState =
  | { status: 'loading'; date: string }
  | { status: 'ready'; date: string; matches: LocalMatch[]; snapshot: LocalDataSnapshotStatus; warnings: string[] }
  | { status: 'empty'; date: string; snapshot: LocalDataSnapshotStatus; warnings: string[] }
  | { status: 'unavailable'; date: string; reason: string; warnings: string[]; snapshot?: LocalDataSnapshotStatus | undefined };

export async function getMatchFeed(date: string): Promise<MatchFeedViewState> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/matches?date=${encodeURIComponent(date)}`);

    if (!response.ok) {
      let message = `Match feed unavailable with HTTP ${response.status}.`;
      let code = 'match_feed_unavailable';
      let snapshot: LocalDataSnapshotStatus | undefined = undefined;
      try {
        const payload = await response.json() as { error?: { message?: string; code?: string }; snapshot?: LocalDataSnapshotStatus };
        if (payload.error?.message) message = payload.error.message;
        if (payload.error?.code) code = payload.error.code;
        if (payload.snapshot) snapshot = payload.snapshot;
      } catch {
        // Response is not JSON
      }

      if (code === 'serving_match_store_missing') {
        message = 'Serving match store is missing. Build it from canonical warehouse before using match workflows.';
      } else if (code === 'serving_match_store_invalid') {
        message = 'Serving match store is invalid. Rebuild it from canonical warehouse after fixing canonical data.';
      }

      return {
        status: 'unavailable',
        date,
        reason: message,
        warnings: [code],
        snapshot
      };
    }

    const payload = await response.json() as Record<string, unknown>;
    const validationResult = validateLocalMatchFeedResponse(payload);
    if (!validationResult.ok) {
      throw new Error(`Normalization error: ${validationResult.errors.join(', ')}`);
    }

    const warnings: string[] = Array.isArray(payload.warnings) ? payload.warnings : [];
    const matches = payload.matches as LocalMatch[];
    const snapshot = payload.snapshot as LocalDataSnapshotStatus;

    if (matches.length === 0) {
      return { status: 'empty', date, snapshot, warnings };
    }

    return { status: 'ready', date, matches, snapshot, warnings };
  } catch (error) {
    return {
      status: 'unavailable',
      date,
      reason: error instanceof Error ? error.message : 'Match feed request failed.',
      warnings: ['match_feed_request_failed']
    };
  }
}
export type AppMatch = LocalMatch;
