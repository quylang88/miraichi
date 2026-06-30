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

  const result: ApiFootballFixture = {
    fixture: {
      id: readNumber(fixture.id, 'fixture id'),
      date: readString(fixture.date, 'fixture date'),
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
    }
  };

  if (typeof fixture.timestamp === 'number') {
    result.fixture.timestamp = fixture.timestamp;
  }
  if (isRecord(fixture.venue)) {
    result.fixture.venue = {
      id: typeof fixture.venue.id === 'number' ? fixture.venue.id : null,
      name: typeof fixture.venue.name === 'string' ? fixture.venue.name : null,
      city: typeof fixture.venue.city === 'string' ? fixture.venue.city : null
    };
  }
  if (isRecord(root.goals)) {
    result.goals = {
      home: typeof root.goals.home === 'number' ? root.goals.home : null,
      away: typeof root.goals.away === 'number' ? root.goals.away : null
    };
  }

  return result;
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
  if (
    envelope.errors &&
    typeof envelope.errors === 'object' &&
    !Array.isArray(envelope.errors) &&
    Object.keys(envelope.errors).length > 0
  ) {
    const messages = Object.entries(envelope.errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    throw new ApiFootballProviderError(
      'api_football_api_error',
      `API-Football returned errors: ${messages}`,
      502
    );
  }
  if (!Array.isArray(envelope.response)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', 'API-Football response must be an array.', 502);
  }
  return (envelope.response as unknown[]).map(parseFixture);
}

export type ApiFootballEvent = {
  time: { elapsed: number; extra?: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string };
  assist?: { id: number | null; name: string | null } | null;
  type: string;
  detail: string;
  comments?: string | null;
};

export type ApiFootballFixtureDetail = ApiFootballFixture & {
  referee?: string | null;
  score?: {
    halftime?: { home?: number | null; away?: number | null } | null;
    fulltime?: { home?: number | null; away?: number | null } | null;
    extratime?: { home?: number | null; away?: number | null } | null;
    penalty?: { home?: number | null; away?: number | null } | null;
  } | null;
  events?: ApiFootballEvent[];
};

export type AppMatchEvent = {
  time: { elapsed: number; extra: number | null };
  team: { id: string; name: string };
  player: { id: string | null; name: string };
  assist: { id: string | null; name: string | null } | null;
  type: string;
  detail: string;
  comments: string | null;
};

export type AppMatchDetail = {
  match: AppMatch;
  referee: string | null;
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  } | null;
  events: AppMatchEvent[];
};

export function normalizeApiFootballEvent(event: ApiFootballEvent): AppMatchEvent {
  return {
    time: {
      elapsed: event.time.elapsed,
      extra: event.time.extra ?? null
    },
    team: {
      id: `api-football-team-${event.team.id}`,
      name: event.team.name
    },
    player: {
      id: event.player.id ? `api-football-player-${event.player.id}` : null,
      name: event.player.name
    },
    assist: event.assist ? {
      id: event.assist.id ? `api-football-player-${event.assist.id}` : null,
      name: event.assist.name || null
    } : null,
    type: event.type,
    detail: event.detail,
    comments: event.comments || null
  };
}

export function normalizeApiFootballFixtureDetail(fixture: ApiFootballFixtureDetail): AppMatchDetail {
  const match = normalizeApiFootballFixture(fixture);
  const events = (fixture.events || []).map(normalizeApiFootballEvent);

  return {
    match,
    referee: fixture.referee || null,
    score: fixture.score ? {
      halftime: {
        home: fixture.score.halftime?.home ?? null,
        away: fixture.score.halftime?.away ?? null
      },
      fulltime: {
        home: fixture.score.fulltime?.home ?? null,
        away: fixture.score.fulltime?.away ?? null
      },
      extratime: {
        home: fixture.score.extratime?.home ?? null,
        away: fixture.score.extratime?.away ?? null
      },
      penalty: {
        home: fixture.score.penalty?.home ?? null,
        away: fixture.score.penalty?.away ?? null
      }
    } : null,
    events
  };
}

function parseFixtureDetail(value: unknown): ApiFootballFixtureDetail {
  const fixtureRaw = parseFixture(value) as ApiFootballFixtureDetail;
  const root = readRecord(value, 'fixture root');
  const fixture = readRecord(root.fixture, 'fixture object');

  if (typeof fixture.referee === 'string') {
    fixtureRaw.referee = fixture.referee;
  } else {
    fixtureRaw.referee = null;
  }

  if (isRecord(root.score)) {
    const rawScore = root.score;
    const halftime = isRecord(rawScore.halftime) ? rawScore.halftime : null;
    const fulltime = isRecord(rawScore.fulltime) ? rawScore.fulltime : null;
    const extratime = isRecord(rawScore.extratime) ? rawScore.extratime : null;
    const penalty = isRecord(rawScore.penalty) ? rawScore.penalty : null;

    fixtureRaw.score = {
      halftime: {
        home: halftime && typeof halftime.home === 'number' ? halftime.home : null,
        away: halftime && typeof halftime.away === 'number' ? halftime.away : null
      },
      fulltime: {
        home: fulltime && typeof fulltime.home === 'number' ? fulltime.home : null,
        away: fulltime && typeof fulltime.away === 'number' ? fulltime.away : null
      },
      extratime: {
        home: extratime && typeof extratime.home === 'number' ? extratime.home : null,
        away: extratime && typeof extratime.away === 'number' ? extratime.away : null
      },
      penalty: {
        home: penalty && typeof penalty.home === 'number' ? penalty.home : null,
        away: penalty && typeof penalty.away === 'number' ? penalty.away : null
      }
    };
  } else {
    fixtureRaw.score = null;
  }

  if (Array.isArray(root.events)) {
    fixtureRaw.events = root.events.map((e) => {
      const ev = readRecord(e, 'event object');
      const time = readRecord(ev.time, 'event time');
      const team = readRecord(ev.team, 'event team');
      const player = readRecord(ev.player, 'event player');
      const assist = ev.assist ? readRecord(ev.assist, 'event assist') : null;

      const event: ApiFootballEvent = {
        time: {
          elapsed: readNumber(time.elapsed, 'event elapsed time'),
          extra: typeof time.extra === 'number' ? time.extra : null
        },
        team: {
          id: readNumber(team.id, 'event team id'),
          name: readString(team.name, 'event team name')
        },
        player: {
          id: typeof player.id === 'number' ? player.id : null,
          name: typeof player.name === 'string' ? player.name : 'Unknown'
        },
        type: readString(ev.type, 'event type'),
        detail: readString(ev.detail, 'event detail'),
        comments: typeof ev.comments === 'string' ? ev.comments : null
      };

      if (assist) {
        event.assist = {
          id: typeof assist.id === 'number' ? assist.id : null,
          name: typeof assist.name === 'string' ? assist.name : 'Unknown'
        };
      }

      return event;
    });
  } else {
    fixtureRaw.events = [];
  }

  return fixtureRaw;
}

