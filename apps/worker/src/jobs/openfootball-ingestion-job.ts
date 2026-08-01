import { randomUUID } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  validateOpenFootballSourceRegistry,
  type OpenFootballCompetitionSource
} from '@miraichi/config';
import {
  buildServingMatchStore,
  buildServingMatchesFromWarehouse,
  readServingMatchStoreSnapshot,
  type BuildServingMatchStoreResult,
} from '../../../api/src/repositories/serving-match-store.js';
import {
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  appendProviderManifestEntry,
  readLatestProviderManifestEntry
} from '../../../../scripts/providers/shared/manifest.js';
import {
  createTextPayloadHash,
  readLatestRawProviderPayload,
  writeRawProviderPayload
} from '../../../../scripts/providers/shared/raw-cache.js';
import type {
  LocalMatch,
  ProviderCaptureManifestEntry,
  RawProviderPayloadEnvelope
} from '@miraichi/shared';
import { adaptOpenFootballMatches, type OpenFootballCanonicalBatch } from '../sources/openfootball/openfootball-adapter.js';
import {
  fetchOpenFootballSource,
  OpenFootballFetchError,
  type OpenFootballClientDependencies
} from '../sources/openfootball/openfootball-client.js';
import { parseFootballTxt, type FootballTxtParseResult } from '../sources/openfootball/football-txt-parser.js';
import { validateOpenFootballPublicationCandidate } from '../sources/openfootball/openfootball-publication-validator.js';

export type OpenFootballIngestionRunResult =
  | {
      status: 'published';
      runId: string;
      changedSourceCount: number;
      notModifiedSourceCount: number;
      publishedMatchCount: number;
      servingVersion: string;
    }
  | {
      status: 'not_modified' | 'skipped' | 'failed';
      runId: string;
      changedSourceCount: number;
      notModifiedSourceCount: number;
      errorCodes: string[];
    };

export interface OpenFootballIngestionDependencies {
  fetchSource: typeof fetchOpenFootballSource;
  parseText: typeof parseFootballTxt;
  writeRawPayload: typeof writeRawProviderPayload;
  readLatestRawPayload: typeof readLatestRawProviderPayload;
  appendManifest: typeof appendProviderManifestEntry;
  validatePublication: typeof validateOpenFootballPublicationCandidate;
  writeWarehouseRun: typeof writeCanonicalWarehouseRun;
  buildServingMatches: typeof buildServingMatchesFromWarehouse;
  buildServingStore: typeof buildServingMatchStore;
  readServingSnapshot: typeof readServingMatchStoreSnapshot;
  readLatestManifest: typeof readLatestProviderManifestEntry;
  fetchClientDependencies: Omit<OpenFootballClientDependencies, 'now'>;
}

export interface OpenFootballIngestionJobOptions {
  dataRoot: string;
  sources: readonly OpenFootballCompetitionSource[];
  now: () => Date;
  dependencies?: Partial<OpenFootballIngestionDependencies>;
}

type DueSource = {
  source: OpenFootballCompetitionSource;
  due: boolean;
  latestPublishedOrNotModifiedAt?: string;
};

type SourceBatch = {
  source: OpenFootballCompetitionSource;
  fetchedAt: string;
  batch: OpenFootballCanonicalBatch;
};

type SourceFailure = {
  source: OpenFootballCompetitionSource;
  fetchedAt: string;
  status: 'invalid' | 'unavailable' | 'failed';
  code: string;
  message: string;
  httpStatus?: number;
  attemptCount?: number;
};

const PROVIDER = 'openfootball' as const;

export async function runOpenFootballIngestionJob(options: OpenFootballIngestionJobOptions): Promise<OpenFootballIngestionRunResult> {
  const dependencies = resolveDependencies(options);
  const runId = createRunId(options.now());
  const enabledSources = options.sources.filter((source) => source.enabled);
  try {
    return await runIngestion(options, dependencies, runId, enabledSources);
  } catch (error) {
    const code = error instanceof OpenFootballIngestionJobError ? error.code : 'job_failed';
    return failureResult(
      options.dataRoot,
      runId,
      persistableSources(enabledSources),
      options.now,
      dependencies,
      0,
      0,
      code,
      messageFor(error)
    );
  }
}

