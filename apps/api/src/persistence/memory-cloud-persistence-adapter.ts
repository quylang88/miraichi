import {
  getLocalDateFromUtc,
  type AddBetDraft, type ApplyBetSettlementInput, type BackupExportReceipt, type BankrollAccount, type BankrollLedgerEntry,
  type BankrollTransferResult, type BetSettlementEvent, type CloudBackupEnvelope, type CloudBetRecord, type CloudMatchSnapshot, type CreateBankrollAccountInput,
  type CreateBankrollLedgerEntryInput, type CreateBankrollTransferInput, type DisciplineChallenge, type DisciplineConfig, type LocalDataSnapshotStatus, type LocalMatch,
  type AcquireLiveRefreshLeaseInput, type FinishLiveRefreshInput, type LiveMatchSnapshot, type LiveRefreshState,
  type LocalMatchSnapshotQuery, type UpdateBankrollAccountInput
} from '@miraichi/shared/src/contracts/index.js';
import { assertValidLiveMatchSnapshot, sanitizeLiveRefreshErrorCode } from '@miraichi/shared/src/contracts/live-match-contracts.js';
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
  const disciplineConfigs = new Map<string, DisciplineConfig>();
  const disciplineChallenges = new Map<string, DisciplineChallenge>();
  const settlementEvents = new Map<string, BetSettlementEvent>();
  const snapshots = new Map<string, CloudMatchSnapshot>();
  const receipts = new Map<string, BackupExportReceipt>();
  const liveSnapshots = new Map<string, LiveMatchSnapshot>();
  const liveRefreshStates = new Map<string, LiveRefreshState>();
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
    getDisciplineConfig: async (owner) => clone(disciplineConfigs.get(owner) ?? null),
    upsertDisciplineConfig: async (config) => {
      const normalized: DisciplineConfig = { ...clone(config), weekStartDay: config.weekStartDay ?? 'monday' };
      disciplineConfigs.set(config.ownerProfileId, normalized);
      return clone(normalized);
    },
    createDisciplineChallenge: async (challenge) => {
      const id = key(challenge.ownerProfileId, challenge.challengeId);
      if (disciplineChallenges.has(id)) throw new Error('Duplicate discipline challenge ID');
      disciplineChallenges.set(id, clone(challenge)); return clone(challenge);
    },
    findDisciplineChallenge: async (owner, id) => clone(disciplineChallenges.get(key(owner, id)) ?? null),
    consumeDisciplineChallenge: async (owner, id, consumedAt) => {
      const challengeId = key(owner, id); const current = disciplineChallenges.get(challengeId);
      if (!current || current.consumedAt) return null;
      const consumed = { ...current, consumedAt }; disciplineChallenges.set(challengeId, consumed); return clone(consumed);
    },
    applyBetSettlement: async (input: ApplyBetSettlementInput) => {
      const eventId = key(input.event.ownerProfileId, input.event.settlementEventId);
      const existingEvent = settlementEvents.get(eventId);
      if (existingEvent) {
        const existingRecord = bets.get(key(input.record.ownerProfileId, input.record.betId));
        const existingEntry = ledger.get(key(input.ledgerEntry.ownerProfileId, input.ledgerEntry.entryId));
        const existingAccount = accounts.get(key(input.record.ownerProfileId, input.event.bankrollAccountId));
        if (!existingRecord || !existingEntry || !existingAccount) throw new Error('Settlement idempotency state is incomplete');
        return { record: clone(existingRecord), event: clone(existingEvent), ledgerEntry: clone(existingEntry), account: clone(existingAccount) };
      }
      const betId = key(input.record.ownerProfileId, input.record.betId);
      if (!bets.has(betId)) throw new Error('Bet record not found');
      const accountId = key(input.record.ownerProfileId, input.event.bankrollAccountId); const account = accounts.get(accountId);
      if (!account) throw new Error('Bankroll account not found');
      const ledgerId = key(input.ledgerEntry.ownerProfileId, input.ledgerEntry.entryId);
      if (ledger.has(ledgerId)) throw new Error('Duplicate ledger entry ID');
      const entry: BankrollLedgerEntry = { ...clone(input.ledgerEntry), createdAt: now() };
      bets.set(betId, clone(input.record)); settlementEvents.set(eventId, clone(input.event)); ledger.set(ledgerId, entry);
      const updatedAccount = { ...account, currentBalancePoints: account.currentBalancePoints + input.ledgerEntry.amountPoints, updatedAt: now() };
      accounts.set(accountId, updatedAccount);
      return { record: clone(input.record), event: clone(input.event), ledgerEntry: clone(entry), account: clone(updatedAccount) };
    },
    listBetSettlementEvents: async (owner, betId) => valuesFor(settlementEvents, owner).filter((event) => !betId || event.betId === betId).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)),
    createBankrollAccount: async (input) => {
      if (!Number.isFinite(input.openingBalancePoints) || input.openingBalancePoints <= 0) throw new Error('Opening bankroll must be positive');
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
      if ((input.entryType === 'deposit' && input.amountPoints <= 0) || (input.entryType === 'withdrawal' && input.amountPoints >= 0)) throw new Error('Manual ledger entry sign is invalid');
      if (!Number.isFinite(input.amountPoints) || input.amountPoints === 0) throw new Error('Manual ledger amount is invalid');
      const ledgerId = key(input.ownerProfileId, input.entryId);
      if (ledger.has(ledgerId)) throw new Error('Duplicate ledger entry ID');
      const accountId = key(input.ownerProfileId, input.accountId); const account = accounts.get(accountId);
      if (!account) throw new Error('Bankroll account not found');
      if (account.archived) throw new Error('Bankroll account is archived');
      if (input.entryType === 'withdrawal' && account.currentBalancePoints + input.amountPoints < 0) throw new Error('Insufficient bankroll balance');
      const entry: BankrollLedgerEntry = { ...clone(input), createdAt: now() };
      ledger.set(ledgerId, entry);
      accounts.set(accountId, { ...account, currentBalancePoints: account.currentBalancePoints + input.amountPoints, updatedAt: now() });
      return clone(entry);
    },
    listBankrollLedgerEntries: async (owner, accountId) => valuesFor(ledger, owner).filter((entry) => entry.accountId === accountId).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)),
    createBankrollTransfer: async (input: CreateBankrollTransferInput): Promise<BankrollTransferResult> => {
      if (!Number.isFinite(input.amountPoints) || input.amountPoints <= 0 || input.fromAccountId === input.toAccountId) throw new Error('Transfer payload is invalid');
      const fromId = key(input.ownerProfileId, input.fromAccountId); const toId = key(input.ownerProfileId, input.toAccountId);
      const from = accounts.get(fromId); const to = accounts.get(toId);
      if (!from || !to) throw new Error('Bankroll account not found');
      if (from.archived || to.archived) throw new Error('Bankroll account is archived');
      if (from.currentBalancePoints < input.amountPoints) throw new Error('Insufficient bankroll balance');
      const outId = key(input.ownerProfileId, `transfer:${input.transferId}:out`); const inId = key(input.ownerProfileId, `transfer:${input.transferId}:in`);
      if (ledger.has(outId) || ledger.has(inId)) throw new Error('Duplicate transfer ID');
      const common = { ownerProfileId: input.ownerProfileId, transferId: input.transferId, occurredAt: input.occurredAt, createdAt: now(), ...(input.note ? { note: input.note } : {}) };
      const outEntry: BankrollLedgerEntry = { ...common, entryId: `transfer:${input.transferId}:out`, accountId: input.fromAccountId, entryType: 'transfer_out', amountPoints: -input.amountPoints };
      const inEntry: BankrollLedgerEntry = { ...common, entryId: `transfer:${input.transferId}:in`, accountId: input.toAccountId, entryType: 'transfer_in', amountPoints: input.amountPoints };
      const fromAccount = { ...from, currentBalancePoints: from.currentBalancePoints - input.amountPoints, updatedAt: now() };
      const toAccount = { ...to, currentBalancePoints: to.currentBalancePoints + input.amountPoints, updatedAt: now() };
      ledger.set(outId, outEntry); ledger.set(inId, inEntry); accounts.set(fromId, fromAccount); accounts.set(toId, toAccount);
      return { fromAccount: clone(fromAccount), toAccount: clone(toAccount), outEntry: clone(outEntry), inEntry: clone(inEntry) };
    },
    upsertMatchSnapshot: async (owner, snapshot) => { snapshots.set(owner, clone(snapshot)); },
    listCloudMatches: async (owner, query: LocalMatchSnapshotQuery) => {
      const snapshot = latestSnapshot(owner);
      if (!snapshot) return { matches: [], snapshot: missingSnapshot() };
      const targetTz = query.timezone ?? 'UTC';
      const matches = snapshot.matches.filter((match) =>
        (!query.date || getLocalDateFromUtc(match.kickoffUtc, targetTz) === query.date) &&
        (!query.competitionId || match.competition.id === query.competitionId) &&
        (!query.status || match.status === query.status));
      return { matches: clone(matches), snapshot: statusFor(snapshot) };
    },
    findCloudMatchById: async (owner, matchId) => clone(latestSnapshot(owner)?.matches.find((match) => match.id === matchId) ?? null),
    getCloudMatchSnapshotStatus: async (owner) => latestSnapshot(owner) ? statusFor(latestSnapshot(owner)!) : missingSnapshot(),
    getLiveMatchSnapshot: async (owner) => clone(liveSnapshots.get(owner) ?? null),
    getLiveRefreshState: async (owner) => clone(liveRefreshStates.get(owner) ?? null),
    acquireLiveRefreshLease: async (owner, input: AcquireLiveRefreshLeaseInput) => {
      const acquiredAt = Date.parse(input.acquiredAt);
      const expiresAt = Date.parse(input.expiresAt);
      if (!Number.isFinite(acquiredAt) || !Number.isFinite(expiresAt) || expiresAt <= acquiredAt) {
        throw new Error('Live refresh lease timestamps are invalid');
      }
      const current = liveRefreshStates.get(owner);
      if (current && acquiredAt - Date.parse(current.lastAttemptAt) < (current.lastErrorCode === 'upstream_blocked' ? 900_000 : 60_000)) return false;
      if (current && Date.parse(current.lastAttemptAt) > acquiredAt) return false;
      if (current?.lease && Date.parse(current.lease.expiresAt) > acquiredAt) return false;
      liveRefreshStates.set(owner, {
        status: 'running',
        reason: input.reason,
        lastAttemptAt: input.acquiredAt,
        lastSuccessAt: current?.lastSuccessAt ?? null,
        lastCompletedAt: current?.lastCompletedAt ?? null,
        lastErrorCode: null,
        lease: { leaseId: input.leaseId, acquiredAt: input.acquiredAt, expiresAt: input.expiresAt }
      });
      return true;
    },
    finishLiveRefresh: async (owner, input: FinishLiveRefreshInput) => {
      const current = liveRefreshStates.get(owner);
      if (current?.status !== 'running' || current.lease?.leaseId !== input.leaseId) {
        throw new Error('Live refresh lease is no longer owned');
      }
      const completedAt = Date.parse(input.completedAt);
      if (!Number.isFinite(completedAt) || completedAt < Date.parse(current.lastAttemptAt)) {
        throw new Error('Live refresh completion timestamp is invalid');
      }
      if (completedAt >= Date.parse(current.lease.expiresAt)) throw new Error('Live refresh lease expired');
      if (input.outcome === 'succeeded') {
        assertValidLiveMatchSnapshot(input.snapshot);
        liveSnapshots.set(owner, clone(input.snapshot));
      }
      liveRefreshStates.set(owner, {
        status: input.outcome === 'succeeded' ? 'succeeded' : 'failed',
        reason: current.reason,
        lastAttemptAt: current.lastAttemptAt,
        lastSuccessAt: input.outcome === 'succeeded' ? input.completedAt : current.lastSuccessAt,
        lastCompletedAt: input.completedAt,
        lastErrorCode: input.outcome === 'failed' ? sanitizeLiveRefreshErrorCode(input.errorCode) : null,
        lease: null
      });
    },
    exportOwnerData: async (owner, exportedAt) => ({
      schemaVersion: 'miraichi.cloud-backup.v2', exportedAt, ownerProfileId: owner,
      drafts: valuesFor(drafts, owner), bets: valuesFor(bets, owner), bankrollAccounts: valuesFor(accounts, owner), bankrollLedgerEntries: valuesFor(ledger, owner),
      disciplineConfigs: disciplineConfigs.has(owner) ? [clone(disciplineConfigs.get(owner)!)] : [], settlementEvents: valuesFor(settlementEvents, owner)
    }),
    importOwnerData: async (owner, envelope: CloudBackupEnvelope) => {
      if (envelope.ownerProfileId !== owner) throw new Error('Backup owner mismatch');
      envelope.drafts.forEach((item) => drafts.set(key(owner, item.draftId), clone(item)));
      envelope.bets.forEach((item) => bets.set(key(owner, item.betId), clone(item)));
      envelope.bankrollAccounts.forEach((item) => accounts.set(key(owner, item.accountId), clone(item)));
      envelope.bankrollLedgerEntries.forEach((item) => ledger.set(key(owner, item.entryId), clone(item)));
      if (envelope.schemaVersion === 'miraichi.cloud-backup.v2') {
        envelope.disciplineConfigs.forEach((item) => disciplineConfigs.set(owner, clone({ ...item, weekStartDay: item.weekStartDay ?? 'monday' })));
        envelope.settlementEvents.forEach((item) => settlementEvents.set(key(owner, item.settlementEventId), clone(item)));
      }
    },
    recordBackupExport: async (receipt) => { receipts.set(key(receipt.ownerProfileId, receipt.exportId), clone(receipt)); },
    listBackupExports: async (owner) => valuesFor(receipts, owner).sort((a, b) => b.exportedAt.localeCompare(a.exportedAt))
  };
}
