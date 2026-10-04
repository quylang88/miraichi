import { randomUUID } from 'node:crypto';
import { mkdir, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  COMPETITION_SOURCE_REGISTRY,
  type CompetitionSourceEntry
} from '@miraichi/config';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import {
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../scripts/providers/shared/canonical-warehouse.js';
import {
  buildServingMatchesFromWarehouse,
  buildServingMatchStore
} from '../../../api/src/repositories/serving-match-store.js';
import {
  OpenFootballClient,
  type OpenFootballSeasonRequest,
  type OpenFootballSeasonResponse
} from '../sources/openfootball/openfootball-client.js';
import { adaptOpenFootballSeason } from '../sources/openfootball/openfootball-adapter.js';
import {
  FotMobAccessBlockedError,
  FotMobSeasonClient,
  type FotMobSeasonRequest,
  type FotMobSeasonResponse
} from '../sources/fotmob/fotmob-season-client.js';
import { adaptFotMobSeason } from '../sources/fotmob/fotmob-season-adapter.js';
import {
  loadLastGoodWarehouseSnapshot,
  mergeCanonicalWarehouseSnapshots
} from '../sources/shared/canonical-snapshot-merge.js';
import { CanonicalPublicationJobLease } from '../sources/shared/canonical-publication-job-lease.js';
import { SeasonHydrationJobLease } from '../sources/hydration/season-hydration-job-lease.js';
import { SeasonHydrationLedger } from '../sources/hydration/season-hydration-ledger.js';
import {
  planSeasonHydrationBatch,
  type SeasonHydrationTarget
} from '../sources/hydration/season-hydration-plan.js';

export interface OpenFootballSeasonFetcher {
  getSeasonMatches(request: OpenFootballSeasonRequest): Promise<OpenFootballSeasonResponse>;
}

export interface FotMobSeasonFetcher {
  getSeasonMatches(request: FotMobSeasonRequest): Promise<FotMobSeasonResponse>;
}

export interface SeasonHydrationJobOptions {
  dataRoot: string;
  openFootballClient?: OpenFootballSeasonFetcher;
  fotMobClient?: FotMobSeasonFetcher;
  referenceDate: string;
  pastSeasons?: number;
  maxRequestsPerRun?: number;
  registry?: readonly CompetitionSourceEntry[];
  now?: () => Date;
  requestIntervalMs?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  leaseStaleAfterMs?: number;
  mode?: 'hydrate' | 'revalidate-current';
}

export interface SeasonHydrationJobResult {
  status: 'completed' | 'partial' | 'idle' | 'lease_busy';
  targetsAttempted: number;
  targetsSucceeded: number;
  targetsFailed: number;
  requestsAttempted: number;
  requestsSucceeded: number;
  requestsFailed: number;
  publications: number;
  targetsCompleted: number;
  recordsIgnoredWithoutKickoff: number;
  recordsIgnoredLive: number;
  errors: string[];
}

interface SuccessfulTarget {
  target: SeasonHydrationTarget;
  etag?: string;
  delta: CanonicalWarehouseSnapshot;
}

export async function runSeasonHydrationJob(
  options: SeasonHydrationJobOptions
): Promise<SeasonHydrationJobResult> {
  const now = options.now ?? (() => new Date());
  const observedAt = now();
  if (Number.isNaN(observedAt.valueOf())) throw new Error('Season hydration clock is invalid.');
  const maxRequests = options.maxRequestsPerRun ?? 9;
  const requestIntervalMs = options.requestIntervalMs ?? 0;
  assertRange(maxRequests, 1, 100, 'maxRequestsPerRun');
  assertRange(requestIntervalMs, 0, 60_000, 'requestIntervalMs');

  const lease = new SeasonHydrationJobLease({
    dataRoot: options.dataRoot,
    now: () => observedAt,
    ...(options.leaseStaleAfterMs === undefined
      ? {}
      : { staleAfterMs: options.leaseStaleAfterMs })
  });
  const leased = await lease.tryWithLease(async () => {
    const publicationLease = new CanonicalPublicationJobLease({
      dataRoot: options.dataRoot,
      now: () => observedAt,
      ...(options.leaseStaleAfterMs === undefined
        ? {}
        : { staleAfterMs: options.leaseStaleAfterMs })
    });
    const publicationLeased = await publicationLease.tryWithLease(() => execute({
      ...options,
      observedAt,
      maxRequests,
      requestIntervalMs
    }));
    return publicationLeased.acquired ? publicationLeased.value : emptyResult('lease_busy');
  });
  return leased.acquired ? leased.value : emptyResult('lease_busy');
}

async function execute(options: SeasonHydrationJobOptions & {
  observedAt: Date;
  maxRequests: number;
  requestIntervalMs: number;
}): Promise<SeasonHydrationJobResult> {
  const registry = options.registry ?? COMPETITION_SOURCE_REGISTRY;
  const pastSeasons = options.pastSeasons ?? 0;
  assertRange(pastSeasons, 0, 10, 'pastSeasons');
  if (pastSeasons > 0) {
    throw new Error('Historical-season hydration is pending and cannot be executed.');
  }
  const mode = options.mode ?? 'hydrate';
  if (mode === 'revalidate-current' && options.maxRequests > 9) {
    throw new Error('Current season revalidation is limited to nine requests per batch.');
  }
  const ledger = new SeasonHydrationLedger({
    dataRoot: options.dataRoot,
    now: () => options.observedAt
  });
  const state = await ledger.getState();
  const blockedKeys = new Set(Object.entries(state.failures)
    .filter(([, failure]) => Date.parse(failure.nextAttemptAt) > options.observedAt.getTime())
    .map(([key]) => key));
  const plan = planSeasonHydrationBatch({
    registry,
    referenceDate: options.referenceDate,
    pastSeasons,
    checkpoints: new Map(Object.entries(state.checkpoints)),
    blockedKeys,
    maxRequests: options.maxRequests,
    mode,
    observedAt: options.observedAt
  });
  if (plan.targets.length === 0) {
    return {
      ...emptyResult('idle'),
      targetsCompleted: Object.keys(state.checkpoints).length
    };
  }

  const openFootballClient = options.openFootballClient ?? new OpenFootballClient();
  const fotMobClient = options.fotMobClient ?? new FotMobSeasonClient();
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  }));
  const successes: SuccessfulTarget[] = [];
  const failures: Array<{ target: SeasonHydrationTarget; message: string; requested: boolean }> = [];
  let requestsAttempted = 0;
  let requestsSucceeded = 0;
  let requestsFailed = 0;
  let recordsIgnoredWithoutKickoff = 0;
  let recordsIgnoredLive = 0;
  let fotMobBlockedMessage: string | undefined;

  for (const [index, target] of plan.targets.entries()) {
    if (target.sourceBinding.sourceId === 'fotmob-unofficial' && fotMobBlockedMessage) {
      failures.push({
        target,
        requested: false,
        message: fotMobBlockedMessage
      });
    } else if (target.sourceBinding.sourceId === 'openfootball') {
      requestsAttempted += 1;
      try {
        const response = await openFootballClient.getSeasonMatches({
          season: target.season,
          file: target.sourceBinding.externalCompetitionId,
          ...(target.requestEtag === undefined ? {} : { etag: target.requestEtag })
        });
        if (response.status === 'not_modified') {
          if (target.intent !== 'revalidate') {
            throw new Error('Unexpected 304 for an incomplete season hydration target.');
          }
          requestsSucceeded += 1;
          successes.push({
            target,
            ...(response.etag ?? target.requestEtag
              ? { etag: response.etag ?? target.requestEtag }
              : {}),
            delta: { matches: [], teams: [], competitions: [], links: [], provenance: [] }
          });
          if (index < plan.targets.length - 1 && options.requestIntervalMs > 0) {
            await sleep(options.requestIntervalMs);
          }
          continue;
        }
        await writeRawEvidence({
          dataRoot: options.dataRoot,
          season: target.season,
          file: target.sourceBinding.externalCompetitionId,
          rawText: response.rawText
        });
        const adapted = adaptOpenFootballSeason({
          competitionEntry: target.competitionEntry,
          season: target.season,
          openFootballFile: target.sourceBinding.externalCompetitionId,
          rawPayload: response.payload,
          observedAt: options.observedAt.toISOString()
        });
        const invalid = adapted.issues.filter((issue) => issue.severity === 'invalid');
        if (invalid.length > 0) {
          throw new Error(`OpenFootball adapter rejected ${invalid.length} invalid record(s).`);
        }
        recordsIgnoredWithoutKickoff += adapted.issues.filter((issue) => (
          issue.code === 'missing_kickoff_time'
        )).length;
        requestsSucceeded += 1;
        successes.push({
          target,
          ...(response.etag === undefined ? {} : { etag: response.etag }),
          delta: {
            matches: adapted.matches,
            teams: adapted.teams,
            competitions: adapted.matches.length > 0 ? adapted.competitions : [],
            links: adapted.matches.length > 0 ? adapted.links : [],
            provenance: adapted.provenance
          }
        });
      } catch (error) {
        requestsFailed += 1;
        failures.push({ target, requested: true, message: safeMessage(error) });
      }
    } else if (target.sourceBinding.sourceId === 'fotmob-unofficial') {
      const externalCompetitionId = target.sourceBinding.externalNumericId;
      const externalCountryCode = target.sourceBinding.externalCountryCode;
      if (!Number.isSafeInteger(externalCompetitionId) || externalCompetitionId! < 1
        || !/^[A-Z]{3}$/u.test(externalCountryCode ?? '')) {
        failures.push({
          target,
          requested: false,
          message: 'FotMob season target is missing a validated competition ID or country code.'
        });
      } else {
        requestsAttempted += 1;
        try {
          const response = await fotMobClient.getSeasonMatches({
            externalCompetitionId: externalCompetitionId!,
            externalCountryCode: externalCountryCode!,
            providerSeason: target.providerSeason,
            ...(target.requestEtag === undefined ? {} : { etag: target.requestEtag })
          });
          if (response.status === 'not_modified') {
            if (target.intent !== 'revalidate') {
              throw new Error('Unexpected 304 for an incomplete season hydration target.');
            }
            requestsSucceeded += 1;
            successes.push({
              target,
              ...(response.etag ?? target.requestEtag
                ? { etag: response.etag ?? target.requestEtag }
                : {}),
              delta: { matches: [], teams: [], competitions: [], links: [], provenance: [] }
            });
            if (index < plan.targets.length - 1 && options.requestIntervalMs > 0) {
              await sleep(options.requestIntervalMs);
            }
            continue;
          }
          await writeFotMobRawEvidence({
            dataRoot: options.dataRoot,
            season: target.season,
            competitionId: target.competitionEntry.competitionId,
            rawText: response.rawText
          });
          const adapted = adaptFotMobSeason({
            competitionEntry: target.competitionEntry,
            canonicalSeason: target.season,
            expectedProviderSeason: target.providerSeason,
            externalCompetitionId: externalCompetitionId!,
            rawPayload: response.payload,
            observedAt: options.observedAt.toISOString()
          });
          const invalid = adapted.issues.filter((issue) => issue.severity === 'invalid');
          if (invalid.length > 0) {
            throw new Error(`FotMob adapter rejected ${invalid.length} invalid record(s).`);
          }
          recordsIgnoredLive += adapted.issues.filter((issue) => (
            issue.code === 'live_record_ignored'
          )).length;
          requestsSucceeded += 1;
          successes.push({
            target,
            ...(response.etag === undefined ? {} : { etag: response.etag }),
            delta: {
              matches: adapted.matches,
              teams: adapted.teams,
              competitions: adapted.matches.length > 0 ? adapted.competitions : [],
              links: adapted.matches.length > 0 ? adapted.links : [],
              provenance: adapted.provenance
            }
          });
        } catch (error) {
          requestsFailed += 1;
          if (error instanceof FotMobAccessBlockedError) {
            fotMobBlockedMessage = error.message;
          }
          failures.push({ target, requested: true, message: safeMessage(error) });
        }
      }
    } else {
      failures.push({
        target,
        requested: false,
        message: `Season source ${target.sourceBinding.sourceId} is not executable.`
      });
    }
    if (index < plan.targets.length - 1 && options.requestIntervalMs > 0) {
      await sleep(options.requestIntervalMs);
    }
  }

  let publications = 0;
  try {
    const deltasWithMatches = successes.filter((success) => success.delta.matches.length > 0);
    if (deltasWithMatches.length > 0) {
      let candidate = await loadLastGoodWarehouseSnapshot(options.dataRoot);
      for (const success of deltasWithMatches) {
        candidate = mergeCanonicalWarehouseSnapshots(candidate, success.delta);
      }
      validateCandidateReferences(candidate);
      const runId = hydrationRunId(options.observedAt);
      const warehouseRoot = await writeCanonicalWarehouseRun(options.dataRoot, runId, candidate);
      const serving = await buildServingMatchesFromWarehouse({
        warehouseRoot,
        importedAt: options.observedAt.toISOString()
      });
      await buildServingMatchStore({
        servingRoot: path.join(options.dataRoot, 'serving'),
        version: runId,
        snapshotId: runId,
        generatedAt: options.observedAt.toISOString(),
        importedAt: options.observedAt.toISOString(),
        sources: serving.sources,
        matches: serving.matches,
        warehouseRunId: runId
      });
      publications = 1;
    }
  } catch (error) {
    const message = `Season publication failed: ${safeMessage(error)}`;
    for (const success of successes) {
      failures.push({ target: success.target, requested: false, message });
    }
    successes.length = 0;
  }
  await ledger.recordBatch({
    successes: successes.map((success) => ({
      key: success.target.key,
      ...(success.etag === undefined ? {} : { etag: success.etag })
    })),
    failures: failures.map((failure) => ({
      key: failure.target.key,
      error: failure.message
    }))
  }, options.observedAt);
  const after = await ledger.getState();
  return {
    status: failures.length > 0 ? 'partial' : 'completed',
    targetsAttempted: plan.targets.length,
    targetsSucceeded: successes.length,
    targetsFailed: failures.length,
    requestsAttempted,
    requestsSucceeded,
    requestsFailed,
    publications,
    targetsCompleted: Object.keys(after.checkpoints).length,
    recordsIgnoredWithoutKickoff,
    recordsIgnoredLive,
    errors: failures.map((failure) => `${failure.target.key}: ${failure.message}`)
  };
}

