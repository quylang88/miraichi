import type { Dirent } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RawProviderPayloadEnvelope } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import type { SportmonksCaptureClient } from './capture.js';

export const SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE = [
  'scores',
  'participants',
  'statistics.type',
  'events',
  'lineups',
  'league',
  'season',
  'stage',
  'round',
  'venue',
  'state',
  'periods',
  'metadata',
  'formations',
  'referees',
  'coaches',
  'odds',
  'predictions',
  'xGFixture',
  'prematchNews',
  'postmatchNews'
].join(';');

export interface SportmonksProbeRequest {
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
}

export type FixtureProbeItem =
  | {
      fixtureId: number;
      status: 'captured';
      payload: unknown;
    }
  | {
      fixtureId: number;
      status: 'unavailable' | 'failed';
      errorCode: string;
      errorMessage: string;
    };

export interface FixtureCoverageFieldSummary {
  fixturesWithData: number;
}

export interface FixtureEnrichmentCoverageReport {
  generatedAt: string;
  fixtureCount: number;
  captured: number;
  unavailable: number;
  failed: number;
  fields: Record<string, FixtureCoverageFieldSummary>;
  localMatchReadiness: {
    canBuildScheduledMatches: boolean;
    canBuildCompletedMatches: boolean;
    missingForCompletedMatches: string[];
    notes: string[];
  };
  errors: Array<{ fixtureId: number; status: 'unavailable' | 'failed'; errorCode: string; errorMessage: string }>;
}

export interface FixtureEnrichmentBatchReport {
  generatedAt: string;
  sourceFixtureCount: number;
  alreadyCapturedCount: number;
  selectedFixtureCount: number;
  selectedFixtureIds: number[];
  attempted: number;
  captured: number;
  unavailable: number;
  failed: number;
  stoppedEarlyReason?: 'rate_limited';
  include: string;
  fields: Record<string, FixtureCoverageFieldSummary>;
  localMatchReadiness: FixtureEnrichmentCoverageReport['localMatchReadiness'];
  errors: FixtureEnrichmentCoverageReport['errors'];
}

const COVERAGE_FIELDS = [
  'participants',
  'scores',
  'events',
  'statistics',
  'lineups',
  'odds',
  'premiumOdds',
  'predictions',
  'xGFixture',
  'prematchNews',
  'postmatchNews'
] as const;

export function buildFixtureEnrichmentRequests(fixtureIds: number[]): SportmonksProbeRequest[] {
  return dedupePositiveIds(fixtureIds).map((fixtureId) => ({
    endpointKey: 'fixtures.enrichedById',
    urlPath: `/fixtures/${fixtureId}`,
    query: { include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE }
  }));
}

export function buildSportmonksSubscriptionProbeRequests(): SportmonksProbeRequest[] {
  return [
    { endpointKey: 'subscription.enrichments', urlPath: '/my/enrichments', query: {} },
    { endpointKey: 'subscription.resources', urlPath: '/my/resources', query: {} },
    { endpointKey: 'subscription.leagues', urlPath: '/my/leagues', query: {} },
    { endpointKey: 'subscription.usage', urlPath: '/my/usage', query: {} }
  ];
}

export async function extractFixtureIdsFromRawCapture(captureRoot: string, limit: number): Promise<number[]> {
  const fixtureRoot = join(captureRoot, 'providers', 'sportmonks', 'raw', 'fixtures.all');
  const fixtureIds: number[] = [];
  const seen = new Set<number>();

  for (const filePath of await listJsonFiles(fixtureRoot)) {
    const envelope = JSON.parse(await readFile(filePath, 'utf8')) as RawProviderPayloadEnvelope;
    const data = readPayloadDataArray(envelope.payload);
    for (const item of data) {
      const id = readNumberProperty(item, 'id');
      if (id !== undefined && !seen.has(id)) {
        seen.add(id);
        fixtureIds.push(id);
        if (fixtureIds.length >= limit) {
          return fixtureIds;
        }
      }
    }
  }

  return fixtureIds;
}

