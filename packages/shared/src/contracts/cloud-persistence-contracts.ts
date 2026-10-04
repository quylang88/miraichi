import type { AddBetDraft } from './add-bet-draft-contracts.js';
import type { LocalMatch, LocalMatchSourceRef } from './local-match-contracts.js';
import type {
  BetSettlementEvent, DisciplineChallenge, DisciplineConfig, DisciplineSnapshot,
  AutomaticSettlementReviewReason, PlanAdherence, PreBetEmotion, PreBetMotivation, SettlementReviewStatus, SettlementType
} from './core-betting-contracts.js';
import { AUTOMATIC_SETTLEMENT_REVIEW_REASONS, SETTLEMENT_REVIEW_STATUSES } from './core-betting-contracts.js';
import type {
  LiveContextSource, MarketPeriod, RunningWindow, RunningGoalThreshold, SelectionCode
} from './structured-bet-selection.js';

export type CloudPersistenceMode = 'disabled' | 'memory' | 'supabase';
export type CloudPersistenceState = 'unconfigured' | 'ready' | 'unavailable';
export type CloudValidationResult = { ok: true } | { ok: false; errors: string[] };

export interface CloudPersistenceStatus {
  provider: 'supabase-postgres';
  mode: CloudPersistenceMode;
  state: CloudPersistenceState;
  checkedAt: string;
  message?: string;
}

export interface CloudBetRecord {
  betId: string; ownerProfileId: string; matchGroupId: string; matchId?: string | null;
  homeTeamName: string; awayTeamName: string; competitionLabel?: string; seasonLabel?: string;
  marketType: '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom' | 'running';
  customMarketLabel?: string; selectionLabel: string; selectionCode?: SelectionCode;
  marketPeriod?: MarketPeriod; lineValue?: number | null; runningWindow?: RunningWindow;
  runningGoalThreshold?: RunningGoalThreshold;
  windowStartMinute?: number; windowEndMinute?: number;
  liveScoreHome?: number; liveScoreAway?: number; liveMinute?: number;
  liveContextSource?: LiveContextSource; liveContextObservedAt?: string;
  oddsFormat: 'HK'; oddsValue: number; stakePoints: number;
  status: 'pending' | 'settled' | 'void'; settlementNote?: string;
  manualResultPoints?: number | null; notes?: string; tags?: readonly string[];
  bankrollAccountId?: string | null;
  preBetEmotion?: PreBetEmotion; preBetMotivation?: PreBetMotivation; preBetPlanAdherence?: PlanAdherence; preBetNote?: string;
  disciplineSnapshot?: DisciplineSnapshot;
  settlementType?: SettlementType; profitLossPoints?: number | null; settledAt?: string;
  settlementReviewStatus?: SettlementReviewStatus; settlementReviewReason?: AutomaticSettlementReviewReason;
  settlementEvidenceAt?: string;
  postBetPlanAdherence?: PlanAdherence; postBetLessonNote?: string;
  createdAt: string; updatedAt: string;
}

export interface CloudMatchSnapshot {
  snapshotId: string; generatedAt: string; importedAt: string;
  sources: LocalMatchSourceRef[]; matches: LocalMatch[];
}

export interface BankrollAccount {
  accountId: string; ownerProfileId: string; label: string; unit: 'points';
  openingBalancePoints: number; currentBalancePoints: number; archived: boolean;
  createdAt: string; updatedAt: string;
}

export type BankrollLedgerEntryType = 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'correction' | 'bet_settlement' | 'bet_settlement_correction';

export interface BankrollLedgerEntry {
  entryId: string; ownerProfileId: string; accountId: string;
  entryType: BankrollLedgerEntryType; amountPoints: number; note?: string;
  transferId?: string; betId?: string; settlementEventId?: string; effectiveAt?: string;
  occurredAt: string; createdAt: string;
}

export interface CreateBankrollAccountInput {
  accountId: string; ownerProfileId: string; label: string; openingBalancePoints: number;
}
export interface UpdateBankrollAccountInput {
  accountId: string; ownerProfileId: string; label?: string; archived?: boolean;
}
export interface CreateBankrollLedgerEntryInput {
  entryId: string; ownerProfileId: string; accountId: string; entryType: BankrollLedgerEntryType;
  amountPoints: number; note?: string; transferId?: string; betId?: string; settlementEventId?: string; effectiveAt?: string; occurredAt: string;
}

