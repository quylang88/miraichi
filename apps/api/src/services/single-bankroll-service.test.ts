import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { resolveSingleActiveBankroll, setupSingleBankroll } from './single-bankroll-service.js';

describe('single bankroll service', () => {
  it('creates one internal primary bankroll and preserves it on retry', async () => {
    const adapter = createMemoryCloudPersistenceAdapter({ now: () => '2026-09-01T00:00:00.000Z' });
    const first = await setupSingleBankroll({ adapter, ownerProfileId: 'owner-primary', openingBalancePoints: 100, timeZone: 'Asia/Tokyo', weekStartDay: 'monday', now: '2026-09-01T00:00:00.000Z' });
    const retry = await setupSingleBankroll({ adapter, ownerProfileId: 'owner-primary', openingBalancePoints: 999, timeZone: 'UTC', weekStartDay: 'sunday', now: '2026-09-01T01:00:00.000Z' });
    expect(first).toMatchObject({ created: true, account: { accountId: 'bankroll-primary', currentBalancePoints: 100 } });
    expect(retry).toMatchObject({ created: false, account: { currentBalancePoints: 100 }, disciplineConfig: { timeZone: 'Asia/Tokyo' } });
    expect((await resolveSingleActiveBankroll(adapter, 'owner-primary')).accountId).toBe('bankroll-primary');
  });

  it('does not guess or merge when multiple active or only archived accounts exist', async () => {
    const multiple = createMemoryCloudPersistenceAdapter();
    await multiple.createBankrollAccount({ accountId: 'a', ownerProfileId: 'owner-primary', label: 'A', openingBalancePoints: 10 });
    await multiple.createBankrollAccount({ accountId: 'b', ownerProfileId: 'owner-primary', label: 'B', openingBalancePoints: 20 });
    await expect(resolveSingleActiveBankroll(multiple, 'owner-primary')).rejects.toMatchObject({ code: 'multiple_bankroll_accounts' });
    const archived = createMemoryCloudPersistenceAdapter();
    await archived.createBankrollAccount({ accountId: 'old', ownerProfileId: 'owner-primary', label: 'Old', openingBalancePoints: 10 });
    await archived.updateBankrollAccount({ accountId: 'old', ownerProfileId: 'owner-primary', archived: true });
    await expect(setupSingleBankroll({ adapter: archived, ownerProfileId: 'owner-primary', openingBalancePoints: 100, timeZone: 'UTC', weekStartDay: 'monday', now: '2026-09-01T00:00:00.000Z' })).rejects.toMatchObject({ code: 'bankroll_setup_conflict' });
  });
});
