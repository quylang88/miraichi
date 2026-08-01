import {
  OPENFOOTBALL_SOURCE_REGISTRY,
  buildOpenFootballRawUrl,
  type OpenFootballCompetitionSource
} from '@miraichi/config';

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1_500] as const;
const MAX_RETRY_AFTER_MS = 60_000;
const USER_AGENT = 'Miraichi-OpenFootball-Worker/1.0';
const SOURCE_FIELDS = [
  'entryId',
  'sourceId',
  'origin',
  'competitionId',
  'competitionName',
  'expectedCompetitionHeader',
  'competitionType',
  'repository',
  'ref',
  'filePath',
  'season',
  'sourceTimezone',
  'refreshIntervalMinutes',
  'maxPayloadBytes',
  'minimumExpectedMatches',
  'maximumMissingRatio',
  'enabled'
] as const satisfies readonly (keyof OpenFootballCompetitionSource)[];

export type OpenFootballFetchResult =
  | {
      status: 'changed';
      fetchedAt: string;
      urlPath: string;
      text: string;
      etag?: string;
      lastModified?: string;
      contentType: string;
      byteCount: number;
    }
  | {
      status: 'not_modified';
      fetchedAt: string;
      urlPath: string;
      etag?: string;
      lastModified?: string;
    };

export interface OpenFootballClientDependencies {
  fetchFn: typeof fetch;
  sleep: (milliseconds: number) => Promise<void>;
  now: () => Date;
}

export interface OpenFootballFetchInput {
  source: OpenFootballCompetitionSource;
  conditional?: {
    etag?: string;
    lastModified?: string;
  };
}

export type OpenFootballFetchErrorCode =
  | 'network_failed'
  | 'http_server_error'
  | 'rate_limited'
  | 'retry_after_too_long'
  | 'source_unavailable'
  | 'invalid_content_type'
  | 'payload_too_large'
  | 'invalid_utf8'
  | 'redirect_outside_allowlist';

export class OpenFootballFetchError extends Error {
  readonly code: OpenFootballFetchErrorCode;
  readonly httpStatus: number | undefined;
  readonly attemptCount: number;

  constructor(input: {
    code: OpenFootballFetchErrorCode;
    message: string;
    httpStatus?: number;
    attemptCount: number;
  }) {
    super(input.message);
    this.name = 'OpenFootballFetchError';
    this.code = input.code;
    this.httpStatus = input.httpStatus;
    this.attemptCount = input.attemptCount;
  }
}

function error(
  code: OpenFootballFetchErrorCode,
  message: string,
  attemptCount: number,
  httpStatus?: number
): OpenFootballFetchError {
  return new OpenFootballFetchError({
    code,
    message,
    attemptCount,
    ...(httpStatus === undefined ? {} : { httpStatus })
  });
}

function getUrlPath(url: string): string {
  return new URL(url).pathname;
}

function isTrackedSource(source: OpenFootballCompetitionSource): boolean {
  return OPENFOOTBALL_SOURCE_REGISTRY.filter((entry) =>
    SOURCE_FIELDS.every((field) => entry[field] === source[field])
  ).length === 1;
}

