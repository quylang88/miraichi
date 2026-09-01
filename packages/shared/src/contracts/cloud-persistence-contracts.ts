import type { AddBetDraft } from './add-bet-draft-contracts.js';
import type { LocalMatch, LocalMatchSourceRef } from './local-match-contracts.js';
import type {
  BetSettlementEvent, DisciplineChallenge, DisciplineConfig, DisciplineSnapshot,
  PlanAdherence, PreBetEmotion, PreBetMotivation, SettlementType
} from './core-betting-contracts.js';

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
  marketType: '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom';
  customMarketLabel?: string; selectionLabel: string; lineValue?: number | null;
  oddsFormat: 'HK'; oddsValue: number; stakePoints: number;
  status: 'pending' | 'settled' | 'void'; settlementNote?: string;
  manualResultPoints?: number | null; notes?: string; tags?: readonly string[];
  bankrollAccountId?: string | null;
  preBetEmotion?: PreBetEmotion; preBetMotivation?: PreBetMotivation; preBetPlanAdherence?: PlanAdherence; preBetNote?: string;
  disciplineSnapshot?: DisciplineSnapshot;
  settlementType?: SettlementType; profitLossPoints?: number | null; settledAt?: string;
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

export type CloudBackupEnvelope = CloudBackupEnvelopeV1 | CloudBackupEnvelopeV2;

export interface BackupExportReceipt {
  exportId: string; ownerProfileId: string; schemaVersion: 'miraichi.cloud-backup.v1' | 'miraichi.cloud-backup.v2';
  exportedAt: string; sha256: string;
  recordCounts: { betDrafts: number; bets: number; bankrollAccounts: number; bankrollLedgerEntries: number; disciplineConfigs?: number; settlementEvents?: number };
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
  if (!['1X2', 'over_under', 'handicap', 'corners', 'custom'].includes(String(input.marketType))) errors.push('marketType is invalid');
  if (input.oddsFormat !== 'HK') errors.push('oddsFormat must be HK');
  if (!finite(input.oddsValue)) errors.push('oddsValue must be finite');
  if (!finite(input.stakePoints)) errors.push('stakePoints must be finite');
  if (input.preBetPlanAdherence !== undefined && !['yes', 'partly', 'no'].includes(String(input.preBetPlanAdherence))) errors.push('preBetPlanAdherence is invalid');
  if (!['pending', 'settled', 'void'].includes(String(input.status))) errors.push('status is invalid');
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
