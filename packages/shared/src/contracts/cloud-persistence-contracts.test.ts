import { describe, expect, it } from 'vitest';
import {
  createCloudBackupEnvelopeV3,
  validateBankrollLedgerEntry,
  validateCloudBetRecord,
  validateCloudPersistenceStatus,
  verifyCloudBackupEnvelopeV3
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

  it('validates settlement review state as one coherent projection', () => {
    const base = {
      betId: 'bet-001', ownerProfileId: 'owner-primary', matchGroupId: 'match-group-001',
      homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2', selectionLabel: 'Japan',
      oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10,
      createdAt: '2026-09-16T00:00:00.000Z', updatedAt: '2026-09-16T00:00:00.000Z'
    };
    expect(validateCloudBetRecord({ ...base, status: 'pending', settlementReviewStatus: 'manual_required',
      settlementReviewReason: 'missing_detail', settlementEvidenceAt: '2026-09-16T00:00:00.000Z' })).toEqual({ ok: true });
    expect(validateCloudBetRecord({ ...base, status: 'settled', settlementReviewStatus: 'auto_settled',
      settlementEvidenceAt: '2026-09-16T00:00:00.000Z' })).toEqual({ ok: true });
    for (const invalid of [
      { status: 'settled', settlementReviewStatus: 'manual_required', settlementReviewReason: 'missing_detail', settlementEvidenceAt: '2026-09-16T00:00:00.000Z' },
      { status: 'pending', settlementReviewStatus: 'manual_required', settlementReviewReason: 'invented', settlementEvidenceAt: '2026-09-16T00:00:00.000Z' },
      { status: 'pending', settlementReviewStatus: 'manual_required', settlementReviewReason: 'missing_detail' },
      { status: 'settled', settlementReviewStatus: 'auto_settled', settlementReviewReason: 'missing_detail', settlementEvidenceAt: 'bad' }
    ]) expect(validateCloudBetRecord({ ...base, ...invalid })).toMatchObject({ ok: false });
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

  it('creates a canonical V3 owner envelope whose hash detects payload changes', async () => {
    const envelope = await createCloudBackupEnvelopeV3({
      exportedAt: '2026-09-27T12:00:00.000Z',
      ownerProfileId: 'owner-primary',
      ownerProfile: {
        ownerProfileId: 'owner-primary', label: 'Quy', settings: { locale: 'vi', theme: 'dark' },
        createdAt: '2026-07-02T00:00:00.000Z', updatedAt: '2026-09-27T00:00:00.000Z'
      },
      drafts: [], bets: [], bankrollAccounts: [], bankrollLedgerEntries: [],
      disciplineConfigs: [], settlementEvents: []
    });
    expect(envelope).toMatchObject({
      schemaVersion: 'miraichi.cloud-backup.v3',
      recordCounts: {
        ownerProfiles: 1, betDrafts: 0, bets: 0, bankrollAccounts: 0,
        bankrollLedgerEntries: 0, disciplineConfigs: 0, settlementEvents: 0
      },
      payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    await expect(verifyCloudBackupEnvelopeV3(envelope)).resolves.toBe(true);
    await expect(verifyCloudBackupEnvelopeV3({
      ...envelope,
      ownerProfile: { ...envelope.ownerProfile!, settings: { locale: 'en' } }
    })).resolves.toBe(false);
    expect(envelope).not.toHaveProperty('matches');
    expect(envelope).not.toHaveProperty('providerState');
    expect(envelope).not.toHaveProperty('disciplineChallenges');
  });

  it('orders settlement corrections after the events they correct', async () => {
    const now = '2026-09-27T12:00:00.000Z';
    const envelope = await createCloudBackupEnvelopeV3({
      exportedAt: now,
      ownerProfileId: 'owner-primary',
      ownerProfile: {
        ownerProfileId: 'owner-primary', label: 'Quy', settings: {},
        createdAt: now, updatedAt: now
      },
      drafts: [],
      bets: [{
        betId: 'bet-001', ownerProfileId: 'owner-primary', matchGroupId: 'match-001',
        homeTeamName: 'A', awayTeamName: 'B', marketType: '1X2', selectionLabel: 'A',
        oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'settled',
        bankrollAccountId: 'account-001', createdAt: now, updatedAt: now
      }],
      bankrollAccounts: [{
        accountId: 'account-001', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points',
        openingBalancePoints: 100, currentBalancePoints: 109, archived: false,
        createdAt: now, updatedAt: now
      }],
      bankrollLedgerEntries: [], disciplineConfigs: [],
      settlementEvents: [{
        settlementEventId: 'a-correction', ownerProfileId: 'owner-primary', betId: 'bet-001',
        bankrollAccountId: 'account-001', settlementType: 'manual_adjustment', adjustmentReason: 'Correction',
        calculatedProfitLossPoints: 9, ledgerDeltaPoints: -1, effectiveAt: now, occurredAt: now,
        correctsSettlementEventId: 'z-base'
      }, {
        settlementEventId: 'z-base', ownerProfileId: 'owner-primary', betId: 'bet-001',
        bankrollAccountId: 'account-001', settlementType: 'full_win',
        calculatedProfitLossPoints: 10, ledgerDeltaPoints: 10, effectiveAt: now, occurredAt: now
      }]
    });

    expect(envelope.settlementEvents.map((event) => event.settlementEventId)).toEqual(['z-base', 'a-correction']);
    await expect(verifyCloudBackupEnvelopeV3({
      ...envelope,
      settlementEvents: [...envelope.settlementEvents].reverse()
    })).resolves.toBe(false);
  });

  it('rejects V3 collections with broken relationships before hashing', async () => {
    const now = '2026-09-27T12:00:00.000Z';
    await expect(createCloudBackupEnvelopeV3({
      exportedAt: now,
      ownerProfileId: 'owner-primary',
      ownerProfile: {
        ownerProfileId: 'owner-primary', label: 'Quy', settings: {},
        createdAt: now, updatedAt: now
      },
      drafts: [], bets: [], bankrollAccounts: [], disciplineConfigs: [], settlementEvents: [],
      bankrollLedgerEntries: [{
        entryId: 'entry-001', ownerProfileId: 'owner-primary', accountId: 'missing-account',
        entryType: 'deposit', amountPoints: 100, occurredAt: now, createdAt: now
      }]
    })).rejects.toThrow('unknown bankroll account');
  });
});
