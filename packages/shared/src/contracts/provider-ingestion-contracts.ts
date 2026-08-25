import { ValidationResult, type LocalCompetitionType } from './local-match-contracts.js';
export type { ValidationResult };

export type ProviderId =
  | 'api-football'
  | 'openfootball'
  | 'manual-snapshot';

export type CanonicalMatchStatus =
  | 'scheduled'
  | 'completed'
  | 'postponed'
  | 'cancelled'
  | 'unknown';

export interface ApiFootballRawSourceMetadata {
  allowlistEntryId: string;
  leagueId: number;
  season: number;
  queryType?: 'season' | 'date' | 'live' | 'batch';
}

export interface RawProviderPayloadEnvelope {
  schemaVersion: 'miraichi.provider.raw.v1';
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  fetchedAt: string;
  payloadHash: string;
  rateLimit: { requestedEntity?: string; remaining?: number; resetsInSeconds?: number };
  source?: OpenFootballRawSourceMetadata | ApiFootballRawSourceMetadata;
  response?: RawProviderResponseMetadata;
  payload: unknown;
}

export interface OpenFootballRawSourceMetadata {
  allowlistEntryId: string;
  repository: string;
  ref: string;
  filePath: string;
}

export interface RawProviderResponseMetadata {
  etag?: string;
  lastModified?: string;
  contentType: string;
  byteCount: number;
}

export interface ProviderSourceBinding {
  allowlistEntryId: string;
  endpointKey: string;
  urlPath: string;
  source: Readonly<Record<string, string>>;
}

export interface ProviderSourceBindingPolicy {
  resolveSourceBinding(provider: ProviderId, allowlistEntryId: string): ProviderSourceBinding | undefined;
}

export type ProviderCaptureStatus =
  | 'pending'
  | 'captured'
  | 'not_modified'
  | 'invalid'
  | 'published'
  | 'skipped'
  | 'unavailable'
  | 'failed';

