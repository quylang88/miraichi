import { API_FOOTBALL_QUOTA_CONFIG } from '@miraichi/config';

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

export class ApiFootballQuotaExceededError extends Error {
  constructor(message: string, public readonly usedToday: number, public readonly limit: number) {
    super(message);
    this.name = 'ApiFootballQuotaExceededError';
  }
}

export class ApiFootballHttpError extends Error {
  constructor(message: string, public readonly statusCode: number, public readonly responseBody?: string) {
    super(message);
    this.name = 'ApiFootballHttpError';
  }
}

export interface DailyQuotaState {
  dateUtc: string;
  usedToday: number;
  limit: number;
}

export class DailyQuotaGuard {
  private dateUtc: string;
  private usedToday: number;
  private readonly hardCeiling: number;
  private readonly totalLimit: number;

  constructor(options?: {
    now?: () => Date;
    hardCeiling?: number;
    totalLimit?: number;
    initialUsed?: number;
  }) {
    const now = options?.now ? options.now() : new Date();
    this.dateUtc = now.toISOString().slice(0, 10);
    this.hardCeiling = options?.hardCeiling ?? API_FOOTBALL_QUOTA_CONFIG.hardCeiling;
    this.totalLimit = options?.totalLimit ?? API_FOOTBALL_QUOTA_CONFIG.dailyLimit;
    this.usedToday = options?.initialUsed ?? 0;
  }

  public checkAndRotate(now: Date = new Date()): void {
    const currentDateUtc = now.toISOString().slice(0, 10);
    if (currentDateUtc !== this.dateUtc) {
      this.dateUtc = currentDateUtc;
      this.usedToday = 0;
    }
  }

  public canRequest(emergency = false, now: Date = new Date()): boolean {
    this.checkAndRotate(now);
    const ceiling = emergency ? this.totalLimit : this.hardCeiling;
    return this.usedToday < ceiling;
  }

  public recordRequest(emergency = false, now: Date = new Date()): void {
    this.checkAndRotate(now);
    const ceiling = emergency ? this.totalLimit : this.hardCeiling;
    if (this.usedToday >= ceiling) {
      throw new ApiFootballQuotaExceededError(
        `API-Football daily request quota reached (${this.usedToday}/${ceiling}) for ${this.dateUtc}`,
        this.usedToday,
        ceiling
      );
    }
    this.usedToday += 1;
  }

  public getState(now: Date = new Date()): DailyQuotaState {
    this.checkAndRotate(now);
    return {
      dateUtc: this.dateUtc,
      usedToday: this.usedToday,
      limit: this.hardCeiling
    };
  }

  public getRemainingQuota(emergency = false, now: Date = new Date()): number {
    this.checkAndRotate(now);
    const ceiling = emergency ? this.totalLimit : this.hardCeiling;
    return Math.max(0, ceiling - this.usedToday);
  }
}

export interface ApiFootballClientOptions {
  apiKey?: string;
  baseUrl?: string;
  fetchFn?: typeof fetch;
  quotaGuard?: DailyQuotaGuard;
  now?: () => Date;
}

export class ApiFootballClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  public readonly quotaGuard: DailyQuotaGuard;
  private readonly now: () => Date;

  constructor(options: ApiFootballClientOptions = {}) {
    this.apiKey = options.apiKey || process.env.API_FOOTBALL_KEY || process.env.RAPIDAPI_KEY || 'mock-api-key';
    this.baseUrl = options.baseUrl || 'https://v3.football.api-sports.io';
    this.fetchFn = options.fetchFn || globalThis.fetch.bind(globalThis);
    this.now = options.now || (() => new Date());
    this.quotaGuard = options.quotaGuard || new DailyQuotaGuard({ now: this.now });
  }

  public async fetchSeasonFixtures(
    leagueId: number,
    season: number,
    options: { emergency?: boolean } = {}
  ): Promise<ApiFootballApiResponse<ApiFootballFixtureItem>> {
    return this.executeGet<ApiFootballFixtureItem>('/fixtures', {
      league: String(leagueId),
      season: String(season)
    }, options);
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
    this.quotaGuard.recordRequest(options.emergency, this.now());

    const url = new URL(endpoint, this.baseUrl);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const headers: Record<string, string> = {
      'x-apisports-key': this.apiKey,
      'Accept': 'application/json'
    };

    const response = await this.fetchFn(url.toString(), {
      method: 'GET',
      headers
    });

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
