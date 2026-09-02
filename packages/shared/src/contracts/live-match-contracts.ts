import type { LocalDataSourceId } from './local-match-contracts.js';

export type LiveMatchStatus = 'live' | 'halftime' | 'suspended' | 'completed';
export type LiveMatchPeriod = 'first_half' | 'second_half' | 'extra_time' | 'penalties' | 'unknown';
export type LiveRefreshReason = 'visible' | 'manual' | 'hourly';
export type LiveRefreshErrorCode =
  | 'upstream_timeout'
  | 'upstream_unavailable'
  | 'upstream_contract_invalid'
  | 'persistence_unavailable'
  | 'internal_error';

export interface LiveMatchSourceRef {
  sourceId: LocalDataSourceId;
  sourceMatchId?: string;
  sourceUrl?: string;
  observedAt: string;
}

export interface LiveMatchOverlay {
  matchId: string;
  competition: { id: string; name: string };
  kickoffUtc: string;
  homeTeam: { id: string; name: string };
  awayTeam: { id: string; name: string };
  status: LiveMatchStatus;
  period: LiveMatchPeriod | null;
  elapsedMinute: number | null;
  score: { home: number; away: number };
  sourceRefs: LiveMatchSourceRef[];
  updatedAt: string;
}

export interface LiveMatchSnapshot {
  schemaVersion: 'miraichi.live-match-snapshot.v1';
  snapshotId: string;
  generatedAt: string;
  coverage: {
    kind: 'global-recent-window';
    upstreamLimit: number;
    upstreamCount: number;
    mappedCount: number;
  };
  matches: LiveMatchOverlay[];
  warnings: string[];
}

export interface PublicLiveMatchSourceRef {
  sourceId: LocalDataSourceId;
  observedAt: string;
}

export interface PublicLiveMatchOverlay extends Omit<LiveMatchOverlay, 'sourceRefs'> {
  sourceRefs: PublicLiveMatchSourceRef[];
}

export interface PublicLiveMatchSnapshot extends Omit<LiveMatchSnapshot, 'matches'> {
  matches: PublicLiveMatchOverlay[];
}

export interface LiveRefreshLease {
  leaseId: string;
  acquiredAt: string;
  expiresAt: string;
}

export interface AcquireLiveRefreshLeaseInput extends LiveRefreshLease {
  reason: LiveRefreshReason;
}

export interface LiveRefreshState {
  status: 'running' | 'succeeded' | 'failed';
  reason: LiveRefreshReason;
  lastAttemptAt: string;
  lastSuccessAt: string | null;
  lastCompletedAt: string | null;
  lastErrorCode: LiveRefreshErrorCode | null;
  lease: LiveRefreshLease | null;
}

export type FinishLiveRefreshInput =
  | { leaseId: string; outcome: 'succeeded'; completedAt: string; snapshot: LiveMatchSnapshot }
  | { leaseId: string; outcome: 'failed'; completedAt: string; errorCode: LiveRefreshErrorCode };

export type LiveMatchValidationResult = { ok: true } | { ok: false; errors: string[] };

