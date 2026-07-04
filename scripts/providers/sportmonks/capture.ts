import type {
  ProviderCaptureManifestEntry,
  RawProviderPayloadEnvelope
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import type { SportmonksClientResult } from './client.js';
import type { SportmonksEndpointEntry } from './endpoint-catalog.js';

export interface SportmonksCaptureClient {
  get(urlPath: string, query?: Record<string, string>): Promise<SportmonksClientResult>;
}

export interface SportmonksRawCaptureOptions {
  captureRoot: string;
  catalog: SportmonksEndpointEntry[];
  client: SportmonksCaptureClient;
  now?: () => string;
  log?: (message: string) => void;
  maxPagesPerEndpoint?: number;
  allowLiveEndpoints?: boolean;
  initialRequestsByEndpointKey?: Record<string, SportmonksEndpointInitialRequest>;
}

export interface SportmonksEndpointInitialRequest {
  query: Record<string, string>;
  page: number;
}

export interface SportmonksRawCaptureResult {
  captured: number;
  skipped: number;
  unavailable: number;
  failed: number;
}

const DEFAULT_MAX_PAGES_PER_ENDPOINT = 10_000;

export async function runSportmonksRawCapture(
  options: SportmonksRawCaptureOptions
): Promise<SportmonksRawCaptureResult> {
  const result: SportmonksRawCaptureResult = {
    captured: 0,
    skipped: 0,
    unavailable: 0,
    failed: 0
  };
  const now = options.now ?? (() => new Date().toISOString());
  const maxPagesPerEndpoint = options.maxPagesPerEndpoint ?? DEFAULT_MAX_PAGES_PER_ENDPOINT;
  const allowLiveEndpoints = options.allowLiveEndpoints ?? false;

  for (const endpoint of options.catalog) {
    if (endpoint.isLive === true && !allowLiveEndpoints) {
      await appendSkippedManifest(options.captureRoot, endpoint, 'live_endpoint', 'Live/in-play endpoint is excluded from Phase 9 capture');
      result.skipped += 1;
      continue;
    }

    if (endpoint.requiresId === true) {
      await appendSkippedManifest(options.captureRoot, endpoint, 'requires_id', 'Endpoint requires per-record ID enrichment');
      result.skipped += 1;
      continue;
    }

    const endpointResult = await captureEndpointPages({
      captureRoot: options.captureRoot,
      client: options.client,
      endpoint,
      initialRequest: options.initialRequestsByEndpointKey?.[endpoint.endpointKey],
      now,
      maxPagesPerEndpoint,
      log: options.log
    });

    result.captured += endpointResult.captured;
    result.skipped += endpointResult.skipped;
    result.unavailable += endpointResult.unavailable;
    result.failed += endpointResult.failed;

    if (endpointResult.rateLimited) {
      break;
    }
  }

  return result;
}

async function captureEndpointPages(input: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  endpoint: SportmonksEndpointEntry;
  initialRequest: SportmonksEndpointInitialRequest | undefined;
  now: () => string;
  maxPagesPerEndpoint: number;
  log: ((message: string) => void) | undefined;
}): Promise<SportmonksRawCaptureResult & { rateLimited: boolean }> {
  const result = {
    captured: 0,
    skipped: 0,
    unavailable: 0,
    failed: 0,
    rateLimited: false
  };

  const defaultQuery = input.endpoint.defaultQuery ?? {};
  const existingProgress = input.initialRequest === undefined
    ? await readEndpointCaptureProgress(input.captureRoot, input.endpoint.endpointKey, defaultQuery)
    : undefined;

  if (existingProgress?.completed === true) {
    input.log?.(`sportmonks:capture ${input.endpoint.endpointKey} skipped; already complete`);
    result.skipped += 1;
    return result;
  }

  const startRequest = input.initialRequest ?? existingProgress?.nextRequest;
  let query: Record<string, string> = startRequest?.query ?? withPageQuery(defaultQuery, 1);
  let page = startRequest?.page ?? 1;
  for (let capturedPages = 0; capturedPages < input.maxPagesPerEndpoint; capturedPages += 1) {
    input.log?.(`sportmonks:capture ${input.endpoint.endpointKey} page=${page}`);

    const response = await input.client.get(input.endpoint.urlPath, query);
    if (!response.ok) {
      if (response.status === 'unavailable') {
        await appendProviderManifestEntry(input.captureRoot, 'sportmonks', {
          provider: 'sportmonks',
          endpointKey: input.endpoint.endpointKey,
          urlPath: input.endpoint.urlPath,
          query,
          status: 'unavailable',
          page,
          errorCode: String(response.statusCode),
          errorMessage: response.message
        });
        result.unavailable += 1;
        return result;
      }

      await appendProviderManifestEntry(input.captureRoot, 'sportmonks', {
        provider: 'sportmonks',
        endpointKey: input.endpoint.endpointKey,
        urlPath: input.endpoint.urlPath,
        query,
        status: 'failed',
        page,
        errorCode: response.status,
        errorMessage: response.message
      });
      result.failed += 1;
      result.rateLimited = response.status === 'rate_limited';
      return result;
    }

    const fetchedAt = input.now();
    const payloadHash = createPayloadHash(response.body);
    const envelope: RawProviderPayloadEnvelope = {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: input.endpoint.endpointKey,
      urlPath: input.endpoint.urlPath,
      query,
      fetchedAt,
      payloadHash,
      rateLimit: response.rateLimit,
      payload: response.body
    };
    await writeRawProviderPayload(input.captureRoot, envelope);

    const hasMore = hasMorePages(response.body);
    const manifestEntry = createCapturedManifestEntry({
      endpoint: input.endpoint,
      query,
      fetchedAt,
      payloadHash,
      page,
      hasMore,
      body: response.body
    });
    await appendProviderManifestEntry(input.captureRoot, 'sportmonks', manifestEntry);
    result.captured += 1;

    if (!hasMore) {
      return result;
    }

    const nextCursorQuery = readNextCursorQuery(response.body);
    query = nextCursorQuery === undefined ? withPageQuery(defaultQuery, page + 1) : { ...defaultQuery, ...nextCursorQuery };
    page += 1;
  }

  input.log?.(`sportmonks:capture ${input.endpoint.endpointKey} stopped at page limit (${input.maxPagesPerEndpoint} pages)`);
  return result;
}

