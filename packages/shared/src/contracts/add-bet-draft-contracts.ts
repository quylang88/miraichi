import type {
  BetRecordEnvelope,
  IsoDateTimeString,
  LineValue,
  MarketType,
  MatchGroupId,
  OddsFormat
} from './betting-domain-contracts.js';

export type { IsoDateTimeString, MatchGroupId } from './betting-domain-contracts.js';

export const ADD_BET_BACKUP_SCHEMA_VERSION = 'miraichi.add-bet-backup.v1' as const;
export const ADD_BET_BACKUP_SOURCE_APP = 'miraichi' as const;

export type AddBetDraftId = string;

export interface AddBetDraft {
  readonly draftId: AddBetDraftId;
  readonly matchGroupId: MatchGroupId;
  readonly marketType: MarketType;
  readonly customMarketLabel?: string;
  readonly lineValue?: LineValue | null;
  readonly oddsFormat: OddsFormat;
  readonly oddsValue: number;
  readonly stakePoints: number;
  readonly notes?: string;
  readonly tags?: readonly string[];
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export type AddBetDraftFieldName = keyof AddBetDraft;
export type AddBetFormStep = 'add' | 'edit' | 'review';

export interface AddBetFormState {
  readonly activeStep: AddBetFormStep;
  readonly dirtyFields: readonly AddBetDraftFieldName[];
  readonly touchedFields: readonly AddBetDraftFieldName[];
  readonly warnings: Readonly<Partial<Record<AddBetDraftFieldName, string>>>;
  readonly blockingErrors: Readonly<Partial<Record<AddBetDraftFieldName, string>>>;
  readonly reviewReady: boolean;
  readonly lastSavedAt?: IsoDateTimeString | null;
}

export type AddBetDraftPersistenceErrorCode =
  | 'draft_not_found'
  | 'storage_unavailable'
  | 'quota_exceeded'
  | 'unsupported_schema'
  | 'malformed_backup'
  | 'duplicate_record_identity'
  | 'partial_import_conflict'
  | 'user_cancelled';

export interface AddBetDraftPersistenceResult {
  readonly ok: boolean;
  readonly errorCode?: AddBetDraftPersistenceErrorCode;
}

export interface AddBetDraftPersistenceAdapter {
  saveDraft(draft: AddBetDraft): Promise<AddBetDraft>;
  loadDraft(draftId: AddBetDraftId): Promise<AddBetDraft | null>;
  listDraftsByMatch(matchGroupId: MatchGroupId): Promise<readonly AddBetDraft[]>;
  deleteDraft(draftId: AddBetDraftId): Promise<AddBetDraftPersistenceResult>;
}

export interface AddBetBackupEnvelope {
  readonly schemaVersion: typeof ADD_BET_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: IsoDateTimeString;
  readonly sourceApp: typeof ADD_BET_BACKUP_SOURCE_APP;
  readonly records: readonly BetRecordEnvelope[];
  readonly drafts?: readonly AddBetDraft[];
  readonly settings?: Readonly<Record<string, unknown>>;
}

const REQUIRED_REVIEW_FIELDS = [
  'draftId',
  'matchGroupId',
  'marketType',
  'oddsFormat',
  'oddsValue',
  'stakePoints',
  'createdAt',
  'updatedAt'
] as const satisfies readonly AddBetDraftFieldName[];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function cloneAddBetDraft(draft: AddBetDraft): AddBetDraft {
  const { tags, ...rest } = draft;
  return tags ? { ...rest, tags: [...tags] } : rest;
}

export function isAddBetDraftReviewReady(draft: Partial<AddBetDraft>): boolean {
  const requiredFieldsPresent = REQUIRED_REVIEW_FIELDS.every((fieldName) => {
    return draft[fieldName] !== undefined && draft[fieldName] !== null;
  });

  if (!requiredFieldsPresent) {
    return false;
  }

  if (!hasText(draft.draftId) || !hasText(draft.matchGroupId)) {
    return false;
  }

  if (!hasFiniteNumber(draft.oddsValue) || !hasFiniteNumber(draft.stakePoints)) {
    return false;
  }

  if (draft.marketType === 'custom') {
    return hasText(draft.customMarketLabel);
  }

  return true;
}