const VALID_SOURCE_IDS = new Set<LocalDataSourceId>(['sportscore', 'openfootball', 'fotmob-unofficial', 'manual-snapshot']);
const VALID_STATUSES = new Set<LiveMatchStatus>(['live', 'halftime', 'suspended', 'completed']);
const VALID_PERIODS = new Set<LiveMatchPeriod>(['first_half', 'second_half', 'extra_time', 'penalties', 'unknown']);
const VALID_REFRESH_ERRORS = new Set<LiveRefreshErrorCode>([
  'upstream_timeout',
  'upstream_unavailable',
  'upstream_contract_invalid',
  'persistence_unavailable',
  'internal_error'
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    && !Number.isNaN(Date.parse(value));
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isHttpsUrl(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function validateIdentity(value: unknown, path: string, errors: string[]): void {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isNonEmptyString(value.name)) {
    errors.push(`${path} must contain non-empty canonical id and name`);
  }
}

function validateMatch(value: unknown, index: number, errors: string[]): void {
  const prefix = `matches[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${prefix} must be an object`);
    return;
  }
  for (const forbidden of ['sourceProviderId', 'providerFixtureId', 'externalCompetitionId']) {
    if (forbidden in value) errors.push(`${prefix}.${forbidden} is forbidden in canonical live fields`);
  }
  if (!isNonEmptyString(value.matchId)) errors.push(`${prefix}.matchId must be non-empty`);
  validateIdentity(value.competition, `${prefix}.competition`, errors);
  validateIdentity(value.homeTeam, `${prefix}.homeTeam`, errors);
  validateIdentity(value.awayTeam, `${prefix}.awayTeam`, errors);
  if (!isIsoDateTime(value.kickoffUtc)) errors.push(`${prefix}.kickoffUtc must be ISO datetime`);
  if (!isIsoDateTime(value.updatedAt)) errors.push(`${prefix}.updatedAt must be ISO datetime`);
  if (!VALID_STATUSES.has(value.status as LiveMatchStatus)) errors.push(`${prefix}.status is invalid`);
  if (value.period !== null && !VALID_PERIODS.has(value.period as LiveMatchPeriod)) errors.push(`${prefix}.period is invalid`);
  if (value.elapsedMinute !== null && (!Number.isInteger(value.elapsedMinute) || Number(value.elapsedMinute) < 0)) {
    errors.push(`${prefix}.elapsedMinute must be a non-negative integer or null`);
  }
  if (value.status === 'completed' && (value.elapsedMinute !== null || value.period !== null)) {
    errors.push(`${prefix} completed status must clear live period and minute`);
  }
  if (!isRecord(value.score)
    || !Number.isInteger(value.score.home) || Number(value.score.home) < 0
    || !Number.isInteger(value.score.away) || Number(value.score.away) < 0) {
    errors.push(`${prefix}.score must contain non-negative integer values`);
  }
  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0) {
    errors.push(`${prefix}.sourceRefs must contain evidence`);
  } else {
    value.sourceRefs.forEach((source, sourceIndex) => {
      if (!isRecord(source)
        || !VALID_SOURCE_IDS.has(source.sourceId as LocalDataSourceId)
        || !isIsoDateTime(source.observedAt)
        || (source.sourceMatchId !== undefined && !isNonEmptyString(source.sourceMatchId))
        || (source.sourceUrl !== undefined && !isHttpsUrl(source.sourceUrl))) {
        errors.push(`${prefix}.sourceRefs[${sourceIndex}] is invalid`);
      }
    });
  }
}

export function validateLiveMatchSnapshot(input: unknown): LiveMatchValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { ok: false, errors: ['snapshot must be an object'] };
  if (input.schemaVersion !== 'miraichi.live-match-snapshot.v1') errors.push('schemaVersion is invalid');
  if (!isNonEmptyString(input.snapshotId)) errors.push('snapshotId must be non-empty');
  if (!isIsoDateTime(input.generatedAt)) errors.push('generatedAt must be ISO datetime');
  if (!isRecord(input.coverage) || input.coverage.kind !== 'global-recent-window') {
    errors.push('coverage is invalid');
  } else {
    const { upstreamLimit, upstreamCount, mappedCount } = input.coverage;
    if (!Number.isInteger(upstreamLimit) || Number(upstreamLimit) < 1
      || !Number.isInteger(upstreamCount) || Number(upstreamCount) < 0 || Number(upstreamCount) > Number(upstreamLimit)
      || !Number.isInteger(mappedCount) || Number(mappedCount) < 0 || Number(mappedCount) > Number(upstreamCount)) {
      errors.push('coverage counts are invalid');
    }
  }
  if (!Array.isArray(input.matches)) {
    errors.push('matches must be an array');
  } else {
    input.matches.forEach((match, index) => validateMatch(match, index, errors));
    const ids = input.matches.filter(isRecord).map((match) => match.matchId).filter(isNonEmptyString);
    if (new Set(ids).size !== ids.length) errors.push('matches must use unique matchId values');
    if (isRecord(input.coverage) && input.coverage.mappedCount !== input.matches.length) errors.push('coverage.mappedCount must equal matches length');
  }
  if (!Array.isArray(input.warnings) || input.warnings.some((warning) => !isNonEmptyString(warning))) {
    errors.push('warnings must be non-empty strings');
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function toProviderNeutralLiveMatchSnapshot(snapshot: LiveMatchSnapshot): PublicLiveMatchSnapshot {
  return {
    ...structuredClone(snapshot),
    matches: snapshot.matches.map((match) => ({
      ...structuredClone(match),
      sourceRefs: match.sourceRefs.map(({ sourceId, observedAt }) => ({ sourceId, observedAt }))
    }))
  };
}

export function sanitizeLiveRefreshErrorCode(value: unknown): LiveRefreshErrorCode {
  return VALID_REFRESH_ERRORS.has(value as LiveRefreshErrorCode) ? value as LiveRefreshErrorCode : 'internal_error';
}

export function assertValidLiveMatchSnapshot(snapshot: LiveMatchSnapshot): void {
  const result = validateLiveMatchSnapshot(snapshot);
  if (!result.ok) throw new Error(`Invalid live match snapshot: ${result.errors.join('; ')}`);
}
