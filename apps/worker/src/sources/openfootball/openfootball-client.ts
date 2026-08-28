export const OPENFOOTBALL_SOURCE_ORIGIN =
  'https://raw.githubusercontent.com/openfootball/football.json/master' as const;

export interface OpenFootballRawScore {
  ht?: [number, number];
  ft?: [number, number];
}

export interface OpenFootballRawMatch {
  round?: string;
  date: string;
  time?: string;
  team1: string;
  team2: string;
  score?: OpenFootballRawScore;
}

export interface OpenFootballSeasonPayload {
  name: string;
  matches: OpenFootballRawMatch[];
}

export interface OpenFootballSeasonRequest {
  season: string;
  file: string;
  etag?: string;
}

export interface OpenFootballModifiedSeasonResponse {
  status: 'modified';
  season: string;
  file: string;
  etag?: string;
  payload: OpenFootballSeasonPayload;
  rawText: string;
}

export interface OpenFootballNotModifiedSeasonResponse {
  status: 'not_modified';
  season: string;
  file: string;
  etag?: string;
}

export type OpenFootballSeasonResponse =
  | OpenFootballModifiedSeasonResponse
  | OpenFootballNotModifiedSeasonResponse;

export interface OpenFootballClientOptions {
  fetchFn?: typeof fetch;
  timeoutMs?: number;
  maxResponseBytes?: number;
}

export class OpenFootballClient {
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;
  private readonly maxResponseBytes: number;

  constructor(options: OpenFootballClientOptions = {}) {
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.maxResponseBytes = options.maxResponseBytes ?? 2_000_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 1) {
      throw new Error('OpenFootball timeoutMs must be a positive integer.');
    }
    if (!Number.isInteger(this.maxResponseBytes) || this.maxResponseBytes < 1) {
      throw new Error('OpenFootball maxResponseBytes must be a positive integer.');
    }
  }

  async getSeasonMatches(request: OpenFootballSeasonRequest): Promise<OpenFootballSeasonResponse> {
    const season = request.season.trim();
    const file = request.file.trim();
    if (!/^\d{4}(?:-\d{2})?$/u.test(season)) {
      throw new Error('OpenFootball season must use YYYY or YYYY-YY.');
    }
    if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.json$/u.test(file)) {
      throw new Error('OpenFootball file must be one safe JSON filename.');
    }

    const url = `${OPENFOOTBALL_SOURCE_ORIGIN}/${season}/${file}`;
    const headers: Record<string, string> = {
      Accept: 'application/json, text/plain, */*'
    };
    if (request.etag) {
      headers['If-None-Match'] = request.etag;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          reject(new Error('OpenFootball request timed out.'));
        }, this.timeoutMs);
      });
      return await Promise.race([
        this.requestAndRead({
          url,
          headers,
          controller,
          season,
          file,
          ...(request.etag === undefined ? {} : { requestEtag: request.etag })
        }),
        timeout
      ]);
    } catch (error) {
      if (error instanceof Error && error.message === 'OpenFootball request timed out.') {
        throw error;
      }
      throw new Error(`OpenFootball network request failed: ${safeMessage(error)}`, {
        cause: error
      });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private async requestAndRead(options: {
    url: string;
    headers: Record<string, string>;
    controller: AbortController;
    season: string;
    file: string;
    requestEtag?: string;
  }): Promise<OpenFootballSeasonResponse> {
    const response = await this.fetchFn(options.url, {
      method: 'GET',
      headers: options.headers,
      signal: options.controller.signal
    });
    const responseEtag = response.headers.get('etag') ?? options.requestEtag;
    if (response.status === 304) {
      return {
        status: 'not_modified',
        season: options.season,
        file: options.file,
        ...(responseEtag ? { etag: responseEtag } : {})
      };
    }
    if (!response.ok) {
      throw new Error(`OpenFootball HTTP ${response.status}: ${response.statusText}`);
    }
    const rawText = await response.text();
    if (Buffer.byteLength(rawText, 'utf8') > this.maxResponseBytes) {
      throw new Error('OpenFootball response exceeded the configured size limit.');
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch (error) {
      throw new Error(`OpenFootball response is not valid JSON: ${safeMessage(error)}`, {
        cause: error
      });
    }

    const payload = validatePayload(parsed);
    return {
      status: 'modified',
      season: options.season,
      file: options.file,
      ...(responseEtag ? { etag: responseEtag } : {}),
      payload,
      rawText
    };
  }
}

function validatePayload(input: unknown): OpenFootballSeasonPayload {
  if (
    typeof input !== 'object'
    || input === null
    || !('name' in input)
    || typeof (input as { name: unknown }).name !== 'string'
    || !('matches' in input)
    || !Array.isArray((input as { matches: unknown }).matches)
  ) {
    throw new Error('Invalid OpenFootball season payload.');
  }

  const matches: OpenFootballRawMatch[] = [];
  for (const [index, item] of (input as { matches: unknown[] }).matches.entries()) {
    if (
      typeof item !== 'object'
      || item === null
      || typeof (item as { date?: unknown }).date !== 'string'
      || typeof (item as { team1?: unknown }).team1 !== 'string'
      || typeof (item as { team2?: unknown }).team2 !== 'string'
    ) {
      throw new Error(`Invalid OpenFootball season payload at matches[${index}].`);
    }
    matches.push(item as OpenFootballRawMatch);
  }

  return {
    name: (input as { name: string }).name,
    matches
  };
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