export interface CreateBankrollTransferInput {
  transferId: string; ownerProfileId: string; fromAccountId: string; toAccountId: string;
  amountPoints: number; note?: string; occurredAt: string;
}

export interface ApplyBetSettlementInput {
  record: CloudBetRecord;
  event: BetSettlementEvent;
  ledgerEntry: CreateBankrollLedgerEntryInput;
}

export interface MarkBetSettlementManualReviewInput {
  ownerProfileId: string;
  betId: string;
  reason: AutomaticSettlementReviewReason;
  evidenceAt: string;
  updatedAt: string;
}

export interface ApplyBetSettlementResult {
  record: CloudBetRecord; event: BetSettlementEvent; ledgerEntry: BankrollLedgerEntry; account: BankrollAccount;
}

export interface BankrollTransferResult {
  fromAccount: BankrollAccount; toAccount: BankrollAccount;
  outEntry: BankrollLedgerEntry; inEntry: BankrollLedgerEntry;
}

export interface CloudBackupEnvelopeV1 {
  schemaVersion: 'miraichi.cloud-backup.v1'; exportedAt: string; ownerProfileId: string;
  drafts: AddBetDraft[]; bets: CloudBetRecord[]; bankrollAccounts: BankrollAccount[];
  bankrollLedgerEntries: BankrollLedgerEntry[];
}

export interface CloudBackupEnvelopeV2 {
  schemaVersion: 'miraichi.cloud-backup.v2'; exportedAt: string; ownerProfileId: string;
  drafts: AddBetDraft[]; bets: CloudBetRecord[]; bankrollAccounts: BankrollAccount[];
  bankrollLedgerEntries: BankrollLedgerEntry[]; disciplineConfigs: DisciplineConfig[];
  settlementEvents: BetSettlementEvent[];
}

export interface OwnerProfileBackup {
  ownerProfileId: string;
  label: string;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CloudBackupRecordCounts {
  ownerProfiles: 0 | 1;
  betDrafts: number;
  bets: number;
  bankrollAccounts: number;
  bankrollLedgerEntries: number;
  disciplineConfigs: number;
  settlementEvents: number;
}

export interface CloudBackupEnvelopeV3 {
  schemaVersion: 'miraichi.cloud-backup.v3';
  exportedAt: string;
  ownerProfileId: string;
  ownerProfile: OwnerProfileBackup | null;
  drafts: AddBetDraft[];
  bets: CloudBetRecord[];
  bankrollAccounts: BankrollAccount[];
  bankrollLedgerEntries: BankrollLedgerEntry[];
  disciplineConfigs: DisciplineConfig[];
  settlementEvents: BetSettlementEvent[];
  recordCounts: CloudBackupRecordCounts;
  payloadSha256: string;
}

export type CreateCloudBackupEnvelopeV3Input = Omit<
  CloudBackupEnvelopeV3,
  'schemaVersion' | 'recordCounts' | 'payloadSha256'
>;

export type CloudBackupEnvelope = CloudBackupEnvelopeV1 | CloudBackupEnvelopeV2 | CloudBackupEnvelopeV3;

export interface BackupExportReceipt {
  exportId: string; ownerProfileId: string; schemaVersion: CloudBackupEnvelope['schemaVersion'];
  exportedAt: string; sha256: string;
  recordCounts: { ownerProfiles?: 0 | 1; betDrafts: number; bets: number; bankrollAccounts: number; bankrollLedgerEntries: number; disciplineConfigs?: number; settlementEvents?: number };
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Backup payload contains a non-finite number');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObject(value)) {
    const entries = Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
  }
  throw new Error('Backup payload contains a non-JSON value');
}

function assertUniqueIds<T>(values: readonly T[], idFor: (value: T) => string, label: string): void {
  const ids = new Set<string>();
  for (const value of values) {
    const id = idFor(value);
    if (ids.has(id)) throw new Error(`Backup contains duplicate ${label} ID: ${id}`);
    ids.add(id);
  }
}