export async function runSportmonksFixtureEnrichmentProbe(options: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  fixtureIds: number[];
  now?: () => string;
  reportFileName?: string;
  log?: (message: string) => void;
}): Promise<FixtureEnrichmentCoverageReport> {
  const now = options.now ?? (() => new Date().toISOString());
  const results: FixtureProbeItem[] = [];

  for (const request of buildFixtureEnrichmentRequests(options.fixtureIds)) {
    const fixtureId = Number(request.urlPath.split('/').at(-1));
    options.log?.(`sportmonks:probe fixture=${fixtureId}`);
    const response = await options.client.get(request.urlPath, request.query);
    if (!response.ok) {
      const status = response.status === 'unavailable' ? 'unavailable' : 'failed';
      await appendProviderManifestEntry(options.captureRoot, 'sportmonks', {
        provider: 'sportmonks',
        endpointKey: request.endpointKey,
        urlPath: request.urlPath,
        query: request.query,
        status,
        errorCode: response.status === 'unavailable' ? String(response.statusCode) : response.status,
        errorMessage: response.message
      });
      results.push({
        fixtureId,
        status,
        errorCode: response.status === 'unavailable' ? String(response.statusCode) : response.status,
        errorMessage: response.message
      });
      continue;
    }

    const fetchedAt = now();
    const payloadHash = createPayloadHash(response.body);
    await writeRawProviderPayload(options.captureRoot, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: request.endpointKey,
      urlPath: request.urlPath,
      query: request.query,
      fetchedAt,
      payloadHash,
      rateLimit: response.rateLimit,
      payload: response.body
    });
    await appendProviderManifestEntry(options.captureRoot, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: request.endpointKey,
      urlPath: request.urlPath,
      query: request.query,
      status: 'captured',
      payloadHash,
      fetchedAt,
      recordCount: 1
    });
    results.push({ fixtureId, status: 'captured', payload: response.body });
  }

  const report = createFixtureEnrichmentCoverageReport(results, now());
  await writeSportmonksReport(options.captureRoot, options.reportFileName ?? timestampedReportName(now()), report);
  return report;
}

export async function runSportmonksFixtureEnrichmentBatch(options: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  fixtureIds?: number[];
  maxFixtures?: number;
  skipAlreadyCaptured?: boolean;
  now?: () => string;
  reportFileName?: string;
  log?: (message: string) => void;
}): Promise<FixtureEnrichmentBatchReport> {
  const now = options.now ?? (() => new Date().toISOString());
  const inventory = options.fixtureIds === undefined
    ? await extractSortedFixtureIdsFromRawCapture(options.captureRoot)
    : dedupePositiveIds(options.fixtureIds).sort((left, right) => left - right);
  const alreadyCaptured = options.skipAlreadyCaptured === false
    ? new Set<number>()
    : await readCapturedEnrichedFixtureIds(options.captureRoot);
  const candidates = inventory.filter((fixtureId) => !alreadyCaptured.has(fixtureId));
  const selectedFixtureIds = options.maxFixtures === undefined
    ? candidates
    : candidates.slice(0, options.maxFixtures);
  const results: FixtureProbeItem[] = [];
  let stoppedEarlyReason: FixtureEnrichmentBatchReport['stoppedEarlyReason'];

  for (const request of buildFixtureEnrichmentRequests(selectedFixtureIds)) {
    const item = await captureFixtureEnrichmentRequest({
      captureRoot: options.captureRoot,
      client: options.client,
      request,
      now,
      ...(options.log === undefined ? {} : { log: options.log })
    });
    results.push(item);
    if (item.status === 'failed' && item.errorCode === 'rate_limited') {
      stoppedEarlyReason = 'rate_limited';
      break;
    }
  }

  const coverage = createFixtureEnrichmentCoverageReport(results, now());
  const report: FixtureEnrichmentBatchReport = {
    generatedAt: coverage.generatedAt,
    sourceFixtureCount: inventory.length,
    alreadyCapturedCount: inventory.filter((fixtureId) => alreadyCaptured.has(fixtureId)).length,
    selectedFixtureCount: selectedFixtureIds.length,
    selectedFixtureIds,
    attempted: results.length,
    captured: coverage.captured,
    unavailable: coverage.unavailable,
    failed: coverage.failed,
    ...(stoppedEarlyReason === undefined ? {} : { stoppedEarlyReason }),
    include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE,
    fields: coverage.fields,
    localMatchReadiness: coverage.localMatchReadiness,
    errors: coverage.errors
  };

  await writeSportmonksReport(options.captureRoot, options.reportFileName ?? timestampedBatchReportName(now()), report);
  return report;
}

