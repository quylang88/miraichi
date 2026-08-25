import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from './memory-cloud-persistence-adapter.js';
import type { CloudMatchSnapshot } from '@miraichi/shared/src/contracts/index.js';

const fixedNow = () => '2026-07-02T00:00:00.000Z';
const snapshot: CloudMatchSnapshot = {
  snapshotId: 'snapshot-001',
  generatedAt: '2026-07-01T00:00:00.000Z',
  importedAt: '2026-07-01T00:01:00.000Z',
  sources: [],
  matches: []
};

describe('memory cloud persistence adapter', () => {
  it('saves, lists, clones, and deletes drafts', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    const tags = ['owner'];
    await adapter.saveBetDraft('owner-primary', {
      draftId: 'draft-1', matchGroupId: 'match-1', marketType: '1X2', oddsFormat: 'HK',
      oddsValue: 0.9, stakePoints: 10, tags, createdAt: fixedNow(), updatedAt: fixedNow()
    });
    tags.push('mutated');
    const drafts = await adapter.listBetDrafts('owner-primary');
    expect(drafts[0]?.tags).toEqual(['owner']);
    expect(await adapter.deleteBetDraft('owner-primary', 'draft-1')).toBe(true);
    expect(await adapter.listBetDrafts('owner-primary')).toEqual([]);
  });

  it('rejects duplicate bet identities and supports updates', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    const record = {
      betId: 'bet-1', ownerProfileId: 'owner-primary', matchGroupId: 'match-1',
      homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2' as const,
      selectionLabel: 'Japan', oddsFormat: 'HK' as const, oddsValue: 0.9, stakePoints: 10,
      status: 'pending' as const, createdAt: fixedNow(), updatedAt: fixedNow()
    };
    await adapter.createBetRecord(record);
    await expect(adapter.createBetRecord(record)).rejects.toThrow('Duplicate bet ID');
    await adapter.updateBetRecord({ ...record, status: 'settled', manualResultPoints: 9 });
    expect(await adapter.listBetRecords('owner-primary')).toMatchObject([{ status: 'settled', manualResultPoints: 9 }]);
  });

  it('reconciles signed manual ledger entries without betting advice', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    await adapter.createBankrollAccount({ accountId: 'account-001', ownerProfileId: 'owner-primary', label: 'Main', openingBalancePoints: 1000 });
    await adapter.createBankrollLedgerEntry({
      entryId: 'entry-001', ownerProfileId: 'owner-primary', accountId: 'account-001',
      entryType: 'withdrawal', amountPoints: -100, occurredAt: fixedNow()
    });
    expect(await adapter.listBankrollAccounts('owner-primary')).toMatchObject([{ accountId: 'account-001', currentBalancePoints: 900 }]);
  });

  it('stores versioned discipline config and consumes a challenge once', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    const config = { ownerProfileId: 'owner-primary', dailyStopLossPoints: 100, weeklyStopLossPoints: null, bigBetThresholdPoints: 50, timeZone: 'Asia/Tokyo', weekStartDay: 'sunday' as const, cooldownSeconds: 15 as const, version: 1, updatedAt: fixedNow() };
    expect(await adapter.upsertDisciplineConfig(config)).toEqual(config);
    expect(await adapter.getDisciplineConfig('owner-primary')).toEqual(config);
    const defaultConfig = { ownerProfileId: 'owner-primary', dailyStopLossPoints: 100, weeklyStopLossPoints: null, bigBetThresholdPoints: 50, timeZone: 'Asia/Tokyo', cooldownSeconds: 15 as const, version: 2, updatedAt: fixedNow() };
    expect(await adapter.upsertDisciplineConfig(defaultConfig)).toEqual({ ...defaultConfig, weekStartDay: 'monday' });
    const challenge = { challengeId: 'c1', ownerProfileId: 'owner-primary', payloadHash: 'hash', ruleVersion: 1, triggeredRules: ['big_bet'] as const, dailyProfitLossPoints: 0, weeklyProfitLossPoints: 0, createdAt: fixedNow(), availableAt: fixedNow() };
    await adapter.createDisciplineChallenge(challenge);
    expect((await adapter.consumeDisciplineChallenge('owner-primary', 'c1', fixedNow()))?.consumedAt).toBe(fixedNow());
    expect(await adapter.consumeDisciplineChallenge('owner-primary', 'c1', fixedNow())).toBeNull();
  });

  it('applies settlement projection, event, ledger and balance idempotently', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    await adapter.createBankrollAccount({ accountId: 'a', ownerProfileId: 'owner-primary', label: 'Main', openingBalancePoints: 100 });
    const bet = { betId: 'b', ownerProfileId: 'owner-primary', matchGroupId: 'm', bankrollAccountId: 'a', homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2' as const, selectionLabel: 'Japan', oddsFormat: 'HK' as const, oddsValue: 0.9, stakePoints: 10, status: 'pending' as const, preBetEmotion: 'calm' as const, preBetMotivation: 'planned_analysis' as const, createdAt: fixedNow(), updatedAt: fixedNow() };
    await adapter.createBetRecord(bet);
    const settled = { ...bet, status: 'settled' as const, settlementType: 'full_win' as const, profitLossPoints: 9, settledAt: fixedNow(), postBetPlanAdherence: 'yes' as const };
    const event = { settlementEventId: 's', ownerProfileId: 'owner-primary', betId: 'b', bankrollAccountId: 'a', settlementType: 'full_win' as const, planAdherence: 'yes' as const, effectiveAt: fixedNow(), occurredAt: fixedNow(), calculatedProfitLossPoints: 9, ledgerDeltaPoints: 9 };
    const ledger = { entryId: 'settlement:s', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'bet_settlement' as const, amountPoints: 9, occurredAt: fixedNow(), betId: 'b', settlementEventId: 's' };
    const first = await adapter.applyBetSettlement({ record: settled, event, ledgerEntry: ledger });
    const second = await adapter.applyBetSettlement({ record: settled, event, ledgerEntry: ledger });
    expect(first.account.currentBalancePoints).toBe(109);
    expect(second.account.currentBalancePoints).toBe(109);
    expect(await adapter.listBetSettlementEvents('owner-primary', 'b')).toHaveLength(1);
  });

  it('transfers points with linked entries in one operation', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    await adapter.createBankrollAccount({ accountId: 'a', ownerProfileId: 'owner-primary', label: 'A', openingBalancePoints: 100 });
    await adapter.createBankrollAccount({ accountId: 'b', ownerProfileId: 'owner-primary', label: 'B', openingBalancePoints: 20 });
    await adapter.createBankrollTransfer({ ownerProfileId: 'owner-primary', transferId: 't', fromAccountId: 'a', toAccountId: 'b', amountPoints: 30, occurredAt: fixedNow() });
    expect(await adapter.listBankrollAccounts('owner-primary')).toMatchObject([{ accountId: 'a', currentBalancePoints: 70 }, { accountId: 'b', currentBalancePoints: 50 }]);
  });

  it('updates only the target account and rejects duplicate ledger identities', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
    await adapter.createBankrollAccount({ accountId: 'a', ownerProfileId: 'owner-primary', label: 'A', openingBalancePoints: 100 });
    await adapter.createBankrollAccount({ accountId: 'b', ownerProfileId: 'owner-primary', label: 'B', openingBalancePoints: 200 });
    const entry = { entryId: 'e', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'deposit' as const, amountPoints: 50, occurredAt: fixedNow() };
    await adapter.createBankrollLedgerEntry(entry);
    await expect(adapter.createBankrollLedgerEntry(entry)).rejects.toThrow('Duplicate ledger entry ID');
    expect(await adapter.listBankrollAccounts('owner-primary')).toMatchObject([
      { accountId: 'a', currentBalancePoints: 150 }, { accountId: 'b', currentBalancePoints: 200 }
    ]);
  });

  it('keeps cloud snapshot status fresh through exactly twelve hours and stale after', async () => {
    const atBoundary = createMemoryCloudPersistenceAdapter({ now: () => '2026-07-01T12:00:00.000Z' });
    const afterBoundary = createMemoryCloudPersistenceAdapter({ now: () => '2026-07-01T12:00:00.001Z' });
    await atBoundary.upsertMatchSnapshot('owner-primary', snapshot);
    await afterBoundary.upsertMatchSnapshot('owner-primary', snapshot);

    expect((await atBoundary.getCloudMatchSnapshotStatus('owner-primary')).freshness).toBe('fresh');
    expect((await afterBoundary.getCloudMatchSnapshotStatus('owner-primary')).freshness).toBe('stale');
  });
});
