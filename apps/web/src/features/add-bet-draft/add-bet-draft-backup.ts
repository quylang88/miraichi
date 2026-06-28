import type {
  AddBetBackupEnvelope,
  AddBetDraft,
  AddBetDraftPersistenceAdapter,
  AddBetDraftPersistenceErrorCode,
  AddBetDraftPersistenceResult,
  MatchGroupId
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import {
  ADD_BET_BACKUP_SCHEMA_VERSION,
  ADD_BET_BACKUP_SOURCE_APP,
  cloneAddBetDraft
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

export interface ExportAddBetDraftBackupInput {
  readonly adapter: AddBetDraftPersistenceAdapter;
  readonly matchGroupIds: readonly MatchGroupId[];
  readonly exportedAt: string;
}

export interface ParseAddBetDraftBackupResult {
  readonly ok: boolean;
  readonly envelope?: AddBetBackupEnvelope;
  readonly errorCode?: AddBetDraftPersistenceErrorCode;
}

export interface ImportAddBetDraftBackupInput {
  readonly adapter: AddBetDraftPersistenceAdapter;
  readonly rawBackupJson: string;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDraftArray(value: unknown): value is readonly AddBetDraft[] {
  return Array.isArray(value);
}

function isBackupEnvelope(value: unknown): value is AddBetBackupEnvelope {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.exportedAt === 'string' &&
    value.sourceApp === ADD_BET_BACKUP_SOURCE_APP &&
    Array.isArray(value.records) &&
    (value.drafts === undefined || isDraftArray(value.drafts))
  );
}

export async function exportAddBetDraftBackup({
  adapter,
  matchGroupIds,
  exportedAt
}: ExportAddBetDraftBackupInput): Promise<string> {
  const draftsByMatch = await Promise.all(
    matchGroupIds.map((matchGroupId) => adapter.listDraftsByMatch(matchGroupId))
  );
  const drafts = draftsByMatch.flat().map(cloneAddBetDraft);

  const envelope: AddBetBackupEnvelope = {
    schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
    exportedAt,
    sourceApp: ADD_BET_BACKUP_SOURCE_APP,
    records: [],
    drafts
  };

  return JSON.stringify(envelope);
}

export function parseAddBetDraftBackup(rawBackupJson: string): ParseAddBetDraftBackupResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBackupJson);
  } catch {
    return {
      ok: false,
      errorCode: 'malformed_backup'
    };
  }

  if (!isObject(parsed) || parsed.schemaVersion !== ADD_BET_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      errorCode: 'unsupported_schema'
    };
  }

  if (!isBackupEnvelope(parsed)) {
    return {
      ok: false,
      errorCode: 'malformed_backup'
    };
  }

  const envelope: AddBetBackupEnvelope = {
    schemaVersion: parsed.schemaVersion,
    exportedAt: parsed.exportedAt,
    sourceApp: parsed.sourceApp,
    records: parsed.records,
    ...(parsed.settings ? { settings: parsed.settings } : {}),
    ...(parsed.drafts ? { drafts: parsed.drafts.map(cloneAddBetDraft) } : {})
  };

  return {
    ok: true,
    envelope
  };
}

export async function importAddBetDraftBackup({
  adapter,
  rawBackupJson
}: ImportAddBetDraftBackupInput): Promise<AddBetDraftPersistenceResult> {
  const parsedBackup = parseAddBetDraftBackup(rawBackupJson);

  if (!parsedBackup.ok || !parsedBackup.envelope) {
    return {
      ok: false,
      errorCode: parsedBackup.errorCode ?? 'malformed_backup'
    };
  }

  const drafts = parsedBackup.envelope.drafts ?? [];
  const existingDrafts = await Promise.all(drafts.map((draft) => adapter.loadDraft(draft.draftId)));

  if (existingDrafts.some((draft) => draft !== null)) {
    return {
      ok: false,
      errorCode: 'partial_import_conflict'
    };
  }

  for (const draft of drafts) {
    await adapter.saveDraft(cloneAddBetDraft(draft));
  }

  return { ok: true };
}
