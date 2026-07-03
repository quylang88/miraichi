import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import type { SportmonksCaptureClient } from './capture.js';

export type SportmonksSeasonScopedEndpointKey =
  | 'schedules.bySeasonId'
  | 'teams.bySeasonId'
  | 'standings.bySeasonId'
  | 'standings.correctionsBySeasonId';

export interface SportmonksSeasonScopedRequest {
  endpointKey: SportmonksSeasonScopedEndpointKey;
  urlPath: string;
  query: Record<string, string>;
}

export interface SportmonksSeasonScopedCaptureResult {
  candidateSeasonCount: number;
  selectedSeasonCount: number;
  requestedEndpointCount: number;
  captured: number;
  skipped: number;
  unavailable: number;
  failed: number;
  stoppedEarlyReason?: 'max_requests' | 'rate_limited';
}

const DEFAULT_ENDPOINTS: SportmonksSeasonScopedEndpointKey[] = [
  'schedules.bySeasonId',
  'teams.bySeasonId',
  'standings.bySeasonId',
  'standings.correctionsBySeasonId'
];

export async function extractSeasonIdsFromFixtureRawCapture(
  captureRoot: string,
  filters: { leagueIds?: number[] }
): Promise<number[]> {
  const fixtureRoot = join(captureRoot, 'providers', 'sportmonks', 'raw', 'fixtures.all');
  const allowedLeagueIds = new Set((filters.leagueIds ?? []).filter((id) => Number.isInteger(id) && id > 0));
  const seasonIds = new Set<number>();

  for (const filePath of await listJsonFiles(fixtureRoot)) {
    const envelope = JSON.parse(await readFile(filePath, 'utf8')) as RawProviderPayloadEnvelope;
    for (const item of readPayloadDataArray(envelope.payload)) {
      const leagueId = readPositiveInteger(item, 'league_id');
      const seasonId = readPositiveInteger(item, 'season_id');
      if (seasonId === undefined) {
        continue;
      }
      if (allowedLeagueIds.size > 0 && (leagueId === undefined || !allowedLeagueIds.has(leagueId))) {
        continue;
      }
      seasonIds.add(seasonId);
    }
  }

  return [...seasonIds].sort((left, right) => left - right);
}

export function buildSportmonksSeasonScopedRequests(
  seasonIds: number[],
  endpoints: SportmonksSeasonScopedEndpointKey[] = DEFAULT_ENDPOINTS
): SportmonksSeasonScopedRequest[] {
  const output: SportmonksSeasonScopedRequest[] = [];
  const cleanSeasonIds = dedupePositiveIds(seasonIds).sort((left, right) => left - right);
  const cleanEndpoints = dedupeEndpoints(endpoints);

  for (const seasonId of cleanSeasonIds) {
    for (const endpoint of cleanEndpoints) {
      output.push(buildSeasonScopedRequest(endpoint, seasonId));
    }
  }

  return output;
}

export async function runSportmonksSeasonScopedCapture(options: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  seasonIds?: number[];
  leagueIds?: number[];
  endpoints?: SportmonksSeasonScopedEndpointKey[];
  maxRequests?: number;
  skipAlreadyCaptured?: boolean;
  now?: () => string;
  reportFileName?: string;
  log?: (message: string) => void;
}): Promise<SportmonksSeasonScopedCaptureResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const candidateSeasonIds = options.seasonIds === undefined
    ? await extractSeasonIdsFromFixtureRawCapture(options.captureRoot, { leagueIds: options.leagueIds ?? [] })
    : dedupePositiveIds(options.seasonIds).sort((left, right) => left - right);
  const requests = buildSportmonksSeasonScopedRequests(candidateSeasonIds, options.endpoints ?? DEFAULT_ENDPOINTS);
  const alreadyCaptured = options.skipAlreadyCaptured === false
    ? new Set<string>()
    : await readCapturedRequestKeys(options.captureRoot);
  const result: SportmonksSeasonScopedCaptureResult = {
    candidateSeasonCount: candidateSeasonIds.length,
    selectedSeasonCount: candidateSeasonIds.length,
    requestedEndpointCount: requests.length,
    captured: 0,
    skipped: 0,
    unavailable: 0,
    failed: 0
  };
  let requestCount = 0;

  for (const request of requests) {
    if (options.maxRequests !== undefined && requestCount >= options.maxRequests) {
      result.stoppedEarlyReason = 'max_requests';
      break;
    }

    const firstPageQuery = withPage(request.query, 1);
    if (alreadyCaptured.has(requestKey(request.endpointKey, request.urlPath, firstPageQuery))) {
      result.skipped += 1;
      options.log?.(`sportmonks:season-scope ${request.endpointKey} ${request.urlPath} skipped; already captured`);
      continue;
    }

    let page = 1;
    let hasMore = true;
    while (hasMore) {
      if (options.maxRequests !== undefined && requestCount >= options.maxRequests) {
        result.stoppedEarlyReason = 'max_requests';
        break;
      }

      const query = withPage(request.query, page);
      options.log?.(`sportmonks:season-scope ${request.endpointKey} ${request.urlPath} page=${page}`);
      const response = await options.client.get(request.urlPath, query);
      requestCount += 1;

      if (!response.ok) {
        const status = response.status === 'unavailable' ? 'unavailable' : 'failed';
        result[status] += 1;
        await appendProviderManifestEntry(options.captureRoot, 'sportmonks', {
          provider: 'sportmonks',
          endpointKey: request.endpointKey,
          urlPath: request.urlPath,
          query,
          status,
          page,
          errorCode: response.status === 'unavailable' ? String(response.statusCode) : response.status,
          errorMessage: response.message
        });
        if (response.status === 'rate_limited') {
          result.stoppedEarlyReason = 'rate_limited';
        }
        break;
      }

      const fetchedAt = now();
      const payloadHash = createPayloadHash(response.body);
      const recordCount = readPayloadDataArray(response.body).length;
      hasMore = readHasMore(response.body);
      await writeRawProviderPayload(options.captureRoot, {
        schemaVersion: 'miraichi.provider.raw.v1',
        provider: 'sportmonks',
        endpointKey: request.endpointKey,
        urlPath: request.urlPath,
        query,
        fetchedAt,
        payloadHash,
        rateLimit: response.rateLimit,
        payload: response.body
      });
      await appendProviderManifestEntry(options.captureRoot, 'sportmonks', {
        provider: 'sportmonks',
        endpointKey: request.endpointKey,
        urlPath: request.urlPath,
        query,
        status: 'captured',
        page,
        hasMore,
        payloadHash,
        fetchedAt,
        recordCount
      });
      result.captured += 1;
      page += 1;
    }

    if (result.stoppedEarlyReason !== undefined) {
      break;
    }
  }

  await writeSeasonScopedReport(options.captureRoot, options.reportFileName ?? timestampedReportName(now()), {
    generatedAt: now(),
    filters: {
      leagueIds: options.leagueIds ?? [],
      seasonIds: candidateSeasonIds,
      endpoints: options.endpoints ?? DEFAULT_ENDPOINTS
    },
    result
  });
  return result;
}

