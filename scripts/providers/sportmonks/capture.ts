import type {
  ProviderCaptureManifestEntry,
  RawProviderPayloadEnvelope
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import type { SportmonksClientResult } from './client.js';
import type { SportmonksEndpointEntry } from './endpoint-catalog.js';

export interface SportmonksCaptureClient {
  get(urlPath: string, query?: Record<string, string>): Promise<SportmonksClientResult>;
}

export interface SportmonksRawCaptureOptions {
  captureRoot: string;
  allowGatedEndpoints: boolean;
  catalog: SportmonksEndpointEntry[];
  client: SportmonksCaptureClient;
  now?: () => string;
  log?: (message: string) => void;
  maxPagesPerEndpoint?: number;
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

  for (const endpoint of options.catalog) {
    if (endpoint.capturePolicy === 'gated' && !options.allowGatedEndpoints) {
      await appendSkippedManifest(options.captureRoot, endpoint, 'gated_endpoint', 'Endpoint is gated by config');
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
      now,
      maxPagesPerEndpoint,
      log: options.log
    });

    result.captured += endpointResult.captured;
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

  for (let page = 1; page <= input.maxPagesPerEndpoint; page += 1) {
    const query = { page: String(page) };
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
  }

  await appendProviderManifestEntry(input.captureRoot, 'sportmonks', {
    provider: 'sportmonks',
    endpointKey: input.endpoint.endpointKey,
    urlPath: input.endpoint.urlPath,
    query: { page: String(input.maxPagesPerEndpoint) },
    status: 'failed',
    page: input.maxPagesPerEndpoint,
    errorCode: 'max_pages_exceeded',
    errorMessage: `Stopped after ${input.maxPagesPerEndpoint} pages`
  });
  result.failed += 1;
  return result;
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
