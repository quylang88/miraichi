import {
  FOTMOB_DATA_ORIGIN,
  FotMobAccessBlockedError,
  type FotMobRawMatch
} from './fotmob-season-client.js';

export interface FotMobDailyRequest {
  date: string;
  timeZone: string;
  ownerCountryCode: string;
  etag?: string;
}

export interface FotMobDailyLeague {
  id?: number | string;
  name?: string;
  matches: FotMobRawMatch[];
}

export interface FotMobDailyPayload {
  date: string;
  leagues: FotMobDailyLeague[];
}

export type FotMobDailyResponse =
  | { status: 'modified'; etag?: string; payload: FotMobDailyPayload; rawText: string }
  | { status: 'not_modified'; etag?: string };

export interface FotMobDailyClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class FotMobDailyClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: FotMobDailyClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 3_000_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error('FotMob daily timeoutMs must be a positive integer.');
    }
    if (!Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1) {
      throw new Error('FotMob daily maxResponseBytes must be a positive integer.');
    }
  }

  async getDailyMatches(request: FotMobDailyRequest): Promise<FotMobDailyResponse> {
    assertRequest(request);
    const query = new URLSearchParams({
      date: request.date.replaceAll('-', ''),
      timezone: request.timeZone,
      ccode3: request.ownerCountryCode
    });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.etag) headers['If-None-Match'] = request.etag;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('FotMob daily request timed out.'));
        }, this.timeoutMs);
      });
      return await Promise.race([
        this.requestAndRead({
          url: `${FOTMOB_DATA_ORIGIN}/matches?${query.toString()}`,
          headers,
          signal: controller.signal,
          ...(request.etag === undefined ? {} : { requestEtag: request.etag })
        }),
        timeout
      ]);
    } catch (error) {
      if (error instanceof FotMobAccessBlockedError) throw error;
      if (error instanceof Error && error.message === 'FotMob daily request timed out.') throw error;
      throw new Error(`FotMob daily network request failed: ${safeMessage(error)}`, { cause: error });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async requestAndRead(options: {
    url: string;
    headers: Record<string, string>;
    signal: AbortSignal;
    requestEtag?: string;
  }): Promise<FotMobDailyResponse> {
    const response = await this.fetchFn(options.url, {
      method: 'GET',
      headers: options.headers,
      signal: options.signal
    });
    const responseEtag = response.headers.get('etag') ?? options.requestEtag;
    if (response.status === 304) {
      return {
        status: 'not_modified',
        ...(responseEtag ? { etag: responseEtag } : {})
      };
    }
    if (response.status === 403 || response.status === 429) {
      throw new FotMobAccessBlockedError(response.status);
    }
    if (!response.ok) {
      throw new Error(`FotMob daily HTTP ${response.status}: ${response.statusText}`);
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > this.maxResponseBytes) {
      throw new Error('FotMob daily response exceeded the configured size limit.');
    }
    const rawText = await response.text();
    if (Buffer.byteLength(rawText, 'utf8') > this.maxResponseBytes) {
      throw new Error('FotMob daily response exceeded the configured size limit.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`FotMob daily response is not valid JSON: ${safeMessage(error)}`, {
        cause: error
      });
    }
    const payload = validatePayload(parsed);
    return {
      status: 'modified',
      ...(responseEtag ? { etag: responseEtag } : {}),
      payload,
      rawText
    };
  }
}

function assertRequest(request: FotMobDailyRequest): void {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(request.date)) {
    throw new Error('FotMob daily date must use YYYY-MM-DD.');
  }
  const parsedDate = new Date(`${request.date}T00:00:00.000Z`);
  if (Number.isNaN(parsedDate.valueOf()) || parsedDate.toISOString().slice(0, 10) !== request.date) {
    throw new Error('FotMob daily date must be a real calendar date.');
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: request.timeZone }).format(new Date(0));
  } catch {
    throw new Error('FotMob daily timeZone must be a valid IANA time zone.');
  }
  if (!/^[A-Z]{3}$/u.test(request.ownerCountryCode)) {
    throw new Error('FotMob daily ownerCountryCode must be three uppercase letters.');
  }
  if (request.etag !== undefined && (!request.etag.trim() || /[\r\n]/u.test(request.etag))) {
    throw new Error('FotMob daily ETag is unsafe.');
  }
}

function validatePayload(input: unknown): FotMobDailyPayload {
  if (!isRecord(input)
    || typeof input.date !== 'string'
    || !input.date.trim()
    || !Array.isArray(input.leagues)
    || input.leagues.some((league) => !isRecord(league)
      || !Array.isArray(league.matches)
      || league.matches.some((match) => !isRecord(match)))) {
    throw new Error('Invalid FotMob daily payload.');
  }
  return input as unknown as FotMobDailyPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
