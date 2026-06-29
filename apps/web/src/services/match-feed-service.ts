declare global {
  interface Window {
    MIRAICHI_ENV?: {
      API_URL?: string;
    };
  }
}

const API_BASE_URL = (typeof window !== 'undefined' && window.MIRAICHI_ENV?.API_URL) || '';

export type AppMatch = {
  id: string;
  sourceProviderId: 'api-football';
  providerFixtureId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  round: string | null;
  status: 'scheduled' | 'in_play' | 'completed' | 'postponed' | 'cancelled' | 'unknown';
  statusLabel: string;
  kickoffTime: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  score: { home: number; away: number } | null;
  venueName: string | null;
  elapsedMinute: number | null;
};

export type MatchFeedViewState =
  | { status: 'loading'; date: string }
  | { status: 'ready'; date: string; matches: AppMatch[]; warnings: string[] }
  | { status: 'empty'; date: string; warnings: string[] }
  | { status: 'unavailable'; date: string; reason: string; warnings: string[] };

type MatchFeedApiResponse = {
  matches?: unknown;
  warnings?: unknown;
  error?: { code?: string; message?: string };
};

function readWarnings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export async function getMatchFeed(date: string): Promise<MatchFeedViewState> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/matches?date=${encodeURIComponent(date)}`);

    if (!response.ok) {
      let message = `Match feed unavailable with HTTP ${response.status}.`;
      let code = 'match_feed_unavailable';
      try {
        const payload = await response.json() as MatchFeedApiResponse;
        if (payload.error?.message) message = payload.error.message;
        if (payload.error?.code) code = payload.error.code;
      } catch {
        // Response is not JSON, use default HTTP status message
      }
      return {
        status: 'unavailable',
        date,
        reason: message,
        warnings: [code]
      };
    }

    const payload = await response.json() as MatchFeedApiResponse;
    const warnings = readWarnings(payload.warnings);
    const matches = Array.isArray(payload.matches) ? payload.matches as AppMatch[] : [];

    if (matches.length === 0) {
      return { status: 'empty', date, warnings };
    }

    return { status: 'ready', date, matches, warnings };
  } catch (error) {
    return {
      status: 'unavailable',
      date,
      reason: error instanceof Error ? error.message : 'Match feed request failed.',
      warnings: ['match_feed_request_failed']
    };
  }
}