function orderSettlementEvents(events: readonly BetSettlementEvent[]): BetSettlementEvent[] {
  const byId = new Map(events.map((event) => [event.settlementEventId, event]));
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const ordered: BetSettlementEvent[] = [];

  const visit = (event: BetSettlementEvent): void => {
    if (visited.has(event.settlementEventId)) return;
    if (visiting.has(event.settlementEventId)) {
      throw new Error(`Backup settlement correction cycle at: ${event.settlementEventId}`);
    }
    visiting.add(event.settlementEventId);
    if (event.correctsSettlementEventId) {
      const corrected = byId.get(event.correctsSettlementEventId);
      if (!corrected) throw new Error(`Backup settlement event references unknown correction target: ${event.correctsSettlementEventId}`);
      visit(corrected);
    }
    visiting.delete(event.settlementEventId);
    visited.add(event.settlementEventId);
    ordered.push(event);
  };

  for (const event of [...events].sort((left, right) => left.settlementEventId.localeCompare(right.settlementEventId))) {
    visit(event);
  }
  return ordered;
}

function normalizeV3Payload(input: CreateCloudBackupEnvelopeV3Input): CreateCloudBackupEnvelopeV3Input {
  return {
    exportedAt: input.exportedAt,
    ownerProfileId: input.ownerProfileId,
    ownerProfile: input.ownerProfile ? structuredClone(input.ownerProfile) : null,
    drafts: [...input.drafts].sort((left, right) => left.draftId.localeCompare(right.draftId)),
    bets: [...input.bets].sort((left, right) => left.betId.localeCompare(right.betId)),
    bankrollAccounts: [...input.bankrollAccounts].sort((left, right) => left.accountId.localeCompare(right.accountId)),
    bankrollLedgerEntries: [...input.bankrollLedgerEntries].sort((left, right) => left.entryId.localeCompare(right.entryId)),
    disciplineConfigs: [...input.disciplineConfigs].sort((left, right) => left.ownerProfileId.localeCompare(right.ownerProfileId)),
    settlementEvents: orderSettlementEvents(input.settlementEvents)
  };
}

function countsFor(input: CreateCloudBackupEnvelopeV3Input): CloudBackupRecordCounts {
  return {
    ownerProfiles: input.ownerProfile ? 1 : 0,
    betDrafts: input.drafts.length,
    bets: input.bets.length,
    bankrollAccounts: input.bankrollAccounts.length,
    bankrollLedgerEntries: input.bankrollLedgerEntries.length,
    disciplineConfigs: input.disciplineConfigs.length,
    settlementEvents: input.settlementEvents.length
  };
}

function assertV3OwnerBoundary(input: CreateCloudBackupEnvelopeV3Input): void {
  if (!hasText(input.ownerProfileId)) throw new Error('Backup owner profile ID is required');
  const durableCount = input.drafts.length + input.bets.length + input.bankrollAccounts.length
    + input.bankrollLedgerEntries.length + input.disciplineConfigs.length + input.settlementEvents.length;
  if (!input.ownerProfile && durableCount > 0) throw new Error('Backup owner profile is required for durable owner data');
  if (input.ownerProfile) {
    if (input.ownerProfile.ownerProfileId !== input.ownerProfileId) throw new Error('Backup owner profile mismatch');
    if (!hasText(input.ownerProfile.label) || !ISO.test(input.ownerProfile.createdAt) || !ISO.test(input.ownerProfile.updatedAt)
      || !isObject(input.ownerProfile.settings)) throw new Error('Backup owner profile is invalid');
  }
  for (const owned of [...input.bets, ...input.bankrollAccounts, ...input.bankrollLedgerEntries,
    ...input.disciplineConfigs, ...input.settlementEvents]) {
    if (owned.ownerProfileId !== input.ownerProfileId) throw new Error('Backup collection owner mismatch');
  }

  assertUniqueIds(input.drafts, (draft) => draft.draftId, 'draft');
  assertUniqueIds(input.bets, (bet) => bet.betId, 'bet');
  assertUniqueIds(input.bankrollAccounts, (account) => account.accountId, 'bankroll account');
  assertUniqueIds(input.bankrollLedgerEntries, (entry) => entry.entryId, 'bankroll ledger entry');
  assertUniqueIds(input.disciplineConfigs, (config) => config.ownerProfileId, 'discipline config');
  assertUniqueIds(input.settlementEvents, (event) => event.settlementEventId, 'settlement event');

  const accountIds = new Set(input.bankrollAccounts.map((account) => account.accountId));
  const betIds = new Set(input.bets.map((bet) => bet.betId));
  const settlementEventIds = new Set(input.settlementEvents.map((event) => event.settlementEventId));
  for (const bet of input.bets) {
    if (bet.bankrollAccountId && !accountIds.has(bet.bankrollAccountId)) {
      throw new Error(`Backup bet references unknown bankroll account: ${bet.bankrollAccountId}`);
    }
  }
  for (const entry of input.bankrollLedgerEntries) {
    if (!accountIds.has(entry.accountId)) throw new Error(`Backup ledger entry references unknown bankroll account: ${entry.accountId}`);
    if (entry.betId && !betIds.has(entry.betId)) throw new Error(`Backup ledger entry references unknown bet: ${entry.betId}`);
    if (entry.settlementEventId && !settlementEventIds.has(entry.settlementEventId)) {
      throw new Error(`Backup ledger entry references unknown settlement event: ${entry.settlementEventId}`);
    }
  }
  for (const event of input.settlementEvents) {
    if (!betIds.has(event.betId)) throw new Error(`Backup settlement event references unknown bet: ${event.betId}`);
    if (!accountIds.has(event.bankrollAccountId)) {
      throw new Error(`Backup settlement event references unknown bankroll account: ${event.bankrollAccountId}`);
    }
  }
  orderSettlementEvents(input.settlementEvents);
}

