import type { IncomingMessage, ServerResponse } from 'http';
import {
  ApiFootballProviderError,
  createApiFootballClient,
  readApiFootballConfig,
  type AppMatchDetail
} from '../providers/api-football-client.js';

export type MatchDetailResponse = AppMatchDetail;

type DetailLoader = (id: string) => Promise<MatchDetailResponse>;

async function defaultLoadDetail(id: string): Promise<MatchDetailResponse> {
  const providerFixtureId = id.startsWith('api-football-fixture-')
    ? id.replace('api-football-fixture-', '')
    : id;

  let config;
  try {
    config = readApiFootballConfig(process.env);
  } catch (err) {
    if (err instanceof ApiFootballProviderError && err.code === 'api_football_key_missing') {
      config = {
        apiKey: 'mock',
        baseUrl: 'https://v3.football.api-sports.io',
        dailyLimit: 100
      };
    } else {
      throw err;
    }
  }

  // Handle keys set explicitly to 'mock' or 'dummy'
  if (config.apiKey === 'mock' || config.apiKey === 'dummy') {
    config = { ...config, apiKey: 'mock' };
  }

  const client = createApiFootballClient({ config });
  return client.fetchFixtureDetail(providerFixtureId);
}

function errorStatus(error: unknown): number {
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : 500;
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : 'match_detail_route_error';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Failed to load match detail.';
}

export async function handleMatchDetail(
  req: IncomingMessage,
  res: ServerResponse,
  dependencies: { loadDetail?: DetailLoader } = {}
): Promise<void> {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const id = parsedUrl.searchParams.get('id');

  if (!id || id.trim() === '') {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      error: {
        code: 'missing_match_id',
        message: 'id parameter is required.'
      }
    }));
    return;
  }

  try {
    const loadDetail = dependencies.loadDetail ?? defaultLoadDetail;
    const payload = await loadDetail(id);
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
