import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  ProviderCaptureManifestEntry,
  RawProviderPayloadEnvelope
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { createPayloadHash } from '../shared/raw-cache.js';
import type { SportmonksLeagueCaptureRequest } from './league-capture-plan.js';

export interface SportmonksRequestProgress {
  action: 'skip' | 'capture';
  page: number;
  query: Record<string, string>;
  resumed: boolean;
}

export interface SportmonksFixtureFieldCoverage {
  odds: boolean;
  predictions: boolean;
  xGFixture: boolean;
  comments: boolean;
}

export interface SportmonksCaptureCoverageIndex {
  resolveRequestProgress(request: SportmonksLeagueCaptureRequest): Promise<SportmonksRequestProgress>;
  readFixtureFieldCoverage(fixtureId: number): Promise<SportmonksFixtureFieldCoverage>;
  readGlobalReferenceCoverage(): Promise<{ complete: string[]; missing: string[] }>;
}

const GLOBAL_REFERENCE_KEYS = [
  'types.all',
  'states.all',
  'countries.all',
  'regions.all',
  'markets.all',
  'bookmakers.all',
  'teams.all',
  'players.all',
  'venues.all',
  'coaches.all',
  'referees.all'
] as const;

const EMPTY_FIXTURE_COVERAGE: SportmonksFixtureFieldCoverage = {
  odds: false,
  predictions: false,
  xGFixture: false,
  comments: false
};

export function createSportmonksRequestFamilyKey(request: SportmonksLeagueCaptureRequest): string {
  return familyKey(request.endpointKey, request.urlPath, request.query);
}

export async function createSportmonksCaptureCoverageIndex(
  captureRoot: string
): Promise<SportmonksCaptureCoverageIndex> {
  const manifestEntries = await readManifestEntries(captureRoot, 'sportmonks');
  const entriesByFamily = new Map<string, ProviderCaptureManifestEntry[]>();
  const entriesByEndpointUrl = new Map<string, ProviderCaptureManifestEntry[]>();
  const entriesByEndpoint = new Map<string, ProviderCaptureManifestEntry[]>();
  const fixtureCoverageCache = new Map<number, SportmonksFixtureFieldCoverage>();

  for (const entry of manifestEntries) {
    appendMapValue(entriesByFamily, familyKey(entry.endpointKey, entry.urlPath, entry.query ?? {}), entry);
    appendMapValue(entriesByEndpointUrl, endpointUrlKey(entry.endpointKey, entry.urlPath), entry);
    appendMapValue(entriesByEndpoint, entry.endpointKey, entry);
  }

  return {
    async resolveRequestProgress(request) {
      const matchingEntries = entriesByFamily.get(createSportmonksRequestFamilyKey(request))
        ?? (!request.paginated
          ? entriesByEndpointUrl.get(endpointUrlKey(request.endpointKey, request.urlPath))
          : undefined)
        ?? [];
      return resolveProgressFromEntries(captureRoot, request, matchingEntries);
    },

    async readFixtureFieldCoverage(fixtureId) {
      const cached = fixtureCoverageCache.get(fixtureId);
      if (cached !== undefined) {
        return cached;
      }

      const urlPath = `/fixtures/${fixtureId}`;
      const matchingEntries = entriesByEndpointUrl.get(endpointUrlKey('fixtures.enrichedById', urlPath)) ?? [];
      const coverage = await readFixtureCoverageFromManifest(captureRoot, matchingEntries)
        ?? await readFixtureCoverageFromRawFallback(captureRoot, urlPath)
        ?? { ...EMPTY_FIXTURE_COVERAGE };
      fixtureCoverageCache.set(fixtureId, coverage);
      return coverage;
    },

    async readGlobalReferenceCoverage() {
      const complete: string[] = [];
      const missing: string[] = [];

      for (const endpointKey of GLOBAL_REFERENCE_KEYS) {
        const entries = entriesByEndpoint.get(endpointKey) ?? [];
        let valid = false;
        for (const entry of newestFirst(entries)) {
          if (entry.status === 'captured' && entry.hasMore === false && await validateRawEnvelope(captureRoot, entry)) {
            valid = true;
            break;
          }
        }
        (valid ? complete : missing).push(endpointKey);
      }

      return { complete, missing };
    }
  };
}