async function sha256Utf8(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function canonicalCloudBackupV3Payload(envelope: CloudBackupEnvelopeV3): string {
  const { schemaVersion: _schemaVersion, recordCounts: _recordCounts, payloadSha256: _payloadSha256, ...input } = envelope;
  const normalized = normalizeV3Payload(input);
  return canonicalJson({
    schemaVersion: 'miraichi.cloud-backup.v3',
    ...normalized,
    recordCounts: countsFor(normalized)
  });
}

export async function createCloudBackupEnvelopeV3(
  input: CreateCloudBackupEnvelopeV3Input
): Promise<CloudBackupEnvelopeV3> {
  assertV3OwnerBoundary(input);
  const normalized = normalizeV3Payload(input);
  const withoutHash = {
    schemaVersion: 'miraichi.cloud-backup.v3' as const,
    ...normalized,
    recordCounts: countsFor(normalized)
  };
  const payloadSha256 = await sha256Utf8(canonicalJson(withoutHash));
  return { ...withoutHash, payloadSha256 };
}

export async function verifyCloudBackupEnvelopeV3(envelope: CloudBackupEnvelopeV3): Promise<boolean> {
  try {
    const { payloadSha256, schemaVersion: _schemaVersion, recordCounts, ...input } = envelope;
    assertV3OwnerBoundary(input);
    if (!/^[a-f0-9]{64}$/u.test(payloadSha256)) return false;
    const normalized = normalizeV3Payload(input);
    if (canonicalJson(input) !== canonicalJson(normalized)) return false;
    if (canonicalJson(countsFor(input)) !== canonicalJson(recordCounts)) return false;
    return await sha256Utf8(canonicalCloudBackupV3Payload(envelope)) === payloadSha256;
  } catch {
    return false;
  }
}

export const FORBIDDEN_CLOUD_FIELDS = [
  'roi', 'yield', 'clv', 'kelly', 'recommendedStake', 'recommendedStakePoints',
  'riskLimit', 'riskScore', 'expectedReturn', 'predictionTraceId', 'recommendationId'
] as const;

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const hasText = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

function findForbiddenFields(value: unknown, path = 'payload'): string[] {
  if (Array.isArray(value)) return value.flatMap((item, index) => findForbiddenFields(item, `${path}[${index}]`));
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, nested]) => [
    ...(FORBIDDEN_CLOUD_FIELDS.includes(key as typeof FORBIDDEN_CLOUD_FIELDS[number]) ? [`${path}.${key}`] : []),
    ...findForbiddenFields(nested, `${path}.${key}`)
  ]);
}

