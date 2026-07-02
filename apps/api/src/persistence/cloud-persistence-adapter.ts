import type {
  AddBetDraft, BackupExportReceipt, BankrollAccount, BankrollLedgerEntry,
  CloudBackupEnvelope, CloudBetRecord, CloudMatchSnapshot, CloudPersistenceStatus,
  CreateBankrollAccountInput, CreateBankrollLedgerEntryInput, LocalDataSnapshotStatus,
  LocalMatch, LocalMatchFeedResponse, LocalMatchSnapshotQuery, UpdateBankrollAccountInput
} from '@miraichi/shared/src/contracts/index.js';

export interface CloudPersistenceAdapter {
  getStatus(): Promise<CloudPersistenceStatus>;
  saveBetDraft(ownerProfileId: string, draft: AddBetDraft): Promise<AddBetDraft>;
  listBetDrafts(ownerProfileId: string): Promise<readonly AddBetDraft[]>;
  deleteBetDraft(ownerProfileId: string, draftId: string): Promise<boolean>;
  createBetRecord(record: CloudBetRecord): Promise<CloudBetRecord>;
  listBetRecords(ownerProfileId: string): Promise<readonly CloudBetRecord[]>;
  updateBetRecord(record: CloudBetRecord): Promise<CloudBetRecord>;
  createBankrollAccount(input: CreateBankrollAccountInput): Promise<BankrollAccount>;
  listBankrollAccounts(ownerProfileId: string): Promise<readonly BankrollAccount[]>;
  updateBankrollAccount(input: UpdateBankrollAccountInput): Promise<BankrollAccount>;
  createBankrollLedgerEntry(input: CreateBankrollLedgerEntryInput): Promise<BankrollLedgerEntry>;
  listBankrollLedgerEntries(ownerProfileId: string, accountId: string): Promise<readonly BankrollLedgerEntry[]>;
  upsertMatchSnapshot(ownerProfileId: string, snapshot: CloudMatchSnapshot): Promise<void>;
  listCloudMatches(ownerProfileId: string, query: LocalMatchSnapshotQuery): Promise<LocalMatchFeedResponse>;
  findCloudMatchById(ownerProfileId: string, matchId: string): Promise<LocalMatch | null>;
  getCloudMatchSnapshotStatus(ownerProfileId: string): Promise<LocalDataSnapshotStatus>;
  exportOwnerData(ownerProfileId: string, exportedAt: string): Promise<CloudBackupEnvelope>;
  importOwnerData(ownerProfileId: string, envelope: CloudBackupEnvelope): Promise<void>;
  recordBackupExport(receipt: BackupExportReceipt): Promise<void>;
  listBackupExports(ownerProfileId: string): Promise<readonly BackupExportReceipt[]>;
}

export class CloudPersistenceUnconfiguredError extends Error {
  readonly code = 'cloud_persistence_unconfigured';
  constructor() { super('Cloud persistence is not configured'); }
}
