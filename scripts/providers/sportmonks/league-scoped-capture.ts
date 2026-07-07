import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { ProviderCaptureManifestEntry } from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { appendProviderManifestEntry } from '../shared/manifest.js';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import type { SportmonksCaptureClient } from './capture.js';
import {
  readSportmonksFixtureFieldCoverage,
  readSportmonksGlobalReferenceCoverage,
  resolveSportmonksRequestProgress
} from './league-capture-coverage.js';
import { buildSportmonksLeagueCaptureInventory } from './league-capture-inventory.js';
import {
  buildSportmonksLeagueCaptureRequests,
  type SportmonksLeagueCaptureGroup,
  type SportmonksLeagueCaptureRequest
} from './league-capture-plan.js';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface SportmonksLeagueCaptureGroupResult {
  planned: number;
  skipped: number;
  resumed: number;
  captured: number;
  unavailable: number;
  failed: number;
}

export interface SportmonksLeagueCaptureResult {
  leagueId: number;
  seasonIds: number[];
  fixtureCount: number;
  teamCount: number;
  planned: number;
  skipped: number;
  resumed: number;
  captured: number;
  unavailable: number;
  failed: number;
  groupResults: Record<SportmonksLeagueCaptureGroup, SportmonksLeagueCaptureGroupResult>;
  missingGlobalReferences: string[];
  excludedEndpointFamilies: ['global-all', 'livescores', 'inplay-odds', 'expected-lineups'];
  stoppedEarlyReason?: 'max_requests' | 'rate_limited';
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function runSportmonksLeagueScopedCapture(options: {
  captureRoot: string;
  client: SportmonksCaptureClient;
  leagueId: number;
  seasonIds?: number[];
  maxSeasons?: number;
  groups?: SportmonksLeagueCaptureGroup[];
  maxRequests?: number;
  skipExisting?: boolean;
  now?: () => string;
  log?: (message: string) => void;
}): Promise<SportmonksLeagueCaptureResult> {
  const {
    captureRoot,
    client,
    leagueId,
    groups,
    maxRequests,
    now = () => new Date().toISOString(),
    log = () => undefined
  } = options;

  const skipExisting = options.skipExisting !== false; // default true

  // ── 1. Build inventory from existing raw envelopes ─────────────────────────
  const inventory = await buildSportmonksLeagueCaptureInventory({
    captureRoot,
    leagueId,
    ...(options.seasonIds !== undefined ? { seasonIds: options.seasonIds } : {}),
    ...(options.maxSeasons !== undefined ? { maxSeasons: options.maxSeasons } : {})
  });

  // ── 2. Build request graph ─────────────────────────────────────────────────
  const requests = buildSportmonksLeagueCaptureRequests(inventory, groups);

  // ── 3. Read global reference coverage ─────────────────────────────────────
  const globalReferences = await readSportmonksGlobalReferenceCoverage(captureRoot);

  // ── 4. Initialize result counters ─────────────────────────────────────────
  const initialGroup: SportmonksLeagueCaptureGroupResult = { planned: 0, skipped: 0, resumed: 0, captured: 0, unavailable: 0, failed: 0 };
  const result: SportmonksLeagueCaptureResult = {
    leagueId,
    seasonIds: inventory.seasons.map((s) => s.seasonId),
    fixtureCount: inventory.fixtureIds.length,
    teamCount: inventory.teamIds.length,
    planned: requests.length,
    skipped: 0,
    resumed: 0,
    captured: 0,
    unavailable: 0,
    failed: 0,
    groupResults: {
      season: { ...initialGroup },
      fixture: { ...initialGroup },
      team: { ...initialGroup },
      ai: { ...initialGroup }
    },
    missingGlobalReferences: globalReferences.missing,
    excludedEndpointFamilies: ['global-all', 'livescores', 'inplay-odds', 'expected-lineups']
  };

  // Track request budget
  let httpCalls = 0;

  // ── 5. Execute each request ────────────────────────────────────────────────
  for (const request of requests) {
    const gr = result.groupResults[request.group];
    gr.planned++;

    // Check budget before this request
    if (maxRequests !== undefined && httpCalls >= maxRequests) {
      result.stoppedEarlyReason = 'max_requests';
      break;
    }

    // Suppress narrower odds/prediction requests if enrichment already has them
    if (request.fixtureId !== undefined && skipExisting) {
      const coverage = await readSportmonksFixtureFieldCoverage(captureRoot, request.fixtureId);
      if (request.endpointKey === 'odds.prematchByFixtureId' && coverage.odds) {
        log(`[skip] ${request.endpointKey} ${request.urlPath} (odds in enrichment)`);
        result.skipped++;
        gr.skipped++;
        continue;
      }
      if (request.endpointKey === 'predictions.probabilitiesByFixtureId' && coverage.predictions) {
        log(`[skip] ${request.endpointKey} ${request.urlPath} (predictions in enrichment)`);
        result.skipped++;
        gr.skipped++;
        continue;
      }
    }

    // Resolve whether to skip or capture
    const progress = skipExisting
      ? await resolveSportmonksRequestProgress(captureRoot, request)
      : { action: 'capture' as const, page: 1, query: { ...request.query, ...(request.paginated ? { page: '1' } : {}) }, resumed: false };

    if (progress.action === 'skip') {
      log(`[skip] ${request.endpointKey} ${request.urlPath}`);
      result.skipped++;
      gr.skipped++;
      continue;
    }

    // Execute the request (with pagination)
    let currentPage = progress.page;
    let currentQuery: Record<string, string> = { ...progress.query };
    if (progress.resumed) {
      result.resumed++;
      gr.resumed++;
    }

    let pageLoop = true;
    while (pageLoop) {
      pageLoop = false;

      // Budget check
      if (maxRequests !== undefined && httpCalls >= maxRequests) {
        result.stoppedEarlyReason = 'max_requests';
        return await writeReportAndReturn(captureRoot, result, now);
      }

      // Add page to paginated query
      const queryWithPage = request.paginated
        ? { ...currentQuery, page: String(currentPage) }
        : currentQuery;

      log(`[capture] ${request.endpointKey} ${request.urlPath} page=${currentPage}`);

      const clientResult = await client.get(request.urlPath, queryWithPage);
      httpCalls++;

      if (!clientResult.ok) {
        if (clientResult.status === 'rate_limited') {
          log(`[rate_limited] ${request.urlPath}`);
          result.stoppedEarlyReason = 'rate_limited';
          await appendManifestEntry(captureRoot, request, 'failed', undefined, undefined, currentPage, false, 'rate_limited', clientResult.message);
          return await writeReportAndReturn(captureRoot, result, now);
        }

        // unavailable (403/404) or unexpected failure
        const manifestStatus = clientResult.status === 'unavailable' ? 'unavailable' : 'failed';
        await appendManifestEntry(captureRoot, request, manifestStatus, undefined, undefined, currentPage, false, clientResult.status, clientResult.message);

        if (clientResult.status === 'unavailable') {
          result.unavailable++;
          gr.unavailable++;
        } else {
          result.failed++;
          gr.failed++;
        }
        continue; // Move to next request
      }

      // Successful response — write raw envelope
      const fetchedAt = now();
      const payloadHash = createPayloadHash(clientResult.body);
      await writeRawProviderPayload(captureRoot, {
        schemaVersion: 'miraichi.provider.raw.v1',
        provider: 'sportmonks',
        endpointKey: request.endpointKey,
        urlPath: request.urlPath,
        query: queryWithPage,
        fetchedAt,
        payloadHash,
        rateLimit: clientResult.rateLimit,
        payload: clientResult.body
      });

      // Check pagination
      const body = clientResult.body as Record<string, unknown> | null | undefined;
      const pagination = body && typeof body === 'object' && !Array.isArray(body)
        ? (body.pagination as Record<string, unknown> | null | undefined)
        : undefined;
      const hasMore = pagination !== null && pagination !== undefined && pagination.has_more === true;

      await appendManifestEntry(captureRoot, request, 'captured', fetchedAt, payloadHash, currentPage, hasMore);

      result.captured++;
      gr.captured++;

      // Continue pagination if needed (only for paginated endpoints)
      if (request.paginated && hasMore) {
        const nextCursor = typeof pagination?.next_cursor === 'string' && pagination.next_cursor.length > 0
          ? pagination.next_cursor
          : undefined;

        if (nextCursor !== undefined) {
          currentQuery = { ...currentQuery, cursor: nextCursor };
          delete currentQuery['page'];
        } else {
          currentPage++;
        }
        pageLoop = true;

        // Check budget before next page
        if (maxRequests !== undefined && httpCalls >= maxRequests) {
          result.stoppedEarlyReason = 'max_requests';
          return await writeReportAndReturn(captureRoot, result, now);
        }
      }
    }
  }

  return await writeReportAndReturn(captureRoot, result, now);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function appendManifestEntry(
  captureRoot: string,
  request: SportmonksLeagueCaptureRequest,
  status: ProviderCaptureManifestEntry['status'],
  fetchedAt?: string,
  payloadHash?: string,
  page?: number,
  hasMore?: boolean,
  errorCode?: string,
  errorMessage?: string
): Promise<void> {
  const entry: ProviderCaptureManifestEntry = {
    provider: 'sportmonks',
    endpointKey: request.endpointKey,
    urlPath: request.urlPath,
    query: request.query,
    status
  };
  if (page !== undefined) entry.page = page;
  if (hasMore !== undefined) entry.hasMore = hasMore;
  if (fetchedAt !== undefined) entry.fetchedAt = fetchedAt;
  if (payloadHash !== undefined) entry.payloadHash = payloadHash;
  if (errorCode !== undefined) entry.errorCode = errorCode;
  if (errorMessage !== undefined) entry.errorMessage = errorMessage;
  await appendProviderManifestEntry(captureRoot, 'sportmonks', entry);
}

async function writeReportAndReturn(
  captureRoot: string,
  result: SportmonksLeagueCaptureResult,
  now: () => string
): Promise<SportmonksLeagueCaptureResult> {
  const reportsDir = join(captureRoot, 'providers', 'sportmonks', 'reports');
  await mkdir(reportsDir, { recursive: true });
  const timestamp = now().replace(/[:.]/g, '-').slice(0, 19);
  const reportPath = join(reportsDir, `league-capture-report-${timestamp}.json`);
  await writeFile(reportPath, JSON.stringify(result, null, 2), 'utf8');
  return result;
}