function buildSeasonScopedRequest(
  endpoint: SportmonksSeasonScopedEndpointKey,
  seasonId: number
): SportmonksSeasonScopedRequest {
  switch (endpoint) {
    case 'schedules.bySeasonId':
      return { endpointKey: endpoint, urlPath: `/schedules/seasons/${seasonId}`, query: {} };
    case 'teams.bySeasonId':
      return { endpointKey: endpoint, urlPath: `/teams/seasons/${seasonId}`, query: {} };
    case 'standings.bySeasonId':
      return {
        endpointKey: endpoint,
        urlPath: `/standings/seasons/${seasonId}`,
        query: { include: 'participant;league;season;stage;round;details.type;rule' }
      };
    case 'standings.correctionsBySeasonId':
      return {
        endpointKey: endpoint,
        urlPath: `/standings/corrections/seasons/${seasonId}`,
        query: { include: 'participant;league;season;stage;round' }
      };
  }
}

async function readCapturedRequestKeys(captureRoot: string): Promise<Set<string>> {
  const path = join(captureRoot, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
  const keys = new Set<string>();
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    return keys;
  }

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
    if (!isRecord(parsed) || parsed.provider !== 'sportmonks' || parsed.status !== 'captured') {
      continue;
    }
    if (typeof parsed.endpointKey !== 'string' || typeof parsed.urlPath !== 'string') {
      continue;
    }
    keys.add(requestKey(parsed.endpointKey, parsed.urlPath, isRecord(parsed.query) ? stringRecord(parsed.query) : {}));
  }

  return keys;
}

function requestKey(endpointKey: string, urlPath: string, query: Record<string, string>): string {
  return JSON.stringify({ endpointKey, urlPath, query: sortedStringRecord(query) });
}

function withPage(query: Record<string, string>, page: number): Record<string, string> {
  return { ...query, page: String(page) };
}

function readHasMore(payload: unknown): boolean {
  if (!isRecord(payload) || !isRecord(payload.pagination)) {
    return false;
  }
  return payload.pagination.has_more === true;
}

function readPayloadDataArray(payload: unknown): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return [];
  }
  return payload.data;
}

function readPositiveInteger(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const raw = value[key];
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : undefined;
}

function dedupePositiveIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const output: number[] = [];
  for (const id of ids) {
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      output.push(id);
    }
  }
  return output;
}

function dedupeEndpoints(endpoints: SportmonksSeasonScopedEndpointKey[]): SportmonksSeasonScopedEndpointKey[] {
  const seen = new Set<SportmonksSeasonScopedEndpointKey>();
  const output: SportmonksSeasonScopedEndpointKey[] = [];
  for (const endpoint of endpoints) {
    if (!seen.has(endpoint)) {
      seen.add(endpoint);
      output.push(endpoint);
    }
  }
  return output;
}

async function listJsonFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(dir: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  await visit(root);
  return files.sort();
}

async function writeSeasonScopedReport(captureRoot: string, fileName: string, report: unknown): Promise<void> {
  const dir = join(captureRoot, 'providers', 'sportmonks', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), JSON.stringify(report, null, 2), 'utf8');
}

function timestampedReportName(now: string): string {
  return `season-scoped-capture-report-${now.replace(/[:.]/g, '-')}.json`;
}

function stringRecord(value: Record<string, unknown>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'string') {
      output[key] = raw;
    }
  }
  return output;
}

function sortedStringRecord(value: Record<string, string>): Record<string, string> {
  const output: Record<string, string> = {};
  for (const key of Object.keys(value).sort()) {
    output[key] = value[key]!;
  }
  return output;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
