import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProviderCaptureManifestEntry, RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { createPayloadHash } from '../shared/raw-cache.js';
import type { SportmonksLeagueCaptureRequest } from './league-capture-plan.js';

// ─── Public interfaces ────────────────────────────────────────────────────────

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

// ─── Global reference endpoint keys (those with a .all suffix) ───────────────

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

// ─── Public functions ─────────────────────────────────────────────────────────

/**
 * Produce a stable family key for a request by normalizing its URL path and
 * sorted base query (excluding `page`, `cursor`, `api_token`).
 */
export function createSportmonksRequestFamilyKey(request: SportmonksLeagueCaptureRequest): string {
  const baseQuery = stripPaginationKeys(request.query);
  const sortedQuery = Object.keys(baseQuery)
    .sort()
    .map((k) => `${k}=${baseQuery[k]}`)
    .join('&');
  return `${request.urlPath}?${sortedQuery}`;
}

/**
 * Resolve whether a request should be skipped (already captured with terminal
 * raw evidence) or captured (missing / incomplete / raw envelope invalid).
 * When incomplete pagination exists, returns a resumed capture at the next page.
 */
export async function resolveSportmonksRequestProgress(
  captureRoot: string,
  request: SportmonksLeagueCaptureRequest
): Promise<SportmonksRequestProgress> {
  const manifestEntries = await readManifestEntries(captureRoot, 'sportmonks');

  // Match manifest entries by endpointKey + urlPath (ignoring pagination query params)
  const matchingEntries = manifestEntries.filter(
    (e) => e.endpointKey === request.endpointKey && e.urlPath === request.urlPath
  );

  if (matchingEntries.length === 0) {
    // No prior evidence — start fresh
    return makeCapture(request.query, 1, false);
  }

  // Sort by page number ascending to find the latest state
  const sortedEntries = [...matchingEntries].sort((a, b) => (a.page ?? 1) - (b.page ?? 1));
  const latest = sortedEntries[sortedEntries.length - 1]!;

  // Terminal entry: hasMore=false and status=captured
  if (latest.status === 'captured' && latest.hasMore === false) {
    // Validate raw envelope exists and content hash matches
    const rawValid = await validateRawEnvelope(captureRoot, latest);
    if (rawValid) {
      return { action: 'skip', page: latest.page ?? 1, query: stripPaginationKeys(latest.query ?? {}), resumed: false };
    }
    // Raw envelope missing or invalid — recapture from page 1
    return makeCapture(stripPaginationKeys(request.query), 1, false);
  }

  // Incomplete pagination — resume from where we left off
  if (latest.status === 'captured' && latest.hasMore === true) {
    const nextPage = (latest.page ?? 1) + 1;
    // Try to read cursor from the raw payload
    const cursor = await readNextCursorFromRaw(captureRoot, latest);
    if (cursor !== undefined) {
      return makeCapture({ ...stripPaginationKeys(request.query), cursor }, nextPage, true);
    }
    return makeCapture({ ...stripPaginationKeys(request.query), page: String(nextPage) }, nextPage, true);
  }

  // Failed / skipped / unavailable — recapture fresh
  return makeCapture(stripPaginationKeys(request.query), 1, false);
}

/**
 * Read field coverage from the most recently fetched valid `fixtures.enrichedById`
 * envelope for a given fixture ID. Empty arrays count as missing.
 */
export async function readSportmonksFixtureFieldCoverage(
  captureRoot: string,
  fixtureId: number
): Promise<SportmonksFixtureFieldCoverage> {
  const noData: SportmonksFixtureFieldCoverage = { odds: false, predictions: false, xGFixture: false, comments: false };
  const urlPath = `/fixtures/${fixtureId}`;

  const envelopes = await readRawEnvelopesByUrl(captureRoot, 'fixtures.enrichedById', urlPath);
  if (envelopes.length === 0) return noData;

  // Use the most recently fetched valid envelope
  envelopes.sort((a, b) => a.fetchedAt.localeCompare(b.fetchedAt));
  const envelope = envelopes[envelopes.length - 1]!;

  const payload = envelope.payload as Record<string, unknown> | null | undefined;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return noData;

  const data = payload.data as Record<string, unknown> | null | undefined;
  if (!data || typeof data !== 'object' || Array.isArray(data)) return noData;

  return {
    odds: isNonEmptyArray(data.odds),
    predictions: isNonEmptyArray(data.predictions),
    xGFixture: isNonEmptyArray(data.xGFixture),
    comments: isNonEmptyArray(data.comments)
  };
}

