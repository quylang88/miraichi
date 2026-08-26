import { SPORTSCORE_SOURCE_ORIGIN } from '@miraichi/config';
import {
  parseSportScoreFixturesResponse,
  parseSportScoreMatchResponse,
  SportScoreResponseContractError,
  type SportScoreFixturesResponse,
  type SportScoreMatchResponse
} from './sportscore-response-contract.js';
import {
  type SportScoreEvidenceRequestMetadata,
  type SportScoreRawEvidenceCache
} from './sportscore-raw-evidence-cache.js';
import { mapSportScoreStatus } from './sportscore-adapter.js';

export type SportScoreClientErrorCode =
  | 'invalid_configuration'
  | 'invalid_request'
  | 'timeout'
  | 'network'
  | 'http_status'
  | 'invalid_json'
  | 'invalid_payload';

export class SportScoreClientError extends Error {
  readonly code: SportScoreClientErrorCode;
  readonly statusCode?: number;

  constructor(code: SportScoreClientErrorCode, message: string, statusCode?: number) {
    super(message);
    this.name = 'SportScoreClientError';
    this.code = code;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
  }
}

export interface SportScoreRequestObservation {
  endpoint: 'fixtures' | 'match';
  path: string;
  query: Record<string, string>;
  requestedAt: string;
  completedAt: string;
  attempt: number;
  authenticated: boolean;
  outcome: 'success' | 'retry' | 'failure';
  statusCode?: number;
  errorCode?: SportScoreClientErrorCode;
}

export interface SportScoreClientOptions {
  apiKey?: string;
  /** Test seam only. It still must resolve to the exact approved HTTPS origin. */
  baseUrl?: string;
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxRetries?: number;
  initialBackoffMs?: number;
  maxBackoffMs?: number;
  maxConcurrency?: number;
  responseCacheTtlMs?: number;
  responseCacheMaxEntries?: number;
  now?: () => number;
  random?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  evidenceCache?: SportScoreRawEvidenceCache;
  onRequestObservation?: (observation: SportScoreRequestObservation) => void;
}

export interface SportScoreFixturesRequest {
  date: string;
  competition: string;
  limit?: number;
}

export interface SportScoreMatchRequest {
  slug: string;
}

interface ResponseCacheEntry<T> {
  payload: T;
  expiresAt: number;
}

interface RequestDescriptor<T> {
  endpoint: 'fixtures' | 'match';
  url: URL;
  parse: (value: unknown) => T;
}

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_INITIAL_BACKOFF_MS = 250;
const DEFAULT_MAX_BACKOFF_MS = 5_000;
const DEFAULT_MAX_CONCURRENCY = 2;
const DEFAULT_RESPONSE_CACHE_TTL_MS = 60_000;
const DEFAULT_RESPONSE_CACHE_MAX_ENTRIES = 200;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function requireNonNegativeInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new SportScoreClientError('invalid_configuration', `${field} must be a non-negative integer.`);
  }
}

function requirePositiveInteger(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new SportScoreClientError('invalid_configuration', `${field} must be a positive integer.`);
  }
}

function validateBaseUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new SportScoreClientError(
      'invalid_configuration',
      'SPORTSCORE_BASE_URL must be the approved HTTPS origin.'
    );
  }

  const approved = new URL(SPORTSCORE_SOURCE_ORIGIN);
  if (
    url.protocol !== 'https:'
    || url.origin !== approved.origin
    || url.username !== ''
    || url.password !== ''
    || (url.pathname !== '' && url.pathname !== '/')
    || url.search !== ''
    || url.hash !== ''
  ) {
    throw new SportScoreClientError(
      'invalid_configuration',
      'SPORTSCORE_BASE_URL must be the exact approved HTTPS origin.'
    );
  }

  return approved;
}

function validateSlug(value: string, field: string): void {
  if (!SLUG_PATTERN.test(value) || value.length > 160) {
    throw new SportScoreClientError(
      'invalid_request',
      `${field} must be a lowercase provider slug.`
    );
  }
}

function validateDate(value: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new SportScoreClientError('invalid_request', 'SportScore date must use YYYY-MM-DD.');
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new SportScoreClientError('invalid_request', 'SportScore date must be a real calendar day.');
  }
}

function defaultSleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function redactSecret(value: unknown, secret: string | undefined): unknown {
  if (secret === undefined) {
    return value;
  }
  if (typeof value === 'string') {
    return value.replaceAll(secret, '[REDACTED]');
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecret(item, secret));
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
      key.replaceAll(secret, '[REDACTED]'),
      redactSecret(nestedValue, secret)
    ]));
  }
  return value;
}