export async function resolveSportmonksRequestProgress(
  captureRoot: string,
  request: SportmonksLeagueCaptureRequest
): Promise<SportmonksRequestProgress> {
  const index = await createSportmonksCaptureCoverageIndex(captureRoot);
  return index.resolveRequestProgress(request);
}

export async function readSportmonksFixtureFieldCoverage(
  captureRoot: string,
  fixtureId: number
): Promise<SportmonksFixtureFieldCoverage> {
  const index = await createSportmonksCaptureCoverageIndex(captureRoot);
  return index.readFixtureFieldCoverage(fixtureId);
}

export async function readSportmonksGlobalReferenceCoverage(
  captureRoot: string
): Promise<{ complete: string[]; missing: string[] }> {
  const index = await createSportmonksCaptureCoverageIndex(captureRoot);
  return index.readGlobalReferenceCoverage();
}

async function resolveProgressFromEntries(
  captureRoot: string,
  request: SportmonksLeagueCaptureRequest,
  matchingEntries: ProviderCaptureManifestEntry[]
): Promise<SportmonksRequestProgress> {
  if (matchingEntries.length === 0) {
    return makeCapture(request.query, 1, false);
  }

  for (const entry of newestFirst(matchingEntries)) {
    if (entry.status === 'captured' && entry.hasMore === false && await validateRawEnvelope(captureRoot, entry)) {
      return {
        action: 'skip',
        page: entry.page ?? 1,
        query: stripPaginationKeys(entry.query ?? {}),
        resumed: false
      };
    }
  }

  const incompleteEntries = newestFirst(matchingEntries).filter(
    (entry) => entry.status === 'captured' && entry.hasMore === true
  );
  for (const entry of incompleteEntries) {
    if (!await validateRawEnvelope(captureRoot, entry)) {
      continue;
    }
    const nextPage = (entry.page ?? 1) + 1;
    const cursor = await readNextCursorFromRaw(captureRoot, entry);
    return makeCapture(
      cursor === undefined
        ? { ...stripPaginationKeys(request.query), page: String(nextPage) }
        : { ...stripPaginationKeys(request.query), cursor },
      nextPage,
      true
    );
  }

  return makeCapture(stripPaginationKeys(request.query), 1, false);
}

async function readFixtureCoverageFromManifest(
  captureRoot: string,
  entries: ProviderCaptureManifestEntry[]
): Promise<SportmonksFixtureFieldCoverage | undefined> {
  for (const entry of newestFirst(entries)) {
    const envelope = await readValidRawEnvelope(captureRoot, entry);
    if (envelope !== undefined) {
      return fixtureCoverageFromPayload(envelope.payload);
    }
  }
  return undefined;
}

async function readFixtureCoverageFromRawFallback(
  captureRoot: string,
  urlPath: string
): Promise<SportmonksFixtureFieldCoverage | undefined> {
  const envelopes = await readRawEnvelopesByUrl(captureRoot, 'fixtures.enrichedById', urlPath);
  envelopes.sort((left, right) => right.fetchedAt.localeCompare(left.fetchedAt));
  return envelopes[0] === undefined ? undefined : fixtureCoverageFromPayload(envelopes[0].payload);
}

function fixtureCoverageFromPayload(payload: unknown): SportmonksFixtureFieldCoverage {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    return { ...EMPTY_FIXTURE_COVERAGE };
  }
  return {
    odds: isNonEmptyArray(payload.data.odds),
    predictions: isNonEmptyArray(payload.data.predictions),
    xGFixture: isNonEmptyArray(payload.data.xGFixture),
    comments: isNonEmptyArray(payload.data.comments)
  };
}

function makeCapture(
  query: Record<string, string>,
  page: number,
  resumed: boolean
): SportmonksRequestProgress {
  return { action: 'capture', page, query, resumed };
}