async function runIngestion(
  options: OpenFootballIngestionJobOptions,
  dependencies: OpenFootballIngestionDependencies,
  runId: string,
  enabledSources: readonly OpenFootballCompetitionSource[]
): Promise<OpenFootballIngestionRunResult> {
  const registryErrors = validateOpenFootballSourceRegistry(options.sources);

  if (registryErrors.length > 0) {
    return failureResult(
      options.dataRoot,
      runId,
      persistableSources(enabledSources),
      options.now,
      dependencies,
      0,
      0,
      'invalid_registry',
      registryErrors.join('; ')
    );
  }

  const dueSources = await Promise.all(enabledSources.map(async (source): Promise<DueSource> => {
    const latest = await latestPublishedOrNotModifiedAt(options.dataRoot, source, dependencies);
    const due = latest === undefined || options.now().getTime() - Date.parse(latest) >= source.refreshIntervalMinutes * 60_000;
    return latest === undefined ? { source, due } : { source, due, latestPublishedOrNotModifiedAt: latest };
  }));

  if (dueSources.every((entry) => !entry.due)) {
    return {
      status: 'skipped',
      runId,
      changedSourceCount: 0,
      notModifiedSourceCount: 0,
      errorCodes: []
    };
  }

  const dueEntryIds = new Set(dueSources.filter((entry) => entry.due).map((entry) => entry.source.entryId));
  const fetchedAt = options.now().toISOString();
  try {
    await Promise.all(dueSources.filter((entry) => entry.due).map(({ source }) => appendManifest(
      options.dataRoot,
      source,
      runId,
      dependencies,
      { status: 'pending', fetchedAt }
    )));
  } catch (error) {
    return failureResult(
      options.dataRoot,
      runId,
      persistableSources(dueSources.filter((entry) => entry.due).map((entry) => entry.source)),
      options.now,
      dependencies,
      0,
      0,
      'manifest_append_failed',
      messageFor(error)
    );
  }

  let changedSourceCount = 0;
  let notModifiedSourceCount = 0;
  const batches: SourceBatch[] = [];
  const failures: SourceFailure[] = [];

  for (const { source, due } of dueSources) {
    if (!due) {
      const cached = await latestRawPayload(options.dataRoot, source, dependencies);
      if (cached === null || typeof cached.payload !== 'string') {
        failures.push({
          source,
          fetchedAt: options.now().toISOString(),
          status: 'failed',
          code: 'missing_last_raw_payload',
          message: 'A not-due OpenFootball source has no archived raw payload'
        });
        continue;
      }
      const batch = parseAndAdapt(source, cached.payload, cached.fetchedAt, dependencies);
      if ('failure' in batch) {
        failures.push(batch.failure);
      } else {
        batches.push(batch);
      }
      continue;
    }

    const priorRaw = await latestRawPayload(options.dataRoot, source, dependencies);
    try {
      const conditional = conditionalValidators(priorRaw);
      const fetchInput = conditional === undefined ? { source } : { source, conditional };
      const fetched = await dependencies.fetchSource(fetchInput, { ...dependencies.fetchClientDependencies, now: options.now });

      if (fetched.status === 'changed') {
        changedSourceCount += 1;
        const envelope = rawEnvelope(source, fetched);
        await dependencies.writeRawPayload(options.dataRoot, envelope);
        await appendManifest(options.dataRoot, source, runId, dependencies, {
          status: 'captured',
          fetchedAt: fetched.fetchedAt,
          payloadHash: envelope.payloadHash,
          recordCount: 0
        });
        const batch = parseAndAdapt(source, fetched.text, fetched.fetchedAt, dependencies);
        if ('failure' in batch) {
          failures.push(batch.failure);
        } else {
          batches.push(batch);
        }
        continue;
      }

      notModifiedSourceCount += 1;
      await appendManifest(options.dataRoot, source, runId, dependencies, {
        status: 'not_modified',
        fetchedAt: fetched.fetchedAt
      });
      if (priorRaw === null || typeof priorRaw.payload !== 'string') {
        failures.push({
          source,
          fetchedAt: fetched.fetchedAt,
          status: 'failed',
          code: 'missing_last_raw_payload',
          message: 'OpenFootball returned 304 but no archived raw payload exists'
        });
        continue;
      }
      const batch = parseAndAdapt(source, priorRaw.payload, priorRaw.fetchedAt, dependencies);
      if ('failure' in batch) {
        failures.push(batch.failure);
      } else {
        batches.push(batch);
      }
    } catch (error) {
      failures.push(fetchFailure(source, options.now().toISOString(), error));
    }
  }

  if (failures.length > 0) {
    await appendFailuresBestEffort(options.dataRoot, runId, failures, dependencies);
    await appendAbortedSourcesBestEffort(options.dataRoot, runId, enabledSources, failures, dueEntryIds, options.now, dependencies);
    return failed(runId, changedSourceCount, notModifiedSourceCount, failures.map((failure) => failure.code));
  }

  if (changedSourceCount === 0) {
    return {
      status: 'not_modified',
      runId,
      changedSourceCount,
      notModifiedSourceCount,
      errorCodes: []
    };
  }

  const candidate = mergeBatches(batches);
  let priorMatches: LocalMatch[];
  try {
    priorMatches = (await dependencies.readServingSnapshot(join(options.dataRoot, 'serving'))).matches;
  } catch (error) {
    if (!isMissingServingStore(error)) {
      await appendFailuresBestEffort(options.dataRoot, runId, enabledSources.map((source) => ({
        source,
        fetchedAt: options.now().toISOString(),
        status: 'failed' as const,
        code: 'serving_snapshot_read_failed',
        message: messageFor(error)
      })), dependencies);
      return failed(runId, changedSourceCount, notModifiedSourceCount, ['serving_snapshot_read_failed']);
    }
    priorMatches = [];
  }

  let validation: ReturnType<OpenFootballIngestionDependencies['validatePublication']>;
  try {
    validation = dependencies.validatePublication({ sources: enabledSources, candidate, priorMatches });
  } catch (error) {
    return failureResult(
      options.dataRoot,
      runId,
      enabledSources,
      options.now,
      dependencies,
      changedSourceCount,
      notModifiedSourceCount,
      'publication_validation_error',
      messageFor(error)
    );
  }
  if (!validation.ok) {
    const failuresForValidation = enabledSources.map((source) => ({
      source,
      fetchedAt: options.now().toISOString(),
      status: 'invalid' as const,
      code: 'publication_validation_failed',
      message: validation.errors.join('; ')
    }));
    await appendFailuresBestEffort(options.dataRoot, runId, failuresForValidation, dependencies);
    return failed(runId, changedSourceCount, notModifiedSourceCount, ['publication_validation_failed']);
  }

  const servingRoot = join(options.dataRoot, 'serving');
  const servingCheckpoint = await captureServingManifest(servingRoot);
  let servingPointerReplaced = false;
  try {
    const warehouseRoot = await dependencies.writeWarehouseRun(options.dataRoot, runId, candidate);
    const serving = await dependencies.buildServingMatches({ warehouseRoot, importedAt: options.now().toISOString() });
    const servingResult = await dependencies.buildServingStore({
      servingRoot,
      version: runId,
      snapshotId: runId,
      generatedAt: options.now().toISOString(),
      importedAt: options.now().toISOString(),
      sources: serving.sources,
      matches: serving.matches,
      warehouseRunId: runId
    });
    servingPointerReplaced = true;
    await Promise.all(enabledSources.map((source) => appendManifest(
      options.dataRoot,
      source,
      runId,
      dependencies,
      { status: 'published', fetchedAt: options.now().toISOString(), recordCount: sourceMatchCount(candidate, source) }
    )));
    return published(runId, changedSourceCount, notModifiedSourceCount, servingResult);
  } catch (error) {
    if (servingPointerReplaced) {
      try {
        await restoreServingManifest(servingRoot, runId, servingCheckpoint);
      } catch (rollbackError) {
        return failureResult(
          options.dataRoot,
          runId,
          enabledSources,
          options.now,
          dependencies,
          changedSourceCount,
          notModifiedSourceCount,
          'serving_rollback_failed',
          messageFor(rollbackError)
        );
      }
    }
    const publicationFailure = enabledSources.map((source) => ({
      source,
      fetchedAt: options.now().toISOString(),
      status: 'failed' as const,
      code: 'publication_failed',
      message: messageFor(error)
    }));
    await appendFailuresBestEffort(options.dataRoot, runId, publicationFailure, dependencies);
    return failed(runId, changedSourceCount, notModifiedSourceCount, ['publication_failed']);
  }
}