function sanitizeEvidencePayload(
  endpoint: 'fixtures' | 'match',
  payload: unknown
): {
  payload: unknown;
  redactions?: {
    inPlayMatchesOmitted?: number;
    inPlayMatchDetailOmitted?: boolean;
  };
} {
  if (!isRecord(payload)) return { payload };

  if (endpoint === 'fixtures' && Array.isArray(payload.matches)) {
    let inPlayMatchesOmitted = 0;
    const matches = payload.matches.filter((match) => {
      if (!isRecord(match)) return true;
      const status = mapSportScoreStatus(match.status) ?? mapSportScoreStatus(match.status_text);
      if (status !== 'in_play') return true;
      inPlayMatchesOmitted += 1;
      return false;
    });
    return {
      payload: { ...payload, matches },
      ...(inPlayMatchesOmitted === 0 ? {} : {
        redactions: { inPlayMatchesOmitted }
      })
    };
  }

  if (endpoint === 'match') {
    const match = isRecord(payload.match) ? payload.match : payload;
    const status = mapSportScoreStatus(match.status) ?? mapSportScoreStatus(match.status_text);
    if (status === 'in_play') {
      return {
        payload: {},
        redactions: { inPlayMatchDetailOmitted: true }
      };
    }
  }

  return { payload };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class SportScoreClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: URL;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly initialBackoffMs: number;
  private readonly maxBackoffMs: number;
  private readonly maxConcurrency: number;
  private readonly responseCacheTtlMs: number;
  private readonly responseCacheMaxEntries: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;
  private readonly evidenceCache: SportScoreRawEvidenceCache | undefined;
  private readonly onRequestObservation:
    | ((observation: SportScoreRequestObservation) => void)
    | undefined;
  private readonly responseCache = new Map<string, ResponseCacheEntry<unknown>>();
  private readonly inFlight = new Map<string, Promise<unknown>>();
  private readonly concurrencyWaiters: Array<() => void> = [];
  private activeRequests = 0;

  constructor(options: SportScoreClientOptions = {}) {
    const configuredKey = options.apiKey ?? process.env.SPORTSCORE_API_KEY;
    const trimmedKey = configuredKey?.trim() || undefined;
    if (trimmedKey?.includes('\n') || trimmedKey?.includes('\r')) {
      throw new SportScoreClientError(
        'invalid_configuration',
        'SPORTSCORE_API_KEY must be a valid single-line header value.'
      );
    }

    this.apiKey = trimmedKey;
    this.baseUrl = validateBaseUrl(
      options.baseUrl ?? process.env.SPORTSCORE_BASE_URL ?? SPORTSCORE_SOURCE_ORIGIN
    );
    this.fetchFn = options.fetchFn ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
    this.initialBackoffMs = options.initialBackoffMs ?? DEFAULT_INITIAL_BACKOFF_MS;
    this.maxBackoffMs = options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS;
    this.maxConcurrency = options.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY;
    this.responseCacheTtlMs = options.responseCacheTtlMs ?? DEFAULT_RESPONSE_CACHE_TTL_MS;
    this.responseCacheMaxEntries = options.responseCacheMaxEntries
      ?? DEFAULT_RESPONSE_CACHE_MAX_ENTRIES;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.sleep = options.sleep ?? defaultSleep;
    this.evidenceCache = options.evidenceCache;
    this.onRequestObservation = options.onRequestObservation;

    requirePositiveInteger(this.timeoutMs, 'SportScore timeoutMs');
    requireNonNegativeInteger(this.maxRetries, 'SportScore maxRetries');
    requirePositiveInteger(this.initialBackoffMs, 'SportScore initialBackoffMs');
    requirePositiveInteger(this.maxBackoffMs, 'SportScore maxBackoffMs');
    requirePositiveInteger(this.maxConcurrency, 'SportScore maxConcurrency');
    requireNonNegativeInteger(this.responseCacheTtlMs, 'SportScore responseCacheTtlMs');
    requirePositiveInteger(this.responseCacheMaxEntries, 'SportScore responseCacheMaxEntries');
    if (this.maxBackoffMs < this.initialBackoffMs) {
      throw new SportScoreClientError(
        'invalid_configuration',
        'SportScore maxBackoffMs must be greater than or equal to initialBackoffMs.'
      );
    }
  }

  getFixtures(request: SportScoreFixturesRequest): Promise<SportScoreFixturesResponse> {
    validateDate(request.date);
    validateSlug(request.competition, 'SportScore competition');
    const limit = request.limit ?? 200;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new SportScoreClientError(
        'invalid_request',
        'SportScore fixture limit must be an integer from 1 to 200.'
      );
    }

    const url = new URL('/api/v1/fixtures/', this.baseUrl);
    url.searchParams.set('sport', 'football');
    url.searchParams.set('date', request.date);
    url.searchParams.set('competition', request.competition);
    url.searchParams.set('limit', String(limit));

    return this.request({
      endpoint: 'fixtures',
      url,
      parse: parseSportScoreFixturesResponse
    });
  }

  getMatch(request: SportScoreMatchRequest): Promise<SportScoreMatchResponse> {
    validateSlug(request.slug, 'SportScore match');
    const url = new URL('/api/widget/match/', this.baseUrl);
    url.searchParams.set('sport', 'football');
    url.searchParams.set('slug', request.slug);
    url.searchParams.set('src', 'miraichi');

    return this.request({
      endpoint: 'match',
      url,
      parse: parseSportScoreMatchResponse
    });
  }

  private request<T>(descriptor: RequestDescriptor<T>): Promise<T> {
    this.assertApprovedUrl(descriptor.url);
    const cacheKey = descriptor.url.toString();
    const cached = this.responseCache.get(cacheKey) as ResponseCacheEntry<T> | undefined;
    if (cached && cached.expiresAt > this.now()) {
      return Promise.resolve(cached.payload);
    }
    if (cached) {
      this.responseCache.delete(cacheKey);
    }

    const current = this.inFlight.get(cacheKey) as Promise<T> | undefined;
    if (current) {
      return current;
    }

    const pending = this.fetchAndValidate(descriptor).then((payload) => {
      this.storeResponseCache(cacheKey, payload);
      return payload;
    });
    this.inFlight.set(cacheKey, pending);
    void pending.then(
      () => this.inFlight.delete(cacheKey),
      () => this.inFlight.delete(cacheKey)
    );
    return pending;
  }

  private async fetchAndValidate<T>(descriptor: RequestDescriptor<T>): Promise<T> {
    const requestedAt = new Date(this.now()).toISOString();

    for (let attempt = 1; attempt <= this.maxRetries + 1; attempt += 1) {
      let response: Response;
      let rawText: string | undefined;
      try {
        ({ response, rawText } = await this.fetchWithTimeout(descriptor.url));
      } catch (error) {
        const clientError = this.toTransportError(error);
        const shouldRetry = attempt <= this.maxRetries
          && (clientError.code === 'timeout' || clientError.code === 'network');
        this.observe({
          descriptor,
          requestedAt,
          attempt,
          outcome: shouldRetry ? 'retry' : 'failure',
          errorCode: clientError.code
        });
        if (!shouldRetry) {
          throw clientError;
        }
        await this.sleep(this.backoffDelay(attempt));
        continue;
      }

      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        const shouldRetryStatus = response.status === 429
          || (response.status >= 500 && response.status <= 599);
        const shouldRetry = shouldRetryStatus && attempt <= this.maxRetries;
        this.observe({
          descriptor,
          requestedAt,
          attempt,
          outcome: shouldRetry ? 'retry' : 'failure',
          statusCode: response.status,
          errorCode: 'http_status'
        });
        if (shouldRetry) {
          await this.sleep(this.backoffDelay(attempt, response.headers.get('retry-after')));
          continue;
        }
        throw new SportScoreClientError(
          'http_status',
          `SportScore request failed with HTTP ${response.status}.`,
          response.status
        );
      }

      let rawPayload: unknown;
      try {
        rawPayload = JSON.parse(rawText ?? '');
      } catch {
        this.observe({
          descriptor,
          requestedAt,
          attempt,
          outcome: 'failure',
          statusCode: response.status,
          errorCode: 'invalid_json'
        });
        throw new SportScoreClientError(
          'invalid_json',
          'SportScore returned a non-JSON response.'
        );
      }

      let payload: T;
      try {
        payload = descriptor.parse(rawPayload);
      } catch (error) {
        if (!(error instanceof SportScoreResponseContractError)) {
          throw error;
        }
        this.observe({
          descriptor,
          requestedAt,
          attempt,
          outcome: 'failure',
          statusCode: response.status,
          errorCode: 'invalid_payload'
        });
        throw new SportScoreClientError(
          'invalid_payload',
          'SportScore returned JSON outside the accepted response envelope.'
        );
      }

      const completedAt = new Date(this.now()).toISOString();
      const evidenceMetadata: SportScoreEvidenceRequestMetadata = {
        endpoint: descriptor.endpoint,
        path: descriptor.url.pathname,
        query: Object.fromEntries(descriptor.url.searchParams.entries()),
        requestedAt,
        completedAt,
        attempt,
        statusCode: response.status,
        authenticated: this.authenticationKeyFor(descriptor.url) !== undefined
      };
      this.observe({
        descriptor,
        requestedAt,
        attempt,
        outcome: 'success',
        statusCode: response.status,
        completedAt
      });
      if (this.evidenceCache) {
        try {
          const evidence = sanitizeEvidencePayload(descriptor.endpoint, rawPayload);
          await this.evidenceCache.write({
            request: evidenceMetadata,
            payload: redactSecret(evidence.payload, this.apiKey),
            ...(evidence.redactions === undefined ? {} : { redactions: evidence.redactions })
          });
        } catch {
          // Diagnostic evidence must not turn a valid provider response into data loss.
        }
      }
      return payload;
    }

    throw new SportScoreClientError('network', 'SportScore retry policy exhausted.');
  }

  private async fetchWithTimeout(url: URL): Promise<{
    response: Response;
    rawText: string | undefined;
  }> {
    this.assertApprovedUrl(url);
    return this.withConcurrency(async () => {
      const controller = new AbortController();
      let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_resolve, reject) => {
        timeoutHandle = setTimeout(() => {
          controller.abort();
          reject(new SportScoreClientError('timeout', 'SportScore request timed out.'));
        }, this.timeoutMs);
      });
      const headers = new Headers({ accept: 'application/json' });
      const authenticationKey = this.authenticationKeyFor(url);
      if (authenticationKey !== undefined) {
        headers.set('X-Api-Key', authenticationKey);
      }

      try {
        const transport = this.fetchFn(url, {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: controller.signal
        }).then(async (response) => ({
          response,
          rawText: response.ok ? await response.text() : undefined
        }));
        return await Promise.race([
          transport,
          timeout
        ]);
      } finally {
        if (timeoutHandle !== undefined) {
          clearTimeout(timeoutHandle);
        }
      }
    });
  }

  private async withConcurrency<T>(work: () => Promise<T>): Promise<T> {
    if (this.activeRequests >= this.maxConcurrency) {
      await new Promise<void>((resolve) => this.concurrencyWaiters.push(() => {
        this.activeRequests += 1;
        resolve();
      }));
    } else {
      this.activeRequests += 1;
    }

    try {
      return await work();
    } finally {
      this.activeRequests -= 1;
      this.concurrencyWaiters.shift()?.();
    }
  }

  private assertApprovedUrl(url: URL): void {
    if (url.protocol !== 'https:' || url.origin !== this.baseUrl.origin) {
      throw new SportScoreClientError(
        'invalid_configuration',
        'SportScore request target escaped the approved HTTPS origin.'
      );
    }
  }

  private authenticationKeyFor(url: URL): string | undefined {
    return url.pathname.startsWith('/api/v1/') ? this.apiKey : undefined;
  }

  private toTransportError(error: unknown): SportScoreClientError {
    if (error instanceof SportScoreClientError) {
      return error;
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return new SportScoreClientError('timeout', 'SportScore request timed out.');
    }
    return new SportScoreClientError('network', 'SportScore request failed at the network boundary.');
  }

  private backoffDelay(attempt: number, retryAfter: string | null = null): number {
    const exponential = Math.min(
      this.maxBackoffMs,
      this.initialBackoffMs * (2 ** (attempt - 1))
    );
    const jittered = Math.min(
      this.maxBackoffMs,
      Math.round(exponential + exponential * 0.25 * this.random())
    );
    const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0
      ? retryAfterSeconds * 1_000
      : 0;
    return Math.min(this.maxBackoffMs, Math.max(jittered, retryAfterMs));
  }

  private observe(input: {
    descriptor: RequestDescriptor<unknown>;
    requestedAt: string;
    attempt: number;
    outcome: SportScoreRequestObservation['outcome'];
    completedAt?: string;
    statusCode?: number;
    errorCode?: SportScoreClientErrorCode;
  }): void {
    if (!this.onRequestObservation) {
      return;
    }

    const observation: SportScoreRequestObservation = {
      endpoint: input.descriptor.endpoint,
      path: input.descriptor.url.pathname,
      query: Object.fromEntries(input.descriptor.url.searchParams.entries()),
      requestedAt: input.requestedAt,
      completedAt: input.completedAt ?? new Date(this.now()).toISOString(),
      attempt: input.attempt,
      authenticated: this.authenticationKeyFor(input.descriptor.url) !== undefined,
      outcome: input.outcome,
      ...(input.statusCode === undefined ? {} : { statusCode: input.statusCode }),
      ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode })
    };

    try {
      this.onRequestObservation(observation);
    } catch {
      // Observability callbacks must not alter source behavior.
    }
  }

  private storeResponseCache<T>(cacheKey: string, payload: T): void {
    if (this.responseCacheTtlMs === 0) {
      return;
    }

    this.responseCache.delete(cacheKey);
    this.responseCache.set(cacheKey, {
      payload,
      expiresAt: this.now() + this.responseCacheTtlMs
    });
    while (this.responseCache.size > this.responseCacheMaxEntries) {
      const oldestKey = this.responseCache.keys().next().value as string | undefined;
      if (oldestKey === undefined) {
        break;
      }
      this.responseCache.delete(oldestKey);
    }
  }
}
