import type {
  AddBetDraft, BackupExportReceipt, BankrollAccount, BankrollLedgerEntry,
  CloudBackupEnvelope, CloudBetRecord, CloudMatchSnapshot, CreateBankrollAccountInput,
  CreateBankrollLedgerEntryInput, LocalDataSnapshotStatus, LocalMatch,
  LocalMatchSnapshotQuery, UpdateBankrollAccountInput
} from '@miraichi/shared/src/contracts/index.js';
import type { CloudPersistenceAdapter } from './cloud-persistence-adapter.js';
import { classifyMatchSnapshotFreshness } from '../match-snapshot-freshness.js';

export interface MemoryCloudPersistenceOptions { now?: () => string }
const clone = <T>(value: T): T => structuredClone(value);

export function createMemoryCloudPersistenceAdapter(options: MemoryCloudPersistenceOptions = {}): CloudPersistenceAdapter {
  const now = options.now ?? (() => new Date().toISOString());
  const drafts = new Map<string, AddBetDraft>();
  const bets = new Map<string, CloudBetRecord>();
  const accounts = new Map<string, BankrollAccount>();
  const ledger = new Map<string, BankrollLedgerEntry>();
  const snapshots = new Map<string, CloudMatchSnapshot>();
  const receipts = new Map<string, BackupExportReceipt>();
  const key = (owner: string, id: string) => `${owner}:${id}`;
  const valuesFor = <T>(map: Map<string, T>, owner: string): T[] =>
    [...map.entries()].filter(([id]) => id.startsWith(`${owner}:`)).map(([, value]) => clone(value));
  const missingSnapshot = (): LocalDataSnapshotStatus => ({
    snapshotId: 'cloud-missing', generatedAt: now(), importedAt: now(), matchCount: 0,
    competitions: [], sources: [], freshness: 'missing', warnings: ['Cloud match snapshot is unavailable.']
  });
  const statusFor = (snapshot: CloudMatchSnapshot): LocalDataSnapshotStatus => {
    const competitions = new Map<string, { id: string; name: string; seasons: Set<string>; matchCount: number }>();
    snapshot.matches.forEach((match) => {
      const current = competitions.get(match.competition.id) ?? { id: match.competition.id, name: match.competition.name, seasons: new Set<string>(), matchCount: 0 };
      current.seasons.add(match.competition.season); current.matchCount += 1; competitions.set(current.id, current);
    });
    return {
      snapshotId: snapshot.snapshotId, generatedAt: snapshot.generatedAt, importedAt: snapshot.importedAt,
      matchCount: snapshot.matches.length,
      competitions: [...competitions.values()].map((item) => ({ ...item, seasons: [...item.seasons] })),
      sources: clone(snapshot.sources), freshness: classifyMatchSnapshotFreshness(snapshot.generatedAt, now()), warnings: []
    };
  };
  const latestSnapshot = (owner: string) => snapshots.get(owner);

  return {
    getStatus: async () => ({ provider: 'supabase-postgres', mode: 'memory', state: 'ready', checkedAt: now() }),
    saveBetDraft: async (owner, draft) => { const value = clone(draft); drafts.set(key(owner, draft.draftId), value); return clone(value); },
    listBetDrafts: async (owner) => valuesFor(drafts, owner).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    deleteBetDraft: async (owner, id) => drafts.delete(key(owner, id)),
    createBetRecord: async (record) => {
      const id = key(record.ownerProfileId, record.betId);
      if (bets.has(id)) throw new Error('Duplicate bet ID');
      bets.set(id, clone(record)); return clone(record);
    },
    listBetRecords: async (owner) => valuesFor(bets, owner).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    updateBetRecord: async (record) => {
      const id = key(record.ownerProfileId, record.betId);
      if (!bets.has(id)) throw new Error('Bet record not found');
      bets.set(id, clone(record)); return clone(record);
    },
    createBankrollAccount: async (input) => {
      const id = key(input.ownerProfileId, input.accountId);
      if (accounts.has(id)) throw new Error('Duplicate account ID');
      const created: BankrollAccount = { ...clone(input), unit: 'points', currentBalancePoints: input.openingBalancePoints, archived: false, createdAt: now(), updatedAt: now() };
      accounts.set(id, created); return clone(created);
    },
    listBankrollAccounts: async (owner) => valuesFor(accounts, owner),
    updateBankrollAccount: async (input: UpdateBankrollAccountInput) => {
      const id = key(input.ownerProfileId, input.accountId); const current = accounts.get(id);
      if (!current) throw new Error('Bankroll account not found');
      const updated: BankrollAccount = { ...current, ...(input.label === undefined ? {} : { label: input.label }), ...(input.archived === undefined ? {} : { archived: input.archived }), updatedAt: now() };
      accounts.set(id, updated); return clone(updated);
    },
    createBankrollLedgerEntry: async (input: CreateBankrollLedgerEntryInput) => {
      const ledgerId = key(input.ownerProfileId, input.entryId);
      if (ledger.has(ledgerId)) throw new Error('Duplicate ledger entry ID');
      const accountId = key(input.ownerProfileId, input.accountId); const account = accounts.get(accountId);
      if (!account) throw new Error('Bankroll account not found');
      if (account.archived) throw new Error('Bankroll account is archived');
      const entry: BankrollLedgerEntry = { ...clone(input), createdAt: now() };
      ledger.set(ledgerId, entry);
      accounts.set(accountId, { ...account, currentBalancePoints: account.currentBalancePoints + input.amountPoints, updatedAt: now() });
      return clone(entry);
    },
    listBankrollLedgerEntries: async (owner, accountId) => valuesFor(ledger, owner).filter((entry) => entry.accountId === accountId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    upsertMatchSnapshot: async (owner, snapshot) => { snapshots.set(owner, clone(snapshot)); },
    listCloudMatches: async (owner, query: LocalMatchSnapshotQuery) => {
      const snapshot = latestSnapshot(owner);
      if (!snapshot) return { matches: [], snapshot: missingSnapshot() };
      const matches = snapshot.matches.filter((match) =>
        (!query.date || match.kickoffUtc.slice(0, 10) === query.date) &&
        (!query.competitionId || match.competition.id === query.competitionId) &&
        (!query.status || match.status === query.status));
      return { matches: clone(matches), snapshot: statusFor(snapshot) };
    },
    findCloudMatchById: async (owner, matchId) => clone(latestSnapshot(owner)?.matches.find((match) => match.id === matchId) ?? null),
    getCloudMatchSnapshotStatus: async (owner) => latestSnapshot(owner) ? statusFor(latestSnapshot(owner)!) : missingSnapshot(),
    exportOwnerData: async (owner, exportedAt) => ({
      schemaVersion: 'miraichi.cloud-backup.v1', exportedAt, ownerProfileId: owner,
      drafts: valuesFor(drafts, owner), bets: valuesFor(bets, owner), bankrollAccounts: valuesFor(accounts, owner), bankrollLedgerEntries: valuesFor(ledger, owner)
    }),
    importOwnerData: async (owner, envelope: CloudBackupEnvelope) => {
      if (envelope.ownerProfileId !== owner) throw new Error('Backup owner mismatch');
      envelope.drafts.forEach((item) => drafts.set(key(owner, item.draftId), clone(item)));
      envelope.bets.forEach((item) => bets.set(key(owner, item.betId), clone(item)));
      envelope.bankrollAccounts.forEach((item) => accounts.set(key(owner, item.accountId), clone(item)));
      envelope.bankrollLedgerEntries.forEach((item) => ledger.set(key(owner, item.entryId), clone(item)));
    },
    recordBackupExport: async (receipt) => { receipts.set(key(receipt.ownerProfileId, receipt.exportId), clone(receipt)); },
    listBackupExports: async (owner) => valuesFor(receipts, owner).sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
  };
}