function resolveDependencies(options: OpenFootballIngestionJobOptions): OpenFootballIngestionDependencies {
  return {
    fetchSource: fetchOpenFootballSource,
    parseText: parseFootballTxt,
    writeRawPayload: writeRawProviderPayload,
    readLatestRawPayload: readLatestRawProviderPayload,
    appendManifest: appendProviderManifestEntry,
    validatePublication: validateOpenFootballPublicationCandidate,
    writeWarehouseRun: writeCanonicalWarehouseRun,
    buildServingMatches: buildServingMatchesFromWarehouse,
    buildServingStore: buildServingMatchStore,
    readServingSnapshot: readServingMatchStoreSnapshot,
    readLatestManifest: readLatestProviderManifestEntry,
    fetchClientDependencies: {
      fetchFn: globalThis.fetch,
      sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))
    },
    ...options.dependencies
  };
}

function createRunId(now: Date): string {
  return `openfootball-${now.toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().replaceAll('-', '').slice(0, 12)}`;
}

async function latestPublishedOrNotModifiedAt(
  dataRoot: string,
  source: OpenFootballCompetitionSource,
  dependencies: OpenFootballIngestionDependencies
): Promise<string | undefined> {
  let injectedLatest: ProviderCaptureManifestEntry | null;
  try {
    injectedLatest = await dependencies.readLatestManifest(dataRoot, PROVIDER, source.entryId);
  } catch (error) {
    throw new OpenFootballIngestionJobError('evidence_lookup_failed', messageFor(error));
  }
  if (injectedLatest?.status === 'published' || injectedLatest?.status === 'not_modified') {
    return timestampFromManifest(injectedLatest);
  }
  const manifestPath = join(dataRoot, 'providers', PROVIDER, 'manifests', 'capture-manifest.jsonl');
  let text: string;
  try {
    text = await readFile(manifestPath, 'utf8');
  } catch (error) {
    if (isMissingFile(error)) return undefined;
    throw new OpenFootballIngestionJobError('evidence_lookup_failed', messageFor(error));
  }
  let latest: { timestamp: string; milliseconds: number } | undefined;
  for (const line of text.split(/\r?\n/u)) {
    if (line.trim() === '') continue;
    let entry: ProviderCaptureManifestEntry;
    try {
      entry = JSON.parse(line) as ProviderCaptureManifestEntry;
    } catch (error) {
      throw new OpenFootballIngestionJobError('evidence_lookup_failed', messageFor(error));
    }
    if (
      entry.provider === PROVIDER &&
      entry.endpointKey === source.entryId &&
      (entry.status === 'published' || entry.status === 'not_modified') &&
      entry.fetchedAt !== undefined
    ) {
      const timestamp = timestampFromManifest(entry);
      const milliseconds = Date.parse(timestamp);
      if (latest === undefined || milliseconds > latest.milliseconds) {
        latest = { timestamp, milliseconds };
      }
    }
  }
  return latest?.timestamp;
}

