export type AppMatchStatus = 'scheduled' | 'in_play' | 'completed' | 'postponed' | 'cancelled' | 'unknown';

export type AppMatch = {
  id: string;
  sourceProviderId: 'api-football';
  providerFixtureId: string;
  competitionId: string;
  competitionName: string;
  seasonId: string;
  round: string | null;
  status: AppMatchStatus;
  statusLabel: string;
  kickoffTime: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  score: { home: number; away: number } | null;
  venueName: string | null;
  elapsedMinute: number | null;
};

export type ApiFootballConfig = {
  apiKey: string;
  baseUrl: string;
  dailyLimit: number;
};

export type ApiFootballFixture = {
  fixture: {
    id: number;
    date: string;
    timestamp?: number;
    venue?: { id?: number | null; name?: string | null; city?: string | null };
    status: { long?: string | null; short?: string | null; elapsed?: number | null };
  };
  league: {
    id: number;
    name: string;
    country?: string | null;
    season: number;
    round?: string | null;
  };
  teams: {
    home: { id: number; name: string };
    away: { id: number; name: string };
  };
  goals?: { home?: number | null; away?: number | null };
  score?: unknown;
};

type ApiFootballEnvelope = {
  response?: unknown;
  errors?: unknown;
};

type Fetcher = typeof fetch;

export class ApiFootballProviderError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(code: string, message: string, statusCode: number) {
    super(message);
    this.name = 'ApiFootballProviderError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

function readPositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function readApiFootballConfig(env: NodeJS.ProcessEnv): ApiFootballConfig {
  const apiKey = env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    throw new ApiFootballProviderError(
      'api_football_key_missing',
      'API_FOOTBALL_KEY is required for API-Football match feed.',
      503
    );
  }

  return {
    apiKey,
    baseUrl: env.API_FOOTBALL_BASE_URL?.trim() || 'https://v3.football.api-sports.io',
    dailyLimit: readPositiveInteger(env.API_FOOTBALL_DAILY_LIMIT, 100)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', `Invalid API-Football ${label}.`, 502);
  }
  return value;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ApiFootballProviderError('api_football_invalid_payload', `Missing API-Football ${label}.`, 502);
  }
  return value;
}

function readNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', `Missing API-Football ${label}.`, 502);
  }
  return value;
}

function parseFixture(value: unknown): ApiFootballFixture {
  const root = readRecord(value, 'fixture root');
  const fixture = readRecord(root.fixture, 'fixture object');
  const league = readRecord(root.league, 'league object');
  const teams = readRecord(root.teams, 'teams object');
  const home = readRecord(teams.home, 'home team');
  const away = readRecord(teams.away, 'away team');
  const status = readRecord(fixture.status, 'fixture status');

  return {
    fixture: {
      id: readNumber(fixture.id, 'fixture id'),
      date: readString(fixture.date, 'fixture date'),
      timestamp: typeof fixture.timestamp === 'number' ? fixture.timestamp : undefined,
      venue: isRecord(fixture.venue) ? {
        id: typeof fixture.venue.id === 'number' ? fixture.venue.id : null,
        name: typeof fixture.venue.name === 'string' ? fixture.venue.name : null,
        city: typeof fixture.venue.city === 'string' ? fixture.venue.city : null
      } : undefined,
      status: {
        long: typeof status.long === 'string' ? status.long : null,
        short: typeof status.short === 'string' ? status.short : null,
        elapsed: typeof status.elapsed === 'number' ? status.elapsed : null
      }
    },
    league: {
      id: readNumber(league.id, 'league id'),
      name: readString(league.name, 'league name'),
      country: typeof league.country === 'string' ? league.country : null,
      season: readNumber(league.season, 'league season'),
      round: typeof league.round === 'string' ? league.round : null
    },
    teams: {
      home: {
        id: readNumber(home.id, 'home team id'),
        name: readString(home.name, 'home team name')
      },
      away: {
        id: readNumber(away.id, 'away team id'),
        name: readString(away.name, 'away team name')
      }
    },
    goals: isRecord(root.goals) ? {
      home: typeof root.goals.home === 'number' ? root.goals.home : null,
      away: typeof root.goals.away === 'number' ? root.goals.away : null
    } : undefined,
    score: root.score
  };
}

function mapStatus(shortStatus: string | null | undefined): AppMatchStatus {
  if (!shortStatus) return 'unknown';
  if (['NS', 'TBD'].includes(shortStatus)) return 'scheduled';
  if (['1H', 'HT', '2H', 'ET', 'BT', 'P', 'LIVE'].includes(shortStatus)) return 'in_play';
  if (['FT', 'AET', 'PEN'].includes(shortStatus)) return 'completed';
  if (['PST', 'SUSP', 'INT'].includes(shortStatus)) return 'postponed';
  if (['CANC', 'ABD', 'AWD', 'WO'].includes(shortStatus)) return 'cancelled';
  return 'unknown';
}

export function normalizeApiFootballFixture(fixture: ApiFootballFixture): AppMatch {
  const goals = fixture.goals;
  const hasScore = typeof goals?.home === 'number' && typeof goals.away === 'number';

  return {
    id: `api-football-fixture-${fixture.fixture.id}`,
    sourceProviderId: 'api-football',
    providerFixtureId: String(fixture.fixture.id),
    competitionId: `api-football-league-${fixture.league.id}`,
    competitionName: fixture.league.name,
    seasonId: `api-football-season-${fixture.league.season}`,
    round: fixture.league.round || null,
    status: mapStatus(fixture.fixture.status.short),
    statusLabel: fixture.fixture.status.long || fixture.fixture.status.short || 'Unknown',
    kickoffTime: new Date(fixture.fixture.date).toISOString(),
    homeTeam: {
      id: `api-football-team-${fixture.teams.home.id}`,
      name: fixture.teams.home.name
    },
    awayTeam: {
      id: `api-football-team-${fixture.teams.away.id}`,
      name: fixture.teams.away.name
    },
    score: hasScore ? { home: goals.home as number, away: goals.away as number } : null,
    venueName: fixture.fixture.venue?.name || null,
    elapsedMinute: fixture.fixture.status.elapsed ?? null
  };
}

function parseEnvelope(value: unknown): ApiFootballFixture[] {
  const envelope = readRecord(value, 'response envelope') as ApiFootballEnvelope;
  if (!Array.size && !Array.isArray(envelope.response)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', 'API-Football response must be an array.', 502);
  }
  return envelope.response.map(parseFixture);
}

export function createApiFootballClient({
  config,
  fetcher = fetch
}: {
  config: ApiFootballConfig;
  fetcher?: Fetcher;
}) {
  return {
    async fetchFixturesByDate(date: string): Promise<{ matches: AppMatch[]; warnings: string[] }> {
      const url = new URL('/fixtures', config.baseUrl);
      url.searchParams.set('date', date);
      url.searchParams.set('timezone', 'UTC');

      const response = await fetcher(url.toString(), {
        headers: { 'x-apisports-key': config.apiKey }
      });

      if (!response.ok) {
        throw new ApiFootballProviderError(
          'api_football_provider_error',
          `API-Football returned HTTP ${response.status}.`,
          502
        );
      }

      const payload = await response.json() as unknown;
      const fixtures = parseEnvelope(payload);

      return {
        matches: fixtures.map(normalizeApiFootballFixture),
        warnings: []
      };
    }
  };
}