function familyKey(endpointKey: string, urlPath: string, query: Record<string, string>): string {
  const baseQuery = stripPaginationKeys(query);
  const sortedQuery = Object.keys(baseQuery)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(baseQuery[key]!)}`)
    .join('&');
  return `${endpointKey}:${urlPath}?${sortedQuery}`;
}

function endpointUrlKey(endpointKey: string, urlPath: string): string {
  return `${endpointKey}:${urlPath}`;
}

function stripPaginationKeys(query: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key !== 'page' && key !== 'cursor' && key !== 'api_token') {
      result[key] = value;
    }
  }
  return result;
}

function appendMapValue<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const values = map.get(key);
  if (values === undefined) {
    map.set(key, [value]);
  } else {
    values.push(value);
  }
}

function newestFirst(entries: ProviderCaptureManifestEntry[]): ProviderCaptureManifestEntry[] {
  return [...entries].sort((left, right) => {
    const fetchedComparison = (right.fetchedAt ?? '').localeCompare(left.fetchedAt ?? '');
    return fetchedComparison !== 0 ? fetchedComparison : (right.page ?? 1) - (left.page ?? 1);
  });
}

async function readManifestEntries(root: string, provider: string): Promise<ProviderCaptureManifestEntry[]> {
  const manifestPath = join(root, 'providers', provider, 'manifests', 'capture-manifest.jsonl');
  let content: string;
  try {
    content = await readFile(manifestPath, 'utf8');
  } catch {
    return [];
  }
  const entries: ProviderCaptureManifestEntry[] = [];
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    try {
      const parsed = JSON.parse(line) as ProviderCaptureManifestEntry;
      entries.push(parsed);
    } catch {
      // Ignore malformed historical manifest lines.
    }
  }
  return entries;
}

async function validateRawEnvelope(root: string, entry: ProviderCaptureManifestEntry): Promise<boolean> {
  return (await readValidRawEnvelope(root, entry)) !== undefined;
}

async function readValidRawEnvelope(
  root: string,
  entry: ProviderCaptureManifestEntry
): Promise<RawProviderPayloadEnvelope | undefined> {
  if (entry.fetchedAt === undefined || entry.payloadHash === undefined) return undefined;
  const rawPath = join(
    root,
    'providers',
    'sportmonks',
    'raw',
    entry.endpointKey,
    entry.fetchedAt.slice(0, 10),
    `${entry.payloadHash}.json`
  );
  try {
    const envelope = JSON.parse(await readFile(rawPath, 'utf8')) as RawProviderPayloadEnvelope;
    return createPayloadHash(envelope.payload) === entry.payloadHash ? envelope : undefined;
  } catch {
    return undefined;
  }
}

async function readNextCursorFromRaw(
  root: string,
  entry: ProviderCaptureManifestEntry
): Promise<string | undefined> {
  const envelope = await readValidRawEnvelope(root, entry);
  if (envelope === undefined || !isRecord(envelope.payload) || !isRecord(envelope.payload.pagination)) {
    return undefined;
  }
  const nextCursor = envelope.payload.pagination.next_cursor;
  if (typeof nextCursor !== 'string' || nextCursor.trim() === '') {
    return undefined;
  }
  try {
    const url = new URL(nextCursor, 'https://api.sportmonks.com');
    return url.searchParams.get('cursor') ?? nextCursor;
  } catch {
    return nextCursor;
  }
}

async function readRawEnvelopesByUrl(
  root: string,
  endpointKey: string,
  urlPath: string
): Promise<RawProviderPayloadEnvelope[]> {
  const endpointDir = join(root, 'providers', 'sportmonks', 'raw', endpointKey);
  let dateDirs: string[];
  try {
    dateDirs = await readdir(endpointDir);
  } catch {
    return [];
  }
  const envelopes: RawProviderPayloadEnvelope[] = [];
  for (const dateDir of dateDirs) {
    let files: string[];
    try {
      files = await readdir(join(endpointDir, dateDir));
    } catch {
      continue;
    }
    for (const fileName of files) {
      if (!fileName.endsWith('.json')) continue;
      try {
        const envelope = JSON.parse(
          await readFile(join(endpointDir, dateDir, fileName), 'utf8')
        ) as RawProviderPayloadEnvelope;
        if (envelope.urlPath === urlPath && createPayloadHash(envelope.payload) === envelope.payloadHash) {
          envelopes.push(envelope);
        }
      } catch {
        // Ignore malformed historical raw files.
      }
    }
  }
  return envelopes;
}

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
