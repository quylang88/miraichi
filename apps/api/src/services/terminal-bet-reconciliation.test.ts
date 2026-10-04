import { describe, expect, it, vi } from 'vitest';
import type { CloudBetRecord, LocalMatch, LocalMatchDetail } from '@miraichi/shared';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { TerminalBetReconciliationCoordinator } from './terminal-bet-reconciliation.js';

const owner = 'owner-primary';
const now = '2026-09-16T02:00:00.000Z';
const match: LocalMatch = {
  id: 'match-1',
  competition: { id: 'league', name: 'League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-15T18:00:00.000Z',
  status: 'completed',
  homeTeam: { id: 'home', name: 'Home' },
  awayTeam: { id: 'away', name: 'Away' },
  score: { home: 2, away: 1 },
  sourceRefs: [{ sourceId: 'fotmob-unofficial', importedAt: now }],
  updatedAt: '2026-09-16T01:30:00.000Z'
};
const detail: LocalMatchDetail = {
  match,
  status: 'completed',
  elapsedMinute: 90,
  scoreBreakdown: {
    halftime: { home: 1, away: 0 },
    fulltime: { home: 2, away: 1 },
    extratime: { home: null, away: null },
    penalty: { home: null, away: null }
  },
  events: [],
  updatedAt: '2026-09-16T01:31:00.000Z'
};

function bet(betId: string, overrides: Partial<CloudBetRecord> = {}): CloudBetRecord {
  return {
    betId,
    ownerProfileId: owner,
    matchGroupId: match.id,
    matchId: match.id,
    bankrollAccountId: 'account',
    homeTeamName: 'Home',
    awayTeamName: 'Away',
    marketType: '1X2',
    selectionCode: 'home',
    selectionLabel: 'Home',
    marketPeriod: 'full_time',
    oddsFormat: 'HK',
    oddsValue: 0.9,
    stakePoints: 10,
    status: 'pending',
    preBetEmotion: 'calm',
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

async function setup(records: readonly CloudBetRecord[], readCached = vi.fn(async () => detail as LocalMatchDetail | null)) {
  const adapter = createMemoryCloudPersistenceAdapter({ now: () => now });
  await adapter.createBankrollAccount({ accountId: 'account', ownerProfileId: owner, label: 'Main', openingBalancePoints: 100 });
  for (const record of records) await adapter.createBetRecord(record);
  const coordinator = new TerminalBetReconciliationCoordinator({
    ownerProfileId: owner,
    persistence: adapter,
    detailReader: { readCached },
    now: () => now,
    maxBets: 2
  });
  return { adapter, coordinator, readCached };
}

describe('terminal bet reconciliation coordinator', () => {
  it('settles only exact linked pending bets from canonical terminal evidence and one cached detail read', async () => {
    const ctx = await setup([
      bet('linked'),
      bet('other-match', { matchGroupId: 'match-2', matchId: 'match-2' }),
      bet('already-settled', { status: 'settled', settlementType: 'full_loss', profitLossPoints: -10 })
    ]);

    await expect(ctx.coordinator.reconcile([match])).resolves.toEqual({ examined: 1, settled: 1, manualRequired: 0, failed: 0 });
    expect(ctx.readCached).toHaveBeenCalledTimes(1);
    expect(ctx.readCached).toHaveBeenCalledWith(match.id);
    expect((await ctx.adapter.listBetRecords(owner)).find((item) => item.betId === 'linked')).toMatchObject({
      status: 'settled', settlementType: 'full_win', settlementReviewStatus: 'auto_settled', profitLossPoints: 9
    });
    expect((await ctx.adapter.listBetRecords(owner)).find((item) => item.betId === 'other-match')?.status).toBe('pending');
  });

  it('marks missing, partial and identity-mismatched cache for manual review without refreshing a provider', async () => {
    const cases: readonly [string, LocalMatchDetail | null, string][] = [
      ['missing', null, 'missing_detail'],
      ['partial', { ...detail, warnings: ['partial_detail'] }, 'incomplete_detail'],
      ['wrong-match', { ...detail, match: { ...match, id: 'match-other' } }, 'match_identity_mismatch']
    ];
    for (const [betId, cached, reason] of cases) {
      const readCached = vi.fn(async () => cached);
      const ctx = await setup([bet(betId)], readCached);
      await ctx.coordinator.reconcile([match]);
      expect(readCached).toHaveBeenCalledTimes(1);
      expect((await ctx.adapter.listBetRecords(owner))[0]).toMatchObject({
        status: 'pending', settlementReviewStatus: 'manual_required', settlementReviewReason: reason
      });
    }
  });

  it('retries a manual-review bet after the owner refreshes detail and keeps the batch bounded', async () => {
    const readCached = vi.fn<() => Promise<LocalMatchDetail | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValue(detail);
    const ctx = await setup([bet('first'), bet('second'), bet('third')], readCached);

    expect(await ctx.coordinator.reconcile([match])).toEqual({ examined: 2, settled: 0, manualRequired: 2, failed: 0 });
    expect((await ctx.adapter.listBetRecords(owner)).find((item) => item.betId === 'third')).not.toHaveProperty('settlementReviewStatus');
    expect(await ctx.coordinator.reconcile([match])).toEqual({ examined: 2, settled: 2, manualRequired: 0, failed: 0 });
  });

  it('isolates a failed bet so another linked bet can settle', async () => {
    const ctx = await setup([bet('broken'), bet('healthy')]);
    const apply = ctx.adapter.applyBetSettlement.bind(ctx.adapter);
    ctx.adapter.applyBetSettlement = vi.fn(async (input) => {
      if (input.record.betId === 'broken') throw new Error('injected settlement failure');
      return apply(input);
    });

    await expect(ctx.coordinator.reconcile([match])).resolves.toEqual({ examined: 2, settled: 1, manualRequired: 0, failed: 1 });
    expect((await ctx.adapter.listBetRecords(owner)).find((item) => item.betId === 'healthy')?.status).toBe('settled');
  });
});