function timestampFromManifest(entry: ProviderCaptureManifestEntry): string {
  if (entry.fetchedAt === undefined || Number.isNaN(Date.parse(entry.fetchedAt))) {
    throw new OpenFootballIngestionJobError('evidence_lookup_failed', 'OpenFootball manifest has no valid fetchedAt timestamp');
  }
  return entry.fetchedAt;
}

async function latestRawPayload(
  dataRoot: string,
  source: OpenFootballCompetitionSource,
  dependencies: OpenFootballIngestionDependencies
): Promise<Awaited<ReturnType<typeof readLatestRawProviderPayload>>> {
  try {
    return await dependencies.readLatestRawPayload(dataRoot, PROVIDER, source.entryId);
  } catch (error) {
    throw new OpenFootballIngestionJobError('evidence_lookup_failed', messageFor(error));
  }
}

function conditionalValidators(
  raw: Awaited<ReturnType<typeof readLatestRawProviderPayload>>
): { etag?: string; lastModified?: string } | undefined {
  const etag = raw?.response?.etag;
  const lastModified = raw?.response?.lastModified;
  if (etag === undefined && lastModified === undefined) return undefined;
  return {
    ...(etag === undefined ? {} : { etag }),
    ...(lastModified === undefined ? {} : { lastModified })
  };
}

