import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from './memory-cloud-persistence-adapter.js';

const fixedNow = () => '2026-07-02T00:00:00.000Z';

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
});