interface EndpointCaptureProgress {
  completed: boolean;
  nextRequest?: SportmonksEndpointInitialRequest;
}

async function readEndpointCaptureProgress(
  captureRoot: string,
  endpointKey: string,
  defaultQuery: Record<string, string>
): Promise<EndpointCaptureProgress> {
  const entries = await readCapturedManifestEntries(captureRoot, endpointKey, defaultQuery);
  if (entries.length === 0) {
    return { completed: false };
  }

  if (entries.some((entry) => entry.hasMore === false)) {
    return { completed: true };
  }

  const latest = entries
    .filter((entry) => entry.page !== undefined)
    .sort((left, right) => (right.page ?? 0) - (left.page ?? 0))[0];
  if (latest === undefined || latest.page === undefined) {
    return { completed: false };
  }

  return {
    completed: false,
    nextRequest: {
      query: await readNextQueryFromRawPayload(captureRoot, latest, defaultQuery) ?? withPageQuery(defaultQuery, latest.page + 1),
      page: latest.page + 1
    }
  };
}

async function readCapturedManifestEntries(
  captureRoot: string,
  endpointKey: string,
  defaultQuery: Record<string, string>
): Promise<ProviderCaptureManifestEntry[]> {
  const manifestPath = join(captureRoot, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
  let content: string;
  try {
    content = await readFile(manifestPath, 'utf8');
  } catch {
    return [];
  }

  const entries: ProviderCaptureManifestEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(parsed)) {
      continue;
    }
    if (parsed.provider !== 'sportmonks' || parsed.endpointKey !== endpointKey || parsed.status !== 'captured') {
      continue;
    }
    if (!queryContainsDefaultValues(isRecord(parsed.query) ? parsed.query : {}, defaultQuery)) {
      continue;
    }
    entries.push(parsed as unknown as ProviderCaptureManifestEntry);
  }
  return entries;
}

