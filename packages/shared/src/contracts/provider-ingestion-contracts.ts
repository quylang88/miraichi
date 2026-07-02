import { ValidationResult } from './local-match-contracts.js';
export type { ValidationResult };

export type ProviderId =
  | 'sportmonks'
  | 'football-data-org'
  | 'manual-snapshot';

export type CanonicalMatchStatus =
  | 'scheduled'
  | 'completed'
  | 'postponed'
  | 'cancelled'
  | 'unknown';

export interface RawProviderPayloadEnvelope {
  schemaVersion: 'miraichi.provider.raw.v1';
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  fetchedAt: string;
  payloadHash: string;
  rateLimit: { requestedEntity?: string; remaining?: number; resetsInSeconds?: number };
  payload: unknown;
}

export interface ProviderCaptureManifestEntry {
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  status: 'pending' | 'captured' | 'skipped' | 'forbidden' | 'unavailable' | 'failed';
  page?: number;
  hasMore?: boolean;
  payloadHash?: string;
  fetchedAt?: string;
  recordCount?: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface CanonicalMatch {
  matchId: string;
  competitionId: string;
  season: string;
  kickoffUtc: string;
  status: CanonicalMatchStatus;
  homeTeamId: string;
  awayTeamId: string;
  scoreHome: number | null;
  scoreAway: number | null;
  venueId?: string;
  round?: string;
  stage?: string;
  neutralVenue?: boolean;
  updatedAt: string;
}

export interface CanonicalTeam {
  teamId: string;
  name: string;
  countryCode?: string;
  updatedAt: string;
}

export interface CanonicalCompetition {
  competitionId: string;
  name: string;
  type: 'national-team';
  updatedAt: string;
}

export interface ProviderLink {
  entityType: 'match' | 'team' | 'competition' | 'event' | 'stat';
  entityId: string;
  provider: ProviderId;
  providerEntityType: string;
  providerEntityId: string;
  confidence: number;
  linkedBy: string;
  linkedAt: string;
}

export interface CanonicalMatchEvent {
  eventId: string;
  matchId: string;
  eventType: 'goal' | 'card' | 'substitution' | 'penalty' | 'other';
  minute: number | null;
  stoppageMinute?: number | null;
  teamId?: string;
  playerName?: string;
  label: string;
  occurredAtKnown: boolean;
}

export interface CanonicalMatchTeamStat {
  statId: string;
  matchId: string;
  teamId: string;
  statType: string;
  value: number | string | boolean | null;
}

export interface FieldProvenance {
  entityType: 'match' | 'team' | 'competition' | 'event' | 'stat';
  entityId: string;
  fieldPath: string;
  provider: ProviderId;
  providerEntityId: string;
  observedAt: string;
  confidence: number;
  valueHash: string;
}

export interface SourceConflict {
  conflictId: string;
  entityType: FieldProvenance['entityType'];
  entityId: string;
  fieldPath: string;
  competingProviders: ProviderId[];
  chosenProvider?: ProviderId;
  resolutionReason?: string;
  detectedAt: string;
}

// ValidationResult is imported from local-match-contracts and re-exported above.

// ─── Validation helpers ───────────────────────────────────────────────────────

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isValidIsoDateTime(val: unknown): boolean {
  return typeof val === 'string' && ISO_DATETIME_REGEX.test(val);
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const VALID_PROVIDER_IDS: ProviderId[] = [
  'sportmonks',
  'football-data-org',
  'manual-snapshot'
];

const VALID_CANONICAL_STATUSES: CanonicalMatchStatus[] = [
  'scheduled',
  'completed',
  'postponed',
  'cancelled',
  'unknown'
];

const VALID_ENTITY_TYPES = ['match', 'team', 'competition', 'event', 'stat'] as const;

// ─── Validators ───────────────────────────────────────────────────────────────

export function validateRawProviderPayloadEnvelope(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  if (input.schemaVersion !== 'miraichi.provider.raw.v1') {
    errors.push('Field "schemaVersion" must be "miraichi.provider.raw.v1"');
  }

  if (!VALID_PROVIDER_IDS.includes(input.provider as ProviderId)) {
    errors.push(`Field "provider" must be one of: ${VALID_PROVIDER_IDS.join(', ')}`);
  }

  if (typeof input.endpointKey !== 'string' || input.endpointKey.trim() === '') {
    errors.push('Field "endpointKey" must be a non-empty string');
  }

  if (typeof input.urlPath !== 'string' || input.urlPath.trim() === '') {
    errors.push('Field "urlPath" must be a non-empty string');
  }

  if (!isObject(input.query)) {
    errors.push('Field "query" must be an object');
  }

  if (!isValidIsoDateTime(input.fetchedAt)) {
    errors.push('Field "fetchedAt" must be a valid ISO datetime string');
  }

  if (typeof input.payloadHash !== 'string' || input.payloadHash.length !== 64) {
    errors.push('Field "payloadHash" must be a 64-character hex string');
  }

  if (!isObject(input.rateLimit)) {
    errors.push('Field "rateLimit" must be an object');
  }

  if ('payload' in input === false) {
    errors.push('Field "payload" is required');
  }

  // Forbidden canonical top-level fields
  if ('sportmonksFixtureId' in input) {
    errors.push('Forbidden field "sportmonksFixtureId" is present');
  }
  if ('providerFixtureId' in input) {
    errors.push('Forbidden field "providerFixtureId" is present');
  }
  if ('sourceProviderId' in input) {
    errors.push('Forbidden field "sourceProviderId" is present');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateCanonicalMatch(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  // Forbidden fields
  if ('sportmonksFixtureId' in input) {
    errors.push('Forbidden field "sportmonksFixtureId" is present');
  }
  if ('providerFixtureId' in input) {
    errors.push('Forbidden field "providerFixtureId" is present');
  }
  if ('sourceProviderId' in input) {
    errors.push('Forbidden field "sourceProviderId" is present');
  }

  if (typeof input.matchId !== 'string' || input.matchId.trim() === '') {
    errors.push('Field "matchId" must be a non-empty string');
  }
  if (typeof input.competitionId !== 'string' || input.competitionId.trim() === '') {
    errors.push('Field "competitionId" must be a non-empty string');
  }
  if (typeof input.season !== 'string' || input.season.trim() === '') {
    errors.push('Field "season" must be a non-empty string');
  }
  if (!isValidIsoDateTime(input.kickoffUtc)) {
    errors.push('Field "kickoffUtc" must be a valid ISO datetime string');
  }
  if (!VALID_CANONICAL_STATUSES.includes(input.status as CanonicalMatchStatus)) {
    errors.push(`Field "status" must be one of: ${VALID_CANONICAL_STATUSES.join(', ')}`);
  }
  if (typeof input.homeTeamId !== 'string' || input.homeTeamId.trim() === '') {
    errors.push('Field "homeTeamId" must be a non-empty string');
  }
  if (typeof input.awayTeamId !== 'string' || input.awayTeamId.trim() === '') {
    errors.push('Field "awayTeamId" must be a non-empty string');
  }

  const scoreHome = input.scoreHome;
  if (scoreHome !== null && (typeof scoreHome !== 'number' || !Number.isInteger(scoreHome) || scoreHome < 0)) {
    errors.push('Field "scoreHome" must be a non-negative integer or null');
  }
  const scoreAway = input.scoreAway;
  if (scoreAway !== null && (typeof scoreAway !== 'number' || !Number.isInteger(scoreAway) || scoreAway < 0)) {
    errors.push('Field "scoreAway" must be a non-negative integer or null');
  }

  if (!isValidIsoDateTime(input.updatedAt)) {
    errors.push('Field "updatedAt" must be a valid ISO datetime string');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateProviderLink(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  if (!VALID_ENTITY_TYPES.includes(input.entityType as typeof VALID_ENTITY_TYPES[number])) {
    errors.push(`Field "entityType" must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
  }
  if (typeof input.entityId !== 'string' || input.entityId.trim() === '') {
    errors.push('Field "entityId" must be a non-empty string');
  }
  if (!VALID_PROVIDER_IDS.includes(input.provider as ProviderId)) {
    errors.push(`Field "provider" must be one of: ${VALID_PROVIDER_IDS.join(', ')}`);
  }
  if (typeof input.providerEntityType !== 'string' || input.providerEntityType.trim() === '') {
    errors.push('Field "providerEntityType" must be a non-empty string');
  }
  if (typeof input.providerEntityId !== 'string' || input.providerEntityId.trim() === '') {
    errors.push('Field "providerEntityId" must be a non-empty string');
  }
  if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
    errors.push('Field "confidence" must be a number between 0 and 1');
  }
  if (typeof input.linkedBy !== 'string' || input.linkedBy.trim() === '') {
    errors.push('Field "linkedBy" must be a non-empty string');
  }
  if (!isValidIsoDateTime(input.linkedAt)) {
    errors.push('Field "linkedAt" must be a valid ISO datetime string');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateFieldProvenance(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  if (!VALID_ENTITY_TYPES.includes(input.entityType as typeof VALID_ENTITY_TYPES[number])) {
    errors.push(`Field "entityType" must be one of: ${VALID_ENTITY_TYPES.join(', ')}`);
  }
  if (typeof input.entityId !== 'string' || input.entityId.trim() === '') {
    errors.push('Field "entityId" must be a non-empty string');
  }
  if (typeof input.fieldPath !== 'string' || input.fieldPath.trim() === '') {
    errors.push('Field "fieldPath" must be a non-empty string');
  }
  if (!VALID_PROVIDER_IDS.includes(input.provider as ProviderId)) {
    errors.push(`Field "provider" must be one of: ${VALID_PROVIDER_IDS.join(', ')}`);
  }
  if (typeof input.providerEntityId !== 'string' || input.providerEntityId.trim() === '') {
    errors.push('Field "providerEntityId" must be a non-empty string');
  }
  if (!isValidIsoDateTime(input.observedAt)) {
    errors.push('Field "observedAt" must be a valid ISO datetime string');
  }
  if (typeof input.confidence !== 'number' || input.confidence < 0 || input.confidence > 1) {
    errors.push('Field "confidence" must be a number between 0 and 1');
  }
  if (typeof input.valueHash !== 'string' || input.valueHash.length !== 64) {
    errors.push('Field "valueHash" must be a 64-character hex string');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
