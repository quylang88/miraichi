import type { RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';

export type SportmonksRateLimitSnapshot = RawProviderPayloadEnvelope['rateLimit'];

export interface SportmonksHttpHeaders {
  get(name: string): string | null;
}

export interface SportmonksHttpResponse {
  status: number;
  headers: SportmonksHttpHeaders;
  json(): Promise<unknown>;
  text(): Promise<string>;
}

export type SportmonksFetchImplementation = (
  url: string,
  init?: { method: 'GET'; headers: Record<string, string> }
) => Promise<SportmonksHttpResponse>;

export type SportmonksClientFailureStatus =
  | 'rate_limited'
  | 'unavailable'
  | 'failed';

export type SportmonksClientResult =
  | {
      ok: true;
      statusCode: number;
      body: unknown;
      rateLimit: SportmonksRateLimitSnapshot;
    }
  | {
      ok: false;
      status: SportmonksClientFailureStatus;
      statusCode: number;
      message: string;
      rateLimit: SportmonksRateLimitSnapshot;
    };

export interface SportmonksClient {
  get(urlPath: string, query?: Record<string, string>): Promise<SportmonksClientResult>;
}

export interface CreateSportmonksClientOptions {
  apiBaseUrl: string;
  apiToken: string;
  maxRequestsPerMinute?: number;
  maxRetries?: number;
  fetchImpl?: SportmonksFetchImplementation;
  wait?: (ms: number) => Promise<void>;
}

const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_BACKOFF_MS = 250;

export function createSportmonksClient(options: CreateSportmonksClientOptions): SportmonksClient {
  const baseUrl = options.apiBaseUrl.replace(/\/+$/, '');
  const apiToken = options.apiToken.trim();
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const fetchImpl = options.fetchImpl ?? defaultFetch;
  const wait = options.wait ?? defaultWait;
  const minRequestSpacingMs = toMinRequestSpacingMs(options.maxRequestsPerMinute);
  let nextRequestAt = 0;

  return {
    async get(urlPath: string, query: Record<string, string> = {}): Promise<SportmonksClientResult> {
      const url = buildSportmonksUrl(baseUrl, urlPath, query, apiToken);

      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        await throttleIfNeeded(minRequestSpacingMs, wait, () => Date.now(), (value) => {
          nextRequestAt = value;
        }, () => nextRequestAt);

        let response: SportmonksHttpResponse;
        try {
          response = await fetchImpl(url, {
            method: 'GET',
            headers: { accept: 'application/json' }
          });
        } catch (error) {
          if (attempt < maxRetries) {
            await wait(backoffMs(attempt));
            continue;
          }
          return {
            ok: false,
            status: 'failed',
            statusCode: 0,
            message: sanitizeErrorMessage(error),
            rateLimit: {}
          };
        }

        const body = await readJsonOrText(response);
        const rateLimit = parseSportmonksRateLimit({ body, headers: response.headers });

        if (response.status >= 200 && response.status < 300) {
          return {
            ok: true,
            statusCode: response.status,
            body,
            rateLimit
          };
        }

        if (response.status === 429) {
          return {
            ok: false,
            status: 'rate_limited',
            statusCode: response.status,
            message: 'Sportmonks rate limit reached',
            rateLimit
          };
        }

        if (response.status >= 500 && attempt < maxRetries) {
          await wait(backoffMs(attempt));
          continue;
        }

        if (response.status === 401 || response.status === 403 || response.status === 404) {
          return {
            ok: false,
            status: 'unavailable',
            statusCode: response.status,
            message: `Sportmonks endpoint unavailable with status ${response.status}`,
            rateLimit
          };
        }

        return {
          ok: false,
          status: 'failed',
          statusCode: response.status,
          message: `Sportmonks request failed with status ${response.status}`,
          rateLimit
        };
      }

      return {
        ok: false,
        status: 'failed',
        statusCode: 0,
        message: 'Sportmonks request failed after retries',
        rateLimit: {}
      };
    }
  };
}

export function parseSportmonksRateLimit(input: {
  body: unknown;
  headers: SportmonksHttpHeaders;
}): SportmonksRateLimitSnapshot {
  const snapshot: SportmonksRateLimitSnapshot = {};
  const rateLimitBody = getObjectProperty(input.body, 'rate_limit');

  const requestedEntity = readOptionalString(rateLimitBody?.requested_entity);
  if (requestedEntity !== undefined) {
    snapshot.requestedEntity = requestedEntity;
  }

  const remaining = readOptionalNumber(rateLimitBody?.remaining)
    ?? readOptionalNumberFromHeader(input.headers, ['x-ratelimit-remaining', 'x-rate-limit-remaining', 'ratelimit-remaining']);
  if (remaining !== undefined) {
    snapshot.remaining = remaining;
  }

  const resetsInSeconds = readOptionalNumber(rateLimitBody?.resets_in_seconds)
    ?? readOptionalNumberFromHeader(input.headers, ['retry-after', 'x-ratelimit-reset', 'x-rate-limit-reset', 'ratelimit-reset']);
  if (resetsInSeconds !== undefined) {
    snapshot.resetsInSeconds = resetsInSeconds;
  }

  return snapshot;
}

function buildSportmonksUrl(
  baseUrl: string,
  urlPath: string,
  query: Record<string, string>,
  apiToken: string
): string {
  const path = urlPath.startsWith('/') ? urlPath : `/${urlPath}`;
  const url = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }
  url.searchParams.set('api_token', apiToken);
  return url.toString();
}

function toMinRequestSpacingMs(maxRequestsPerMinute: number | undefined): number {
  if (maxRequestsPerMinute === undefined || maxRequestsPerMinute <= 0) {
    return 0;
  }
  return Math.ceil(60_000 / maxRequestsPerMinute);
}

async function throttleIfNeeded(
  minRequestSpacingMs: number,
  wait: (ms: number) => Promise<void>,
  now: () => number,
  setNextRequestAt: (value: number) => void,
  getNextRequestAt: () => number
): Promise<void> {
  if (minRequestSpacingMs <= 0) {
    return;
  }

  const currentTime = now();
  const delay = getNextRequestAt() - currentTime;
  if (delay > 0) {
    await wait(delay);
  }
  const nextBase = Math.max(now(), getNextRequestAt());
  setNextRequestAt(nextBase + minRequestSpacingMs);
}

function backoffMs(attempt: number): number {
  return DEFAULT_BACKOFF_MS * (2 ** attempt);
}

async function defaultWait(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function defaultFetch(
  url: string,
  init?: { method: 'GET'; headers: Record<string, string> }
): Promise<SportmonksHttpResponse> {
  return fetch(url, init);
}

async function readJsonOrText(response: SportmonksHttpResponse): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    try {
      return await response.text();
    } catch {
      return null;
    }
  }
}

function getObjectProperty(input: unknown, property: string): Record<string, unknown> | undefined {
  if (!isRecord(input)) {
    return undefined;
  }
  const value = input[property];
  return isRecord(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readOptionalNumberFromHeader(headers: SportmonksHttpHeaders, names: string[]): number | undefined {
  for (const name of names) {
    const value = headers.get(name);
    const parsed = readOptionalNumber(value);
    if (parsed !== undefined) {
      return parsed;
    }
  }
  return undefined;
}

function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return `Sportmonks request failed: ${error.message}`;
  }
  return 'Sportmonks request failed';
}