export interface ProviderCaptureManifestEntry {
  runId?: string;
  allowlistEntryId?: string;
  provider: ProviderId;
  endpointKey: string;
  urlPath: string;
  query: Record<string, string>;
  status: ProviderCaptureStatus;
  fetchedAt?: string;
  httpStatus?: number;
  attemptCount?: number;
  page?: number;
  hasMore?: boolean;
  payloadHash?: string;
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
  venue?: string;
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
  type: LocalCompetitionType;
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
const SHA256_HEX_REGEX = /^[a-f0-9]{64}$/;

function isValidIsoDateTime(val: unknown): boolean {
  return typeof val === 'string' && ISO_DATETIME_REGEX.test(val);
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const VALID_PROVIDER_IDS: ProviderId[] = [
  'api-football',
  'openfootball',
  'manual-snapshot'
];

const VALID_CAPTURE_STATUSES: ProviderCaptureStatus[] = [
  'pending',
  'captured',
  'not_modified',
  'invalid',
  'published',
  'skipped',
  'unavailable',
  'failed'
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

export function validateRawProviderPayloadEnvelope(
  input: unknown,
  bindingPolicy?: ProviderSourceBindingPolicy
): ValidationResult {
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

  if (typeof input.payloadHash !== 'string' || !SHA256_HEX_REGEX.test(input.payloadHash)) {
    errors.push('Field "payloadHash" must be a 64-character hex string');
  }

  if (!isObject(input.rateLimit)) {
    errors.push('Field "rateLimit" must be an object');
  }

  if ('payload' in input === false) {
    errors.push('Field "payload" is required');
  }

  if (input.provider === 'openfootball') {
    validateOpenFootballRawEnvelope(input, errors, bindingPolicy);
  } else if (input.provider === 'api-football') {
    validateApiFootballRawEnvelope(input, errors);
  }

  // Forbidden canonical top-level fields
  if ('providerFixtureId' in input) {
    errors.push('Forbidden field "providerFixtureId" is present');
  }
  if ('sourceProviderId' in input) {
    errors.push('Forbidden field "sourceProviderId" is present');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateOpenFootballRawEnvelope(
  input: Record<string, unknown>,
  errors: string[],
  bindingPolicy: ProviderSourceBindingPolicy | undefined
): void {
  if (!isObject(input.source)) {
    errors.push('Field "source" must be OpenFootball source metadata');
  } else {
    for (const field of ['allowlistEntryId', 'repository', 'ref', 'filePath'] as const) {
      if (typeof input.source[field] !== 'string' || input.source[field].trim() === '') {
        errors.push(`Field "source.${field}" must be a non-empty string`);
      }
    }
  }

  if (!isObject(input.response)) {
    errors.push('Field "response" must be raw response metadata');
  } else {
    if (typeof input.response.contentType !== 'string' || input.response.contentType.trim() === '') {
      errors.push('Field "response.contentType" must be a non-empty string');
    }
    if (!Number.isInteger(input.response.byteCount) || (input.response.byteCount as number) < 0) {
      errors.push('Field "response.byteCount" must be a non-negative integer');
    }
    for (const field of ['etag', 'lastModified'] as const) {
      if (input.response[field] !== undefined && (typeof input.response[field] !== 'string' || input.response[field].trim() === '')) {
        errors.push(`Field "response.${field}" must be a non-empty string if provided`);
      }
    }
  }

  if (!isObject(input.query) || Object.keys(input.query).length !== 0) {
    errors.push('Field "query" must be empty for openfootball');
  }
  if (typeof input.payload !== 'string') {
    errors.push('Field "payload" must be an exact source text string for openfootball');
  }

  validateOpenFootballRegistryBinding(
    input,
    isObject(input.source) ? input.source : undefined,
    errors,
    bindingPolicy
  );
}

function validateOpenFootballRegistryBinding(
  input: Record<string, unknown>,
  source: Record<string, unknown> | undefined,
  errors: string[],
  bindingPolicy: ProviderSourceBindingPolicy | undefined
): void {
  const allowlistEntryId = source?.allowlistEntryId ?? input.allowlistEntryId;
  if (typeof allowlistEntryId !== 'string' || allowlistEntryId.trim() === '') {
    return;
  }

  if (!bindingPolicy) {
    errors.push('OpenFootball source binding policy is required');
    return;
  }

  const binding = bindingPolicy.resolveSourceBinding('openfootball', allowlistEntryId);
  if (!binding || binding.allowlistEntryId !== allowlistEntryId) {
    errors.push('Field "allowlistEntryId" must reference a source binding supplied by the provider policy');
    return;
  }

  if (source) {
    for (const field of ['repository', 'ref', 'filePath'] as const) {
      if (source[field] !== binding.source[field]) {
        errors.push(`Field "source.${field}" must match its provider source binding`);
      }
    }
  }

  if (input.endpointKey !== binding.endpointKey) {
    errors.push('Field "endpointKey" must match its provider source binding');
  }

  if (input.urlPath !== binding.urlPath) {
    errors.push('Field "urlPath" must match its provider source binding');
  }
}

function validateApiFootballRawEnvelope(
  input: Record<string, unknown>,
  errors: string[]
): void {
  if (input.source !== undefined) {
    if (!isObject(input.source)) {
      errors.push('Field "source" must be ApiFootball source metadata object');
    } else {
      if (typeof input.source.allowlistEntryId !== 'string' || input.source.allowlistEntryId.trim() === '') {
        errors.push('Field "source.allowlistEntryId" must be a non-empty string');
      }
      if (typeof input.source.leagueId !== 'number' || !Number.isInteger(input.source.leagueId) || input.source.leagueId <= 0) {
        errors.push('Field "source.leagueId" must be a positive integer');
      }
      if (typeof input.source.season !== 'number' || !Number.isInteger(input.source.season) || input.source.season < 1900) {
        errors.push('Field "source.season" must be a valid year integer');
      }
    }
  }
}

export function validateProviderCaptureManifestEntry(
  input: unknown,
  bindingPolicy?: ProviderSourceBindingPolicy
): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
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
  if (!VALID_CAPTURE_STATUSES.includes(input.status as ProviderCaptureStatus)) {
    errors.push(`Field "status" must be one of: ${VALID_CAPTURE_STATUSES.join(', ')}`);
  }
  if (input.runId !== undefined && (typeof input.runId !== 'string' || input.runId.trim() === '')) {
    errors.push('Field "runId" must be a non-empty string if provided');
  }
  if (input.allowlistEntryId !== undefined && (typeof input.allowlistEntryId !== 'string' || input.allowlistEntryId.trim() === '')) {
    errors.push('Field "allowlistEntryId" must be a non-empty string if provided');
  }
  if (input.fetchedAt !== undefined && !isValidIsoDateTime(input.fetchedAt)) {
    errors.push('Field "fetchedAt" must be a valid ISO datetime string if provided');
  }
  if (input.httpStatus !== undefined && (!Number.isInteger(input.httpStatus) || (input.httpStatus as number) < 100 || (input.httpStatus as number) > 599)) {
    errors.push('Field "httpStatus" must be an integer from 100 through 599 if provided');
  }
  if (input.attemptCount !== undefined && (!Number.isInteger(input.attemptCount) || (input.attemptCount as number) < 1)) {
    errors.push('Field "attemptCount" must be an integer of at least 1 if provided');
  }
  if (input.page !== undefined && (!Number.isInteger(input.page) || (input.page as number) < 1)) {
    errors.push('Field "page" must be an integer of at least 1 if provided');
  }
  if (input.hasMore !== undefined && typeof input.hasMore !== 'boolean') {
    errors.push('Field "hasMore" must be a boolean if provided');
  }
  if (input.payloadHash !== undefined && (typeof input.payloadHash !== 'string' || !SHA256_HEX_REGEX.test(input.payloadHash))) {
    errors.push('Field "payloadHash" must be a 64-character hex string if provided');
  }
  if (input.recordCount !== undefined && (!Number.isInteger(input.recordCount) || (input.recordCount as number) < 0)) {
    errors.push('Field "recordCount" must be a non-negative integer if provided');
  }
  for (const field of ['errorCode', 'errorMessage'] as const) {
    if (input[field] !== undefined && (typeof input[field] !== 'string' || input[field].trim() === '')) {
      errors.push(`Field "${field}" must be a non-empty string if provided`);
    }
  }

  if (input.provider === 'openfootball') {
    if (typeof input.runId !== 'string' || input.runId.trim() === '') {
      errors.push('Field "runId" is required for openfootball');
    }
    if (typeof input.allowlistEntryId !== 'string' || input.allowlistEntryId.trim() === '') {
      errors.push('Field "allowlistEntryId" is required for openfootball');
    }
    if (!isValidIsoDateTime(input.fetchedAt)) {
      errors.push('Field "fetchedAt" is required for openfootball');
    }
    if (!isObject(input.query) || Object.keys(input.query).length !== 0) {
      errors.push('Field "query" must be empty for openfootball');
    }
    validateOpenFootballRegistryBinding(input, undefined, errors, bindingPolicy);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateCanonicalMatch(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  // Forbidden fields
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

  if (input.venue !== undefined && typeof input.venue !== 'string') {
    errors.push('Field "venue" must be a string if provided');
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
  if (typeof input.valueHash !== 'string' || !SHA256_HEX_REGEX.test(input.valueHash)) {
    errors.push('Field "valueHash" must be a 64-character hex string');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