async function captureFixtureEnrichmentRequest(input: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  request: SportmonksProbeRequest;
  now: () => string;
  log?: (message: string) => void;
}): Promise<FixtureProbeItem> {
  const fixtureId = Number(input.request.urlPath.split('/').at(-1));
  input.log?.(`sportmonks:enrich fixture=${fixtureId}`);
  const response = await input.client.get(input.request.urlPath, input.request.query);
  if (!response.ok) {
    const status = response.status === 'unavailable' ? 'unavailable' : 'failed';
    const errorCode = response.status === 'unavailable' ? String(response.statusCode) : response.status;
    await appendProviderManifestEntry(input.captureRoot, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: input.request.endpointKey,
      urlPath: input.request.urlPath,
      query: input.request.query,
      status,
      errorCode,
      errorMessage: response.message
    });
    return {
      fixtureId,
      status,
      errorCode,
      errorMessage: response.message
    };
  }

  const fetchedAt = input.now();
  const payloadHash = createPayloadHash(response.body);
  await writeRawProviderPayload(input.captureRoot, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey: input.request.endpointKey,
    urlPath: input.request.urlPath,
    query: input.request.query,
    fetchedAt,
    payloadHash,
    rateLimit: response.rateLimit,
    payload: response.body
  });
  await appendProviderManifestEntry(input.captureRoot, 'sportmonks', {
    provider: 'sportmonks',
    endpointKey: input.request.endpointKey,
    urlPath: input.request.urlPath,
    query: input.request.query,
    status: 'captured',
    payloadHash,
    fetchedAt,
    recordCount: 1
  });
  return { fixtureId, status: 'captured', payload: response.body };
}

export async function runSportmonksSubscriptionProbe(options: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  now?: () => string;
  log?: (message: string) => void;
}): Promise<{ captured: number; unavailable: number; failed: number }> {
  const now = options.now ?? (() => new Date().toISOString());
  const result = { captured: 0, unavailable: 0, failed: 0 };

  for (const request of buildSportmonksSubscriptionProbeRequests()) {
    options.log?.(`sportmonks:subscription ${request.endpointKey}`);
    const response = await options.client.get(request.urlPath, request.query);
    if (!response.ok) {
      const status = response.status === 'unavailable' ? 'unavailable' : 'failed';
      await appendProviderManifestEntry(options.captureRoot, 'sportmonks', {
        provider: 'sportmonks',
        endpointKey: request.endpointKey,
        urlPath: request.urlPath,
        query: request.query,
        status,
        errorCode: response.status === 'unavailable' ? String(response.statusCode) : response.status,
        errorMessage: response.message
      });
      result[status] += 1;
      continue;
    }

    const fetchedAt = now();
    const payloadHash = createPayloadHash(response.body);
    await writeRawProviderPayload(options.captureRoot, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: request.endpointKey,
      urlPath: request.urlPath,
      query: request.query,
      fetchedAt,
      payloadHash,
      rateLimit: response.rateLimit,
      payload: response.body
    });
    await appendProviderManifestEntry(options.captureRoot, 'sportmonks', {
      provider: 'sportmonks',
      endpointKey: request.endpointKey,
      urlPath: request.urlPath,
      query: request.query,
      status: 'captured',
      payloadHash,
      fetchedAt
    });
    result.captured += 1;
  }

  return result;
}

