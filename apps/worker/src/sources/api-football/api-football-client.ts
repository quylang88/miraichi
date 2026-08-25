import {
  ApiFootballUsageLedger,
  ApiFootballQuotaExceededError,
  type ApiFootballUsageState,
  type ApiFootballDailyUsage,
  type ApiFootballLastReportedHeader
} from './api-football-usage-ledger.js';

export {
  ApiFootballQuotaExceededError,
  ApiFootballUsageLedger,
  type ApiFootballUsageState,
  type ApiFootballDailyUsage,
  type ApiFootballLastReportedHeader
};

export interface ApiFootballFixtureItem {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    venue?: { id: number | null; name: string | null; city: string | null };
    status: {
      long: string;
      short: string;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
    logo?: string;
    flag?: string | null;
    season: number;
    round: string;
  };
  teams: {
    home: { id: number; name: string; logo?: string; winner: boolean | null };
    away: { id: number; name: string; logo?: string; winner: boolean | null };
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
}

export interface ApiFootballApiResponse<T = ApiFootballFixtureItem> {
  get: string;
  parameters: Record<string, string>;
  errors: Record<string, string> | string[];
  results: number;
  paging?: { current: number; total: number };
  response: T[];
}

export class ApiFootballHttpError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly responseBody?: string) {
    super(message);
    this.name = 'ApiFootballHttpError';
  }
}

export interface ApiFootballClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  ledger?: ApiFootballUsageLedger;
  ledgerPath?: string;
  dataRoot?: string;
  now?: () => Date;
  sleepFn?: (ms: number) => Promise<void>;
  hardCeiling?: number;
  totalLimit?: number;
}

export class ApiFootballClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  public readonly ledger: ApiFootballUsageLedger;
  private readonly now: () => Date;

  constructor(options: ApiFootballClientOptions = {}) {
    this.apiKey = (options.apiKey !== undefined ? options.apiKey : process.env.API_FOOTBALL_KEY) || '';
    this.baseUrl = options.baseUrl || process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io';
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
    this.now = options.now || (() => new Date());

    if (options.ledger) {
      this.ledger = options.ledger;
    } else {
      this.ledger = new ApiFootballUsageLedger({
        storagePath: options.ledgerPath,
        dataRoot: options.dataRoot,
        hardCeiling: options.hardCeiling,
        totalLimit: options.totalLimit,
        now: this.now,
        sleepFn: options.sleepFn
      });
    }
  }

  public async fetchSeasonFixtures(
    leagueId: number,
    season: number,
    options: { emergency?: boolean } = {}
  ): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> {
    return this.executeGet<ApiFootballFixtureItem>(
      '/fixtures',
      {
        league: String(leagueId),
        season: String(season)
      },
      options
    );
  }

  public async fetchFixturesByDate(
    date: string,
    options: { emergency?: boolean } = {}
  ): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> {
    return this.executeGet<ApiFootballFixtureItem>('/fixtures', { date }, options);
  }

  public async fetchFixturesByIds(
    fixtureIds: readonly number[],
    options: { emergency?: boolean } = {}
  ): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> {
    if (fixtureIds.length === 0) {
      return {
        get: 'fixtures',
        parameters: { ids: '' },
        errors: [],
        results: 0,
        response: []
      };
    }
    const idsParam = fixtureIds.join('-');
    return this.executeGet<ApiFootballFixtureItem>('/fixtures', { ids: idsParam }, options);
  }

  public async fetchLiveFixtures(
    options: { leagueIds?: readonly number[]; emergency?: boolean } = {}
  ): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> {
    const params: Record<string, string> = { live: 'all' };
    if (options.leagueIds && options.leagueIds.length > 0) {
      params.league = options.leagueIds.join('-');
    }
    return this.executeGet<ApiFootballFixtureItem>(
      '/fixtures',
      params,
      options.emergency !== undefined ? { emergency: options.emergency } : {}
    );
  }

  private async executeGet<T>(
    endpoint: string,
    params: Record<string, string>,
    options: { emergency?: boolean } = {}
  ): Promise<ApiFootballApiResponse<T>> {
    if (!this.apiKey || this.apiKey.trim() === '') {
      const error = new Error('api_football_key_missing');
      (error as { code?: string }).code = 'api_football_key_missing';
      throw error;
    }

    await this.ledger.reserveSlot(options.emergency !== undefined ? { emergency: options.emergency } : {});

    const url = new URL(endpoint, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      'x-apisports-key': this.apiKey,
      Accept: 'application/json'
    };

    const response = await this.fetchFn(url.toString(), {
      method: 'GET',
      headers
    });

    if (response.headers) {
      await this.ledger.reconcileHeaders(response.headers);
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new ApiFootballHttpError(
        `API-Football HTTP error ${response.status}: ${response.statusText}`,
        response.status,
        body
      );
    }

    const json = (await response.json()) as ApiFootballApiResponse<T>;
    if (json.errors && Object.keys(json.errors).length > 0) {
      const errorMsg = Array.isArray(json.errors) ? json.errors.join(', ') : JSON.stringify(json.errors);
      throw new ApiFootballHttpError(`API-Football responded with error: ${errorMsg}`, 200, errorMsg);
    }

    return json;
  }
}
