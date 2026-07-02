import { describe, expect, it } from 'vitest';
import {
  validateBankrollLedgerEntry,
  validateCloudBetRecord,
  validateCloudPersistenceStatus
} from './cloud-persistence-contracts.js';

describe('cloud persistence contracts', () => {
  it('accepts owner-entered pending bet records', () => {
    expect(validateCloudBetRecord({
      betId: 'bet-001', ownerProfileId: 'owner-primary', matchGroupId: 'match-group-001',
      homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2',
      selectionLabel: 'Japan', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10,
      status: 'pending', createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('rejects forbidden formula and AI fields', () => {
    expect(validateCloudBetRecord({
      betId: 'bet-001', ownerProfileId: 'owner-primary', roi: 12,
      recommendedStake: 20, predictionTraceId: 'trace-001'
    })).toMatchObject({ ok: false });
  });

  it('rejects forbidden fields nested in payloads', () => {
    expect(validateCloudBetRecord({
      betId: 'bet-001', ownerProfileId: 'owner-primary', notes: { riskScore: 3 }
    })).toMatchObject({ ok: false });
  });

  it('accepts signed manual ledger amounts but no risk fields', () => {
    expect(validateBankrollLedgerEntry({
      entryId: 'entry-001', ownerProfileId: 'owner-primary', accountId: 'account-001',
      entryType: 'deposit', amountPoints: 1000,
      occurredAt: '2026-07-02T00:00:00.000Z', createdAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('rejects zero-value ledger entries', () => {
    expect(validateBankrollLedgerEntry({
      entryId: 'entry-001', ownerProfileId: 'owner-primary', accountId: 'account-001',
      entryType: 'correction', amountPoints: 0,
      occurredAt: '2026-07-02T00:00:00.000Z', createdAt: '2026-07-02T00:00:00.000Z'
    })).toMatchObject({ ok: false });
  });

  it('represents missing cloud configuration honestly', () => {
    expect(validateCloudPersistenceStatus({
      provider: 'supabase-postgres', mode: 'disabled', state: 'unconfigured',
      checkedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });
});