export function createFixtureEnrichmentCoverageReport(
  items: FixtureProbeItem[],
  generatedAt = new Date().toISOString()
): FixtureEnrichmentCoverageReport {
  const fields: Record<string, FixtureCoverageFieldSummary> = {};
  for (const field of COVERAGE_FIELDS) {
    fields[field] = { fixturesWithData: 0 };
  }

  for (const item of items) {
    if (item.status !== 'captured') {
      continue;
    }
    const fixture = readFixturePayload(item.payload);
    for (const field of COVERAGE_FIELDS) {
      if (hasFieldData(fixture, field)) {
        fields[field]!.fixturesWithData += 1;
      }
    }
  }

  const captured = items.filter((item) => item.status === 'captured').length;
  const unavailable = items.filter((item) => item.status === 'unavailable').length;
  const failed = items.filter((item) => item.status === 'failed').length;
  const missingForCompletedMatches = [
    fields.participants!.fixturesWithData === 0 ? 'participants' : undefined,
    fields.scores!.fixturesWithData === 0 ? 'scores' : undefined
  ].filter((value): value is string => value !== undefined);

  return {
    generatedAt,
    fixtureCount: items.length,
    captured,
    unavailable,
    failed,
    fields,
    localMatchReadiness: {
      canBuildScheduledMatches: captured > 0 && fields.participants!.fixturesWithData > 0,
      canBuildCompletedMatches: captured > 0 && missingForCompletedMatches.length === 0,
      missingForCompletedMatches,
      notes: [
        'This report checks raw field presence only; it does not normalize data into Miraichi canonical IDs.',
        'Odds/predictions/xG are archived as raw provider data only and are not used for formulas or recommendations.'
      ]
    },
    errors: items
      .filter((item): item is Extract<FixtureProbeItem, { status: 'unavailable' | 'failed' }> => item.status !== 'captured')
      .map((item) => ({
        fixtureId: item.fixtureId,
        status: item.status,
        errorCode: item.errorCode,
        errorMessage: item.errorMessage
      }))
  };
}

async function writeSportmonksReport(captureRoot: string, fileName: string, report: unknown): Promise<void> {
  const dir = join(captureRoot, 'providers', 'sportmonks', 'reports');
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, fileName), JSON.stringify(report, null, 2), 'utf8');
}

function timestampedReportName(now: string): string {
  return `fixture-enrichment-coverage-report-${now.replace(/[:.]/g, '-')}.json`;
}

function timestampedBatchReportName(now: string): string {
  return `fixture-enrichment-batch-report-${now.replace(/[:.]/g, '-')}.json`;
}

async function extractSortedFixtureIdsFromRawCapture(captureRoot: string): Promise<number[]> {
  const fixtureRoot = join(captureRoot, 'providers', 'sportmonks', 'raw', 'fixtures.all');
  const seen = new Set<number>();

  for (const filePath of await listJsonFiles(fixtureRoot)) {
    const envelope = JSON.parse(await readFile(filePath, 'utf8')) as RawProviderPayloadEnvelope;
    for (const item of readPayloadDataArray(envelope.payload)) {
      const id = readNumberProperty(item, 'id');
      if (id !== undefined) {
        seen.add(id);
      }
    }
  }

  return [...seen].sort((left, right) => left - right);
}

async function readCapturedEnrichedFixtureIds(captureRoot: string): Promise<Set<number>> {
  const manifestPath = join(captureRoot, 'providers', 'sportmonks', 'manifests', 'capture-manifest.jsonl');
  const captured = new Set<number>();
  let content: string;
  try {
    content = await readFile(manifestPath, 'utf8');
  } catch {
    return captured;
  }

  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === '') {
      continue;
    }
    let entry: unknown;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(entry) || entry.endpointKey !== 'fixtures.enrichedById' || entry.status !== 'captured') {
      continue;
    }
    const urlPath = typeof entry.urlPath === 'string' ? entry.urlPath : '';
    const match = /^\/fixtures\/(\d+)$/.exec(urlPath);
    if (match !== null) {
      captured.add(Number(match[1]));
    }
  }

  return captured;
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

function readPayloadDataArray(payload: unknown): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload.data)) {
    return [];
  }
  return payload.data;
}

function readFixturePayload(payload: unknown): Record<string, unknown> {
  if (!isRecord(payload)) {
    return {};
  }
  const data = payload.data;
  return isRecord(data) ? data : {};
}

function hasFieldData(fixture: Record<string, unknown>, field: string): boolean {
  const value = fixture[field];
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return isRecord(value);
}

function dedupePositiveIds(ids: number[]): number[] {
  const output: number[] = [];
  const seen = new Set<number>();
  for (const id of ids) {
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      output.push(id);
    }
  }
  return output;
}

function readNumberProperty(value: unknown, property: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const raw = value[property];
  return typeof raw === 'number' && Number.isInteger(raw) && raw > 0 ? raw : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