async function readNextQueryFromRawPayload(
  captureRoot: string,
  entry: ProviderCaptureManifestEntry,
  defaultQuery: Record<string, string>
): Promise<Record<string, string> | undefined> {
  if (entry.payloadHash === undefined || entry.fetchedAt === undefined) {
    return undefined;
  }

  const rawPath = join(
    captureRoot,
    'providers',
    'sportmonks',
    'raw',
    entry.endpointKey,
    entry.fetchedAt.slice(0, 10),
    `${entry.payloadHash}.json`
  );

  let content: string;
  try {
    content = await readFile(rawPath, 'utf8');
  } catch {
    return undefined;
  }

  try {
    const envelope = JSON.parse(content) as RawProviderPayloadEnvelope;
    const nextCursorQuery = readNextCursorQuery(envelope.payload);
    return nextCursorQuery === undefined ? undefined : { ...defaultQuery, ...nextCursorQuery };
  } catch {
    return undefined;
  }
}

async function appendSkippedManifest(
  captureRoot: string,
  endpoint: SportmonksEndpointEntry,
  errorCode: string,
  errorMessage: string
): Promise<void> {
  await appendProviderManifestEntry(captureRoot, 'sportmonks', {
    provider: 'sportmonks',
    endpointKey: endpoint.endpointKey,
    urlPath: endpoint.urlPath,
    query: {},
    status: 'skipped',
    errorCode,
    errorMessage
  });
}

function createCapturedManifestEntry(input: {
  endpoint: SportmonksEndpointEntry;
  query: Record<string, string>;
  fetchedAt: string;
  payloadHash: string;
  page: number;
  hasMore: boolean;
  body: unknown;
}): ProviderCaptureManifestEntry {
  const entry: ProviderCaptureManifestEntry = {
    provider: 'sportmonks',
    endpointKey: input.endpoint.endpointKey,
    urlPath: input.endpoint.urlPath,
    query: input.query,
    status: 'captured',
    page: input.page,
    hasMore: input.hasMore,
    payloadHash: input.payloadHash,
    fetchedAt: input.fetchedAt
  };
  const recordCount = countDataRecords(input.body);
  if (recordCount !== undefined) {
    entry.recordCount = recordCount;
  }
  return entry;
}

function withPageQuery(query: Record<string, string>, page: number): Record<string, string> {
  return { ...query, page: String(page) };
}

function queryContainsDefaultValues(query: Record<string, unknown>, defaultQuery: Record<string, string>): boolean {
  for (const [key, expectedValue] of Object.entries(defaultQuery)) {
    if (query[key] !== expectedValue) {
      return false;
    }
  }
  return true;
}

function countDataRecords(body: unknown): number | undefined {
  if (!isRecord(body) || !Array.isArray(body.data)) {
    return undefined;
  }
  return body.data.length;
}

function hasMorePages(body: unknown): boolean {
  return readNestedBoolean(body, ['pagination', 'has_more'])
    ?? readNestedBoolean(body, ['pagination', 'hasMore'])
    ?? readNestedBoolean(body, ['meta', 'pagination', 'has_more'])
    ?? readNestedBoolean(body, ['meta', 'pagination', 'hasMore'])
    ?? false;
}

function readNextCursorQuery(body: unknown): Record<string, string> | undefined {
  const nextCursor = readNestedString(body, ['pagination', 'next_cursor'])
    ?? readNestedString(body, ['pagination', 'nextCursor'])
    ?? readNestedString(body, ['meta', 'pagination', 'next_cursor'])
    ?? readNestedString(body, ['meta', 'pagination', 'nextCursor']);
  if (nextCursor === undefined) {
    return undefined;
  }

  const cursor = extractCursor(nextCursor);
  return cursor === undefined ? undefined : { cursor };
}

function extractCursor(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed === '') {
    return undefined;
  }

  try {
    const url = new URL(trimmed, 'https://api.sportmonks.com');
    const cursor = url.searchParams.get('cursor');
    if (cursor !== null && cursor.trim() !== '') {
      return cursor;
    }
  } catch {
    // Fall back to treating next_cursor as a raw cursor token.
  }

  return trimmed;
}

function readNestedString(value: unknown, path: string[]): string | undefined {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return typeof current === 'string' && current.trim() !== '' ? current : undefined;
}

function readNestedBoolean(value: unknown, path: string[]): boolean | undefined {
  let current = value;
  for (const segment of path) {
    if (!isRecord(current)) {
      return undefined;
    }
    current = current[segment];
  }
  return typeof current === 'boolean' ? current : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
