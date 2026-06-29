const API_BASE_URL = 'http://localhost:3001';

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
    const payload = await response.json() as MatchFeedApiResponse;

    if (!response.ok) {
      return {
        status: 'unavailable',
        date,
        reason: payload.error?.message || `Match feed unavailable with HTTP ${response.status}.`,
        warnings: [payload.error?.code || 'match_feed_unavailable']
      };
    }

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
