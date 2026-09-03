import { Buffer } from 'node:buffer';

const SPORTSCORE_WIDGET_ORIGIN = 'https://sportscore.com' as const;
const MATCHES_PATH = '/api/widget/matches/' as const;
const MATCH_PATH = '/api/widget/match/' as const;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type SportScoreWidgetClientErrorCode =
  | 'invalid_configuration'
  | 'invalid_request'
  | 'timeout'
  | 'network'
  | 'http_status'
  | 'invalid_json'
  | 'invalid_payload';

export class SportScoreWidgetClientError extends Error {
  constructor(readonly code: SportScoreWidgetClientErrorCode, message: string) {
    super(message);
    this.name = 'SportScoreWidgetClientError';
  }
}

export interface SportScoreWidgetEnvelope {
  readonly matches: readonly Record<string, unknown>[];
}

export interface SportScoreLiveSource {
  listMatches(): Promise<SportScoreWidgetEnvelope>;
  getMatch(slug: string): Promise<Record<string, unknown>>;
}

export interface SportScoreWidgetClientOptions {
  readonly fetcher?: typeof fetch;
  readonly timeoutMs?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateTimeout(value: number): number {
  if (!Number.isInteger(value) || value < 500 || value > 30_000) {
    throw new SportScoreWidgetClientError('invalid_configuration', 'Widget timeout must be an integer from 500 to 30000 milliseconds.');
  }
  return value;
}

export class SportScoreWidgetClient implements SportScoreLiveSource {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs: number;

  constructor(options: SportScoreWidgetClientOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = validateTimeout(options.timeoutMs ?? 8_000);
  }

  async listMatches(): Promise<SportScoreWidgetEnvelope> {
    const payload = await this.request(MATCHES_PATH, { sport: 'football', limit: '50' });
    if (!isRecord(payload)
      || !Array.isArray(payload.matches)
      || payload.matches.length > 50
      || payload.matches.some((match) => !isRecord(match))) {
      throw new SportScoreWidgetClientError('invalid_payload', 'Widget match list contract is invalid.');
    }
    return { matches: payload.matches };
  }

  async getMatch(slug: string): Promise<Record<string, unknown>> {
    if (!SLUG_PATTERN.test(slug) || slug.length > 160) {
      throw new SportScoreWidgetClientError('invalid_request', 'Widget match slug is invalid.');
    }
    const payload = await this.request(MATCH_PATH, { sport: 'football', slug });
    if (!isRecord(payload)) throw new SportScoreWidgetClientError('invalid_payload', 'Widget match contract is invalid.');
    return payload;
  }

  private async request(pathname: typeof MATCHES_PATH | typeof MATCH_PATH, query: Readonly<Record<string, string>>): Promise<unknown> {
    const url = new URL(pathname, SPORTSCORE_WIDGET_ORIGIN);
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
    if (url.origin !== SPORTSCORE_WIDGET_ORIGIN || (url.pathname !== MATCHES_PATH && url.pathname !== MATCH_PATH)) {
      throw new SportScoreWidgetClientError('invalid_request', 'Widget request escaped the approved boundary.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetcher(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        redirect: 'error',
        signal: controller.signal
      });
    } catch {
      throw new SportScoreWidgetClientError(controller.signal.aborted ? 'timeout' : 'network', controller.signal.aborted ? 'Widget request timed out.' : 'Widget request failed.');
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new SportScoreWidgetClientError('http_status', 'Widget returned a non-success status.');

    const contentLength = Number(response.headers?.get?.('content-length') ?? 0);
    if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
      throw new SportScoreWidgetClientError('invalid_payload', 'Widget response is too large.');
    }
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new SportScoreWidgetClientError('invalid_payload', 'Widget response is too large.');
    }
    try {
      return JSON.parse(body) as unknown;
    } catch {
      throw new SportScoreWidgetClientError('invalid_json', 'Widget response is not valid JSON.');
    }
  }
}
