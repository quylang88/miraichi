import type { IncomingMessage, ServerResponse } from 'http';
import {
  ApiFootballProviderError,
  createApiFootballClient,
  readApiFootballConfig,
  type AppMatch
} from '../providers/api-football-client.js';
import {
  createDailyQuotaGuard,
  createMatchdayCache,
  type CacheStatus,
  type DailyQuotaSnapshot
} from '../services/matchday-cache.js';

export type MatchFeedResponse = {
  sourceProviderId: 'api-football';
  mode: 'date';
  fetchedAt: string;
  cache: { status: CacheStatus; ttlSeconds: number };
  quota: DailyQuotaSnapshot;
  matches: AppMatch[];
  warnings: string[];
};

type MatchLoader = (date: string) => Promise<MatchFeedResponse>;

const ttlSeconds = 900;

const cachedFeeds = createMatchdayCache<Omit<MatchFeedResponse, 'cache'>>({
  ttlSeconds
});

let quotaGuard: ReturnType<typeof createDailyQuotaGuard> | null = null;

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function defaultLoadMatches(date: string): Promise<MatchFeedResponse> {
  const config = readApiFootballConfig(process.env);
  quotaGuard ??= createDailyQuotaGuard({ dailyLimit: config.dailyLimit });

  const cacheKey = `api-football:fixtures:date:${date}`;
  const cached = cachedFeeds.get(cacheKey);
  if (cached) {
    return {
      ...cached,
      cache: { status: 'hit', ttlSeconds },
      quota: quotaGuard.snapshot()
    };
  }

  const quota = quotaGuard.tryConsume();
  if (!quota.allowed) {
    throw new ApiFootballProviderError(
      'api_football_quota_exhausted',
      'API-Football daily quota guard is exhausted for this local API process.',
      429
    );
  }

  const client = createApiFootballClient({ config });
  const result = await client.fetchFixturesByDate(date);
  const feed: Omit<MatchFeedResponse, 'cache'> = {
    sourceProviderId: 'api-football',
    mode: 'date',
    fetchedAt: new Date().toISOString(),
    quota: quota.snapshot,
    matches: result.matches,
    warnings: result.warnings
  };
  cachedFeeds.set(cacheKey, feed);

  return {
    ...feed,
    cache: { status: 'miss', ttlSeconds }
  };
}

function errorStatus(error: unknown): number {
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : 500;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'matches_route_error';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load match feed.';
}

export async function handleMatches(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { loadMatches?: MatchLoader } = {}
): Promise<void> {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const date = parsedUrl.searchParams.get('date') || todayUtc();

  if (!validDate(date)) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'invalid_match_date',
        message: 'date must use YYYY-MM-DD format.'
      }
    }));
    return;
  }

  try {
    const loadMatches = dependencies.loadMatches ?? defaultLoadMatches;
    const payload = await loadMatches(date);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
  } catch (error) {
    res.writeHead(errorStatus(error), { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: errorCode(error),
        message: errorMessage(error)
      }
    }));
  }
}