function rawEnvelope(
  source: OpenFootballCompetitionSource,
  fetched: Extract<Awaited<ReturnType<typeof fetchOpenFootballSource>>, { status: 'changed' }>
): RawProviderPayloadEnvelope {
  return {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: PROVIDER,
    endpointKey: source.entryId,
    urlPath: fetched.urlPath,
    query: {},
    fetchedAt: fetched.fetchedAt,
    payloadHash: createTextPayloadHash(fetched.text),
    rateLimit: {},
    source: {
      allowlistEntryId: source.entryId,
      repository: source.repository,
      ref: source.ref,
      filePath: source.filePath
    },
    response: {
      contentType: fetched.contentType,
      byteCount: fetched.byteCount,
      ...(fetched.etag === undefined ? {} : { etag: fetched.etag }),
      ...(fetched.lastModified === undefined ? {} : { lastModified: fetched.lastModified })
    },
    payload: fetched.text
  };
}

function parseAndAdapt(
  source: OpenFootballCompetitionSource,
  text: string,
  fetchedAt: string,
  dependencies: OpenFootballIngestionDependencies
): SourceBatch | { failure: SourceFailure } {
  let parsed: FootballTxtParseResult;
  try {
    parsed = dependencies.parseText(text);
  } catch (error) {
    return { failure: invalidFailure(source, fetchedAt, 'parse_failed', messageFor(error)) };
  }
  const fatalIssues = parsed.issues.filter((issue) => issue.fatal);
  if (fatalIssues.length > 0) {
    return {
      failure: invalidFailure(
        source,
        fetchedAt,
        fatalIssues[0]!.code,
        fatalIssues.map((issue) => `${issue.code}: ${issue.line}`).join('; ')
      )
    };
  }
  const batch = adaptOpenFootballMatches({ source, parsedMatches: parsed.matches, observedAt: fetchedAt });
  if (batch.issues.length > 0) {
    return {
      failure: invalidFailure(
        source,
        fetchedAt,
        batch.issues[0]!.code,
        batch.issues.map((issue) => `${issue.code}: ${issue.message}`).join('; ')
      )
    };
  }
  return { source, fetchedAt, batch };
}

function mergeBatches(batches: readonly SourceBatch[]): CanonicalWarehouseSnapshot {
  const matches = new Map<string, CanonicalWarehouseSnapshot['matches'][number]>();
  const teams = new Map<string, CanonicalWarehouseSnapshot['teams'][number]>();
  const competitions = new Map<string, CanonicalWarehouseSnapshot['competitions'][number]>();
  const links = new Map<string, CanonicalWarehouseSnapshot['links'][number]>();
  const provenance = new Map<string, CanonicalWarehouseSnapshot['provenance'][number]>();
  for (const { batch } of batches) {
    for (const match of batch.matches) matches.set(match.matchId, match);
    for (const team of batch.teams) teams.set(team.teamId, team);
    for (const competition of batch.competitions) competitions.set(competition.competitionId, competition);
    for (const link of batch.links) links.set([link.entityType, link.entityId, link.provider, link.providerEntityType, link.providerEntityId].join('|'), link);
    for (const record of batch.provenance) provenance.set([record.entityType, record.entityId, record.fieldPath, record.provider, record.providerEntityId].join('|'), record);
  }
  return {
    matches: [...matches.values()],
    teams: [...teams.values()],
    competitions: [...competitions.values()],
    links: [...links.values()],
    provenance: [...provenance.values()]
  };
}

