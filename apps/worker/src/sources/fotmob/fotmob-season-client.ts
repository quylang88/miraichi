export const FOTMOB_DATA_ORIGIN = 'https://www.fotmob.com/api/data' as const;

export interface FotMobSeasonRequest {
  externalCompetitionId: number;
  externalCountryCode: string;
  providerSeason: string;
  etag?: string;
}

export interface FotMobRawTeam {
  id?: number | string;
  name?: string;
  score?: number;
}

export interface FotMobRawMatchStatus {
  utcTime?: string;
  finished?: boolean;
  started?: boolean;
  cancelled?: boolean;
  awarded?: boolean;
  scoreStr?: string;
  reason?: string | {
    short?: string;
    shortKey?: string;
    long?: string;
    longKey?: string;
  };
}

export interface FotMobRawMatch {
  id?: number | string;
  round?: number | string;
  home?: FotMobRawTeam;
  away?: FotMobRawTeam;
  status?: FotMobRawMatchStatus;
  venue?: string;
}

export interface FotMobSeasonPayload {
  details: {
    id?: number;
    name?: string;
    selectedSeason: string;
  };
  fixtures: {
    allMatches: FotMobRawMatch[];
  };
}

export interface FotMobModifiedSeasonResponse {
  status: 'modified';
  etag?: string;
  payload: FotMobSeasonPayload;
  rawText: string;
}

export interface FotMobNotModifiedSeasonResponse {
  status: 'not_modified';
  etag?: string;
}

export type FotMobSeasonResponse =
  | FotMobModifiedSeasonResponse
  | FotMobNotModifiedSeasonResponse;

export interface FotMobSeasonClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class FotMobAccessBlockedError extends Error {
  readonly status: 403 | 429;

  constructor(status: 403 | 429) {
    super(`FotMob access blocked with HTTP ${status}; abort the provider run.`);
    this.name = 'FotMobAccessBlockedError';
    this.status = status;
  }
}

export class FotMobSeasonClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: FotMobSeasonClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 20_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 3_000_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error('FotMob timeoutMs must be a positive integer.');
    }
    if (!Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1) {
      throw new Error('FotMob maxResponseBytes must be a positive integer.');
    }
  }

  async getSeasonMatches(request: FotMobSeasonRequest): Promise<FotMobSeasonResponse> {
    assertRequest(request);
    const query = new URLSearchParams({
      id: String(request.externalCompetitionId),
      ccode3: request.externalCountryCode,
      season: request.providerSeason
    });
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (request.etag) headers['If-None-Match'] = request.etag;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('FotMob request timed out.'));
        }, this.timeoutMs);
      });
      return await Promise.race([
        this.requestAndRead({
          url: `${FOTMOB_DATA_ORIGIN}/leagues?${query.toString()}`,
          headers,
          signal: controller.signal,
          ...(request.etag === undefined ? {} : { requestEtag: request.etag })
        }),
        timeout
      ]);
    } catch (error) {
      if (error instanceof FotMobAccessBlockedError) throw error;
      if (error instanceof Error && error.message === 'FotMob request timed out.') throw error;
      throw new Error(`FotMob network request failed: ${safeMessage(error)}`, { cause: error });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async requestAndRead(options: {
    url: string;
    headers: Record<string, string>;
    signal: AbortSignal;
    requestEtag?: string;
  }): Promise<FotMobSeasonResponse> {
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
      throw new Error(`FotMob HTTP ${response.status}: ${response.statusText}`);
    }
    const contentLength = Number(response.headers.get('content-length'));
    if (Number.isFinite(contentLength) && contentLength > this.maxResponseBytes) {
      throw new Error('FotMob response exceeded the configured size limit.');
    }
    const rawText = await response.text();
    if (Buffer.byteLength(rawText, 'utf8') > this.maxResponseBytes) {
      throw new Error('FotMob response exceeded the configured size limit.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`FotMob response is not valid JSON: ${safeMessage(error)}`, { cause: error });
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

function assertRequest(request: FotMobSeasonRequest): void {
  if (!Number.isSafeInteger(request.externalCompetitionId) || request.externalCompetitionId < 1) {
    throw new Error('FotMob externalCompetitionId must be a positive integer.');
  }
  if (!/^[A-Z]{3}$/u.test(request.externalCountryCode)) {
    throw new Error('FotMob externalCountryCode must be a three-letter uppercase code.');
  }
  if (!/^\d{4}(?:\/\d{4})?(?: - (?:Apertura|Clausura))?$/u.test(request.providerSeason)) {
    throw new Error('FotMob providerSeason is unsafe.');
  }
  if (request.etag !== undefined && (!request.etag.trim() || /[\r\n]/u.test(request.etag))) {
    throw new Error('FotMob ETag is unsafe.');
  }
}

function validatePayload(input: unknown): FotMobSeasonPayload {
  if (!isRecord(input)
    || !isRecord(input.details)
    || typeof input.details.selectedSeason !== 'string'
    || !input.details.selectedSeason.trim()
    || !isRecord(input.fixtures)
    || !Array.isArray(input.fixtures.allMatches)
    || input.fixtures.allMatches.some((item) => !isRecord(item))) {
    throw new Error('Invalid FotMob season payload.');
  }
  return input as unknown as FotMobSeasonPayload;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