/**
 * Read completion status of global reference endpoints (types, countries, etc.)
 * from the manifest + raw validation. A reference is complete only when a
 * captured terminal entry has a valid raw envelope.
 */
export async function readSportmonksGlobalReferenceCoverage(
  captureRoot: string
): Promise<{ complete: string[]; missing: string[] }> {
  const manifestEntries = await readManifestEntries(captureRoot, 'sportmonks');

  const complete: string[] = [];
  const missing: string[] = [];

  for (const key of GLOBAL_REFERENCE_KEYS) {
    const terminal = manifestEntries.find(
      (e) => e.endpointKey === key && e.status === 'captured' && e.hasMore === false
    );
    if (terminal !== undefined) {
      const rawValid = await validateRawEnvelope(captureRoot, terminal);
      if (rawValid) {
        complete.push(key);
        continue;
      }
    }
    missing.push(key);
  }

  return { complete, missing };
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function makeCapture(
  query: Record<string, string>,
  page: number,
  resumed: boolean
): SportmonksRequestProgress {
  return { action: 'capture', page, query, resumed };
}

function stripPaginationKeys(query: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(query)) {
    if (k !== 'page' && k !== 'cursor' && k !== 'api_token') {
      result[k] = v;
    }
  }
  return result;
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
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      entries.push(JSON.parse(trimmed) as ProviderCaptureManifestEntry);
    } catch {
      // Skip invalid JSON lines
    }
  }
  return entries;
}

async function validateRawEnvelope(root: string, entry: ProviderCaptureManifestEntry): Promise<boolean> {
  if (!entry.fetchedAt || !entry.payloadHash) return false;
  const datePart = entry.fetchedAt.slice(0, 10);
  const rawDir = join(root, 'providers', 'sportmonks', 'raw', entry.endpointKey, datePart);
  const rawPath = join(rawDir, `${entry.payloadHash}.json`);
  try {
    const content = await readFile(rawPath, 'utf8');
    const envelope = JSON.parse(content) as RawProviderPayloadEnvelope;
    // Recompute hash to validate
    const recomputedHash = createPayloadHash(envelope.payload);
    return recomputedHash === entry.payloadHash;
  } catch {
    return false;
  }
}

async function readNextCursorFromRaw(root: string, entry: ProviderCaptureManifestEntry): Promise<string | undefined> {
  if (!entry.fetchedAt || !entry.payloadHash) return undefined;
  const datePart = entry.fetchedAt.slice(0, 10);
  const rawPath = join(root, 'providers', 'sportmonks', 'raw', entry.endpointKey, datePart, `${entry.payloadHash}.json`);
  try {
    const content = await readFile(rawPath, 'utf8');
    const envelope = JSON.parse(content) as RawProviderPayloadEnvelope;
    const payload = envelope.payload as Record<string, unknown> | null | undefined;
    if (!payload || typeof payload !== 'object') return undefined;
    const pagination = payload.pagination as Record<string, unknown> | null | undefined;
    if (!pagination || typeof pagination !== 'object') return undefined;
    const cursor = pagination.next_cursor;
    return typeof cursor === 'string' && cursor.length > 0 ? cursor : undefined;
  } catch {
    return undefined;
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
    const dateFullPath = join(endpointDir, dateDir);
    let files: string[];
    try {
      files = await readdir(dateFullPath);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const content = await readFile(join(dateFullPath, file), 'utf8');
        const envelope = JSON.parse(content) as RawProviderPayloadEnvelope;
        if (envelope.urlPath === urlPath) {
          envelopes.push(envelope);
        }
      } catch {
        // Skip invalid entries
      }
    }
  }
  return envelopes;
}

function isNonEmptyArray(value: unknown): boolean {
  return Array.isArray(value) && value.length > 0;
}