async function appendManifest(
  dataRoot: string,
  source: OpenFootballCompetitionSource,
  runId: string,
  dependencies: OpenFootballIngestionDependencies,
  detail: Pick<ProviderCaptureManifestEntry, 'status' | 'fetchedAt' | 'payloadHash' | 'recordCount' | 'errorCode' | 'errorMessage' | 'httpStatus' | 'attemptCount'>
): Promise<void> {
  try {
    await dependencies.appendManifest(dataRoot, PROVIDER, {
      runId,
      allowlistEntryId: source.entryId,
      provider: PROVIDER,
      endpointKey: source.entryId,
      urlPath: `/openfootball/${source.repository}/${source.ref}/${source.filePath}`,
      query: {},
      ...detail
    });
  } catch (error) {
    throw new OpenFootballIngestionJobError('manifest_append_failed', messageFor(error));
  }
}

async function appendFailures(
  dataRoot: string,
  runId: string,
  failures: readonly SourceFailure[],
  dependencies: OpenFootballIngestionDependencies
): Promise<void> {
  await Promise.all(failures.map((failure) => appendManifest(dataRoot, failure.source, runId, dependencies, {
    status: failure.status,
    fetchedAt: failure.fetchedAt,
    errorCode: failure.code,
    errorMessage: failure.message,
    ...(failure.httpStatus === undefined ? {} : { httpStatus: failure.httpStatus }),
    ...(failure.attemptCount === undefined ? {} : { attemptCount: failure.attemptCount })
  })));
}

async function appendFailuresBestEffort(
  dataRoot: string,
  runId: string,
  failures: readonly SourceFailure[],
  dependencies: OpenFootballIngestionDependencies
): Promise<void> {
  try {
    await appendFailures(dataRoot, runId, failures, dependencies);
  } catch {
    // A failed evidence store cannot be repaired by retrying the same failed append.
  }
}

async function appendAbortedSources(
  dataRoot: string,
  runId: string,
  enabledSources: readonly OpenFootballCompetitionSource[],
  failures: readonly SourceFailure[],
  dueEntryIds: ReadonlySet<string>,
  now: () => Date,
  dependencies: OpenFootballIngestionDependencies
): Promise<void> {
  const failedEntryIds = new Set(failures.map((failure) => failure.source.entryId));
  await Promise.all(enabledSources
    .filter((source) => dueEntryIds.has(source.entryId) && !failedEntryIds.has(source.entryId))
    .map((source) => appendManifest(dataRoot, source, runId, dependencies, {
      status: 'failed',
      fetchedAt: now().toISOString(),
      errorCode: 'run_aborted',
      errorMessage: 'OpenFootball run was not published because another source failed'
    })));
}

async function appendAbortedSourcesBestEffort(
  dataRoot: string,
  runId: string,
  enabledSources: readonly OpenFootballCompetitionSource[],
  failures: readonly SourceFailure[],
  dueEntryIds: ReadonlySet<string>,
  now: () => Date,
  dependencies: OpenFootballIngestionDependencies
): Promise<void> {
  try {
    await appendAbortedSources(dataRoot, runId, enabledSources, failures, dueEntryIds, now, dependencies);
  } catch {
    // The typed failure result remains truthful when evidence storage itself is unavailable.
  }
}