export function validateCloudBetRecord(input: unknown): CloudValidationResult {
  if (!isObject(input)) return { ok: false, errors: ['Input is not an object'] };
  const errors = findForbiddenFields(input).map((field) => `Forbidden field: ${field}`);
  const requiredText = ['betId', 'ownerProfileId', 'matchGroupId', 'homeTeamName', 'awayTeamName', 'selectionLabel', 'createdAt', 'updatedAt'];
  requiredText.forEach((key) => { if (!hasText(input[key])) errors.push(`${key} is required`); });
  if (!['1X2', 'over_under', 'handicap', 'corners', 'custom', 'running'].includes(String(input.marketType))) errors.push('marketType is invalid');
  if (input.oddsFormat !== 'HK') errors.push('oddsFormat must be HK');
  if (!finite(input.oddsValue)) errors.push('oddsValue must be finite');
  if (!finite(input.stakePoints)) errors.push('stakePoints must be finite');
  if (input.preBetPlanAdherence !== undefined && !['yes', 'partly', 'no'].includes(String(input.preBetPlanAdherence))) errors.push('preBetPlanAdherence is invalid');
  if (!['pending', 'settled', 'void'].includes(String(input.status))) errors.push('status is invalid');
  if (input.settlementReviewStatus == null) {
    if (input.settlementReviewReason != null || input.settlementEvidenceAt != null) errors.push('settlement review fields require a status');
  } else if (!SETTLEMENT_REVIEW_STATUSES.includes(input.settlementReviewStatus as SettlementReviewStatus)) {
    errors.push('settlementReviewStatus is invalid');
  } else {
    if (!hasText(input.settlementEvidenceAt) || !ISO.test(input.settlementEvidenceAt)) errors.push('settlementEvidenceAt must be ISO datetime');
    if (input.settlementReviewStatus === 'manual_required') {
      if (input.status !== 'pending') errors.push('manual settlement review requires a pending bet');
      if (!AUTOMATIC_SETTLEMENT_REVIEW_REASONS.includes(input.settlementReviewReason as AutomaticSettlementReviewReason)) {
        errors.push('settlementReviewReason is invalid');
      }
    } else {
      if (input.status !== 'settled') errors.push('automatic settlement review requires a settled bet');
      if (input.settlementReviewReason != null) errors.push('automatic settlement must not retain a manual review reason');
    }
  }
  if (hasText(input.createdAt) && !ISO.test(input.createdAt)) errors.push('createdAt must be ISO datetime');
  if (hasText(input.updatedAt) && !ISO.test(input.updatedAt)) errors.push('updatedAt must be ISO datetime');
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateBankrollLedgerEntry(input: unknown): CloudValidationResult {
  if (!isObject(input)) return { ok: false, errors: ['Input is not an object'] };
  const errors = findForbiddenFields(input).map((field) => `Forbidden field: ${field}`);
  ['entryId', 'ownerProfileId', 'accountId'].forEach((key) => { if (!hasText(input[key])) errors.push(`${key} is required`); });
  if (!['deposit', 'withdrawal', 'transfer_in', 'transfer_out', 'correction', 'bet_settlement', 'bet_settlement_correction'].includes(String(input.entryType))) errors.push('entryType is invalid');
  if (!finite(input.amountPoints) || input.amountPoints === 0) errors.push('amountPoints must be non-zero');
  if (!hasText(input.occurredAt) || !ISO.test(input.occurredAt)) errors.push('occurredAt must be ISO datetime');
  if (!hasText(input.createdAt) || !ISO.test(input.createdAt)) errors.push('createdAt must be ISO datetime');
  return errors.length ? { ok: false, errors } : { ok: true };
}

export type { BetSettlementEvent, DisciplineChallenge, DisciplineConfig };

export function validateCloudPersistenceStatus(input: unknown): CloudValidationResult {
  if (!isObject(input)) return { ok: false, errors: ['Input is not an object'] };
  const errors: string[] = [];
  if (input.provider !== 'supabase-postgres') errors.push('provider is invalid');
  if (!['disabled', 'memory', 'supabase'].includes(String(input.mode))) errors.push('mode is invalid');
  if (!['unconfigured', 'ready', 'unavailable'].includes(String(input.state))) errors.push('state is invalid');
  if (!hasText(input.checkedAt) || !ISO.test(input.checkedAt)) errors.push('checkedAt must be ISO datetime');
  return errors.length ? { ok: false, errors } : { ok: true };
}