function parseDetailEnvelope(value: unknown): ApiFootballFixtureDetail[] {
  const envelope = readRecord(value, 'response envelope') as ApiFootballEnvelope;
  if (
    envelope.errors &&
    typeof envelope.errors === 'object' &&
    !Array.isArray(envelope.errors) &&
    Object.keys(envelope.errors).length > 0
  ) {
    const messages = Object.entries(envelope.errors)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    throw new ApiFootballProviderError(
      'api_football_api_error',
      `API-Football returned errors: ${messages}`,
      502
    );
  }
  if (!Array.isArray(envelope.response)) {
    throw new ApiFootballProviderError('api_football_invalid_payload', 'API-Football response must be an array.', 502);
  }
  return (envelope.response as unknown[]).map(parseFixtureDetail);
}

function getMockFixtureDetail(fixtureId: string): AppMatchDetail {
  const homeTeamName = 'Japan';
  const awayTeamName = 'Vietnam';
  const homeTeamId = 'api-football-team-100';
  const awayTeamId = 'api-football-team-200';

  return {
    match: {
      id: `api-football-fixture-${fixtureId}`,
      sourceProviderId: 'api-football',
      providerFixtureId: fixtureId,
      competitionId: 'api-football-league-1',
      competitionName: 'FIFA World Cup',
      seasonId: 'api-football-season-2026',
      round: 'Group Stage - 1',
      status: 'completed',
      statusLabel: 'Match Finished',
      kickoffTime: '2026-06-29T10:00:00.000Z',
      homeTeam: { id: homeTeamId, name: homeTeamName },
      awayTeam: { id: awayTeamId, name: awayTeamName },
      score: { home: 2, away: 1 },
      venueName: 'Tokyo Stadium',
      elapsedMinute: 90
    },
    referee: 'Michael Oliver',
    score: {
      halftime: { home: 1, away: 0 },
      fulltime: { home: 2, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    },
    events: [
      {
        time: { elapsed: 12, extra: null },
        team: { id: homeTeamId, name: homeTeamName },
        player: { id: 'api-football-player-101', name: 'K. Minamino' },
        assist: { id: 'api-football-player-102', name: 'J. Ito' },
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null
      },
      {
        time: { elapsed: 45, extra: null },
        team: { id: awayTeamId, name: awayTeamName },
        player: { id: 'api-football-player-201', name: 'Nguyen Cong Phuong' },
        assist: null,
        type: 'Card',
        detail: 'Yellow Card',
        comments: 'Argument'
      },
      {
        time: { elapsed: 60, extra: null },
        team: { id: awayTeamId, name: awayTeamName },
        player: { id: 'api-football-player-202', name: 'Nguyen Quang Hai' },
        assist: { id: 'api-football-player-203', name: 'Nguyen Van Toan' },
        type: 'subst',
        detail: 'Substitution 1',
        comments: null
      },
      {
        time: { elapsed: 75, extra: null },
        team: { id: awayTeamId, name: awayTeamName },
        player: { id: 'api-football-player-204', name: 'Nguyen Tien Linh' },
        assist: null,
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null
      },
      {
        time: { elapsed: 88, extra: null },
        team: { id: homeTeamId, name: homeTeamName },
        player: { id: 'api-football-player-103', name: 'R. Doan' },
        assist: null,
        type: 'Goal',
        detail: 'Normal Goal',
        comments: null
      }
    ]
  };
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
    },

    async fetchFixtureDetail(fixtureId: string): Promise<AppMatchDetail> {
      const isMock = !config.apiKey || config.apiKey === 'mock' || config.apiKey === 'dummy';
      if (isMock) {
        return getMockFixtureDetail(fixtureId);
      }

      const url = new URL('/fixtures', config.baseUrl);
      url.searchParams.set('id', fixtureId);

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
      const fixtures = parseDetailEnvelope(payload);

      if (fixtures.length === 0) {
        throw new ApiFootballProviderError(
          'api_football_fixture_not_found',
          `Fixture ${fixtureId} not found.`,
          404
        );
      }

      return normalizeApiFootballFixtureDetail(fixtures[0]);
    }
  };
}