async function failureResult(
  dataRoot: string,
  runId: string,
  sources: readonly OpenFootballCompetitionSource[],
  now: () => Date,
  dependencies: OpenFootballIngestionDependencies,
  changedSourceCount: number,
  notModifiedSourceCount: number,
  code: string,
  message: string
): Promise<OpenFootballIngestionRunResult> {
  await appendFailuresBestEffort(dataRoot, runId, sources.map((source) => ({
    source,
    fetchedAt: now().toISOString(),
    status: 'failed' as const,
    code,
    message
  })), dependencies);
  return failed(runId, changedSourceCount, notModifiedSourceCount, [code]);
}

function persistableSources(sources: readonly OpenFootballCompetitionSource[]): OpenFootballCompetitionSource[] {
  return sources.filter((source) => (
    source.sourceId === PROVIDER &&
    source.entryId.trim() !== '' &&
    source.repository !== undefined &&
    source.ref === 'master' &&
    source.filePath.trim() !== ''
  ));
}

type ServingManifestCheckpoint = { previous: string | null };

async function captureServingManifest(servingRoot: string): Promise<ServingManifestCheckpoint> {
  try {
    return { previous: await readFile(join(servingRoot, 'manifest.json'), 'utf8') };
  } catch (error) {
    if (isMissingFile(error)) return { previous: null };
    throw new OpenFootballIngestionJobError('serving_manifest_checkpoint_failed', messageFor(error));
  }
}

async function restoreServingManifest(
  servingRoot: string,
  runId: string,
  checkpoint: ServingManifestCheckpoint
): Promise<void> {
  const manifestPath = join(servingRoot, 'manifest.json');
  const temporaryPath = join(servingRoot, `manifest.json.rollback-${runId}`);
  if (checkpoint.previous !== null) {
    await writeFile(temporaryPath, checkpoint.previous, 'utf8');
    await rename(temporaryPath, manifestPath);
    return;
  }
  try {
    await rename(manifestPath, temporaryPath);
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

class OpenFootballIngestionJobError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = 'OpenFootballIngestionJobError';
  }
}

function fetchFailure(source: OpenFootballCompetitionSource, fetchedAt: string, error: unknown): SourceFailure {
  if (error instanceof OpenFootballIngestionJobError) {
    return { source, fetchedAt, status: 'failed', code: error.code, message: error.message };
  }
  if (error instanceof OpenFootballFetchError) {
    return {
      source,
      fetchedAt,
      status: error.code === 'source_unavailable' ? 'unavailable' : 'failed',
      code: error.code,
      message: error.message,
      ...(error.httpStatus === undefined ? {} : { httpStatus: error.httpStatus }),
      attemptCount: error.attemptCount
    };
  }
  return { source, fetchedAt, status: 'failed', code: 'fetch_failed', message: messageFor(error) };
}

function invalidFailure(source: OpenFootballCompetitionSource, fetchedAt: string, code: string, message: string): SourceFailure {
  return { source, fetchedAt, status: 'invalid', code, message };
}

function sourceMatchCount(candidate: CanonicalWarehouseSnapshot, source: OpenFootballCompetitionSource): number {
  const prefix = `${source.entryId}:`;
  const matchIds = new Set(candidate.links
    .filter((link) => link.entityType === 'match' && link.provider === PROVIDER && link.providerEntityId.startsWith(prefix))
    .map((link) => link.entityId));
  return candidate.matches.filter((match) => matchIds.has(match.matchId)).length;
}

function published(
  runId: string,
  changedSourceCount: number,
  notModifiedSourceCount: number,
  servingResult: BuildServingMatchStoreResult
): OpenFootballIngestionRunResult {
  return {
    status: 'published',
    runId,
    changedSourceCount,
    notModifiedSourceCount,
    publishedMatchCount: servingResult.matchCount,
    servingVersion: servingResult.version
  };
}

function failed(runId: string, changedSourceCount: number, notModifiedSourceCount: number, errorCodes: string[]): OpenFootballIngestionRunResult {
  return {
    status: 'failed',
    runId,
    changedSourceCount,
    notModifiedSourceCount,
    errorCodes: [...new Set(errorCodes)]
  };
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function isMissingServingStore(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'serving_match_store_missing';
}

function messageFor(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