async function writeRawEvidence(options: {
  dataRoot: string;
  season: string;
  file: string;
  rawText: string;
}): Promise<void> {
  if (!/^\d{4}(?:-\d{2})?$/u.test(options.season)) {
    throw new Error('Raw evidence season is unsafe.');
  }
  if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.json$/u.test(options.file)) {
    throw new Error('Raw evidence filename is unsafe.');
  }
  const directory = path.resolve(
    options.dataRoot,
    'providers',
    'openfootball',
    'raw',
    options.season,
    options.file
  );
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, 'latest.json');
  const temporary = path.join(directory, `.latest-${process.pid}-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, options.rawText, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

async function writeFotMobRawEvidence(options: {
  dataRoot: string;
  season: string;
  competitionId: string;
  rawText: string;
}): Promise<void> {
  if (!/^\d{4}(?:-\d{2})?$/u.test(options.season)) {
    throw new Error('FotMob raw evidence season is unsafe.');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(options.competitionId)) {
    throw new Error('FotMob raw evidence competition ID is unsafe.');
  }
  const directory = path.resolve(
    options.dataRoot,
    'providers',
    'fotmob-unofficial',
    'raw',
    options.season,
    options.competitionId
  );
  await writeRawTextAtomically(directory, options.rawText);
}

async function writeRawTextAtomically(directory: string, rawText: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const destination = path.join(directory, 'latest.json');
  const temporary = path.join(directory, `.latest-${process.pid}-${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, rawText, { encoding: 'utf8', flag: 'wx' });
    await rename(temporary, destination);
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

function validateCandidateReferences(candidate: CanonicalWarehouseSnapshot): void {
  const teams = new Set(candidate.teams.map((team: CanonicalTeam) => team.teamId));
  const competitions = new Set(candidate.competitions.map((item: CanonicalCompetition) => (
    item.competitionId
  )));
  const matches = new Set(candidate.matches.map((match: CanonicalMatch) => match.matchId));
  for (const match of candidate.matches) {
    if (!teams.has(match.homeTeamId) || !teams.has(match.awayTeamId)) {
      throw new Error(`Canonical match ${match.matchId} references a missing team.`);
    }
    if (!competitions.has(match.competitionId)) {
      throw new Error(`Canonical match ${match.matchId} references a missing competition.`);
    }
  }
  for (const link of candidate.links as ProviderLink[]) {
    if (link.entityType === 'match' && !matches.has(link.entityId)) {
      throw new Error(`Provider link references missing match ${link.entityId}.`);
    }
  }
  for (const provenance of candidate.provenance as FieldProvenance[]) {
    if (provenance.entityType === 'match' && !matches.has(provenance.entityId)) {
      throw new Error(`Provenance references missing match ${provenance.entityId}.`);
    }
  }
}

function hydrationRunId(observedAt: Date): string {
  return `season-hydration-${observedAt.toISOString().replace(/[^0-9]/gu, '')}-${randomUUID().slice(0, 8)}`;
}

function emptyResult(status: 'idle' | 'lease_busy'): SeasonHydrationJobResult {
  return {
    status,
    targetsAttempted: 0,
    targetsSucceeded: 0,
    targetsFailed: 0,
    requestsAttempted: 0,
    requestsSucceeded: 0,
    requestsFailed: 0,
    publications: 0,
    targetsCompleted: 0,
    recordsIgnoredWithoutKickoff: 0,
    recordsIgnoredLive: 0,
    errors: []
  };
}

function assertRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`Season hydration ${field} must be between ${min} and ${max}.`);
  }
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