function isPlainText(contentType: string | null): contentType is string {
  return contentType !== null && /^text\/plain(?:\s*;\s*charset\s*=\s*(?:"[^"]+"|[^\s;]+))?\s*$/i.test(contentType);
}

function isExpectedResponseUrl(responseUrl: string, expectedUrl: string): boolean {
  if (responseUrl === '') {
    return true;
  }

  try {
    return new URL(responseUrl).toString() === new URL(expectedUrl).toString();
  } catch {
    return false;
  }
}

function responseValidators(response: Response): { etag?: string; lastModified?: string } {
  const etag = response.headers.get('etag') ?? undefined;
  const lastModified = response.headers.get('last-modified') ?? undefined;

  return {
    ...(etag === undefined ? {} : { etag }),
    ...(lastModified === undefined ? {} : { lastModified })
  };
}

function retryAfterMilliseconds(value: string | null, now: Date): number | 'too_long' | null {
  if (value === null) {
    return null;
  }

  const seconds = /^\d+$/.test(value) ? Number(value) : Number.NaN;
  const milliseconds = Number.isFinite(seconds)
    ? seconds * 1_000
    : (() => {
        const retryAt = Date.parse(value);
        return Number.isNaN(retryAt) ? Number.NaN : Math.max(0, retryAt - now.getTime());
      })();

  if (!Number.isFinite(milliseconds)) {
    return null;
  }
  if (milliseconds > MAX_RETRY_AFTER_MS) {
    return 'too_long';
  }
  return milliseconds;
}

async function readBoundedBody(response: Response, maxPayloadBytes: number, attemptCount: number): Promise<Uint8Array> {
  if (response.body === null) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      totalBytes += value.byteLength;
      if (totalBytes > maxPayloadBytes) {
        await reader.cancel();
        throw error('payload_too_large', 'OpenFootball response body exceeds the configured payload limit', attemptCount);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decodeUtf8(bytes: Uint8Array, attemptCount: number): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw error('invalid_utf8', 'OpenFootball response is not valid UTF-8', attemptCount);
  }
}

function requestFor(input: OpenFootballFetchInput, url: string): Request {
  const headers = new Headers({ 'user-agent': USER_AGENT });
  if (input.conditional?.etag !== undefined) {
    headers.set('if-none-match', input.conditional.etag);
  }
  if (input.conditional?.lastModified !== undefined) {
    headers.set('if-modified-since', input.conditional.lastModified);
  }

  return new Request(url, {
    method: 'GET',
    headers,
    credentials: 'omit',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
}

export async function fetchOpenFootballSource(
  input: OpenFootballFetchInput,
  dependencies: OpenFootballClientDependencies
): Promise<OpenFootballFetchResult> {
  if (!isTrackedSource(input.source)) {
    throw error('source_unavailable', 'OpenFootball source is not an exact tracked allowlist entry', 0);
  }

  const url = buildOpenFootballRawUrl(input.source);
  const urlPath = getUrlPath(url);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    let response: Response;
    try {
      response = await dependencies.fetchFn(requestFor(input, url));
    } catch {
      if (attempt === MAX_ATTEMPTS) {
        throw error('network_failed', 'OpenFootball request failed', attempt);
      }
      await dependencies.sleep(RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }

    if (!isExpectedResponseUrl(response.url, url)) {
      throw error('redirect_outside_allowlist', 'OpenFootball response URL is outside the allowlist', attempt, response.status);
    }

    const fetchedAt = dependencies.now().toISOString();
    const validators = responseValidators(response);
    if (response.status === 304) {
      return {
        status: 'not_modified',
        fetchedAt,
        urlPath,
        ...validators
      };
    }

    if (response.status === 429) {
      const delay = retryAfterMilliseconds(response.headers.get('retry-after'), dependencies.now());
      if (delay === 'too_long') {
        throw error('retry_after_too_long', 'OpenFootball Retry-After exceeds the sixty-second limit', attempt, response.status);
      }
      if (attempt === MAX_ATTEMPTS) {
        throw error('rate_limited', 'OpenFootball source is rate limited', attempt, response.status);
      }
      await dependencies.sleep(delay ?? RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }

    if (response.status >= 500 && response.status <= 599) {
      if (attempt === MAX_ATTEMPTS) {
        throw error('http_server_error', 'OpenFootball source returned a server error', attempt, response.status);
      }
      await dependencies.sleep(RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }

    if (!response.ok) {
      throw error('source_unavailable', 'OpenFootball source is unavailable', attempt, response.status);
    }

    const contentType = response.headers.get('content-type');
    if (!isPlainText(contentType)) {
      throw error('invalid_content_type', 'OpenFootball source did not return text/plain', attempt, response.status);
    }

    const contentLength = response.headers.get('content-length');
    if (contentLength !== null && /^\d+$/.test(contentLength) && Number(contentLength) > input.source.maxPayloadBytes) {
      throw error('payload_too_large', 'OpenFootball response exceeds the configured payload limit', attempt, response.status);
    }

    let bytes: Uint8Array;
    try {
      bytes = await readBoundedBody(response, input.source.maxPayloadBytes, attempt);
    } catch (cause) {
      if (cause instanceof OpenFootballFetchError) {
        throw cause;
      }
      if (attempt === MAX_ATTEMPTS) {
        throw error('network_failed', 'OpenFootball response body could not be read', attempt);
      }
      await dependencies.sleep(RETRY_DELAYS_MS[attempt - 1]!);
      continue;
    }
    const text = decodeUtf8(bytes, attempt);
    return {
      status: 'changed',
      fetchedAt,
      urlPath,
      text,
      contentType,
      byteCount: bytes.byteLength,
      ...validators
    };
  }

  throw error('network_failed', 'OpenFootball request failed', MAX_ATTEMPTS);
}
