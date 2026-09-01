import { describe, expect, it } from 'vitest';
import {
  validateCreateOngoingBetInput,
  validateDisciplineConfig,
  validateSettlementCommand,
  type DisciplineConfig
} from './core-betting-contracts.js';

const config: DisciplineConfig = {
  ownerProfileId: 'owner-primary', dailyStopLossPoints: null, weeklyStopLossPoints: null,
  bigBetThresholdPoints: null, timeZone: 'Asia/Tokyo', cooldownSeconds: 15,
  version: 1, updatedAt: '2026-08-21T00:00:00.000Z'
};

const bet = {
  betId: 'bet-1', matchGroupId: 'group-1', bankrollAccountId: 'account-1',
  homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2' as const,
  selectionLabel: 'Japan', oddsFormat: 'HK' as const, oddsValue: 0.95, stakePoints: 10.25,
  preBetEmotion: 'calm' as const, preBetMotivation: 'planned_analysis' as const,
  createdAt: '2026-08-21T00:00:00.000Z'
};

describe('core betting contracts', () => {
  it('accepts nullable thresholds and a real IANA timezone without seeding defaults', () => {
    expect(validateDisciplineConfig(config)).toEqual({ ok: true });
    expect(validateDisciplineConfig({ ...config, timeZone: 'not/a-zone' }).ok).toBe(false);
    expect(validateDisciplineConfig({ ...config, dailyStopLossPoints: 0 }).ok).toBe(false);
    expect(validateDisciplineConfig({ ...config, cooldownSeconds: 10 }).ok).toBe(false);
  });

  it('validates optional weekStartDay correctly', () => {
    expect(validateDisciplineConfig({ ...config, weekStartDay: 'monday' })).toEqual({ ok: true });
    expect(validateDisciplineConfig({ ...config, weekStartDay: 'sunday' })).toEqual({ ok: true });
    expect(validateDisciplineConfig({ ...config, weekStartDay: 'tuesday' as never }).ok).toBe(false);
    expect(validateDisciplineConfig({ ...config, weekStartDay: '' as never }).ok).toBe(false);
    expect(validateDisciplineConfig({ ...config, weekStartDay: null as never }).ok).toBe(false);
  });

  it('requires complete manual bet psychology and precise numeric input while account binding stays server-side', () => {
    expect(validateCreateOngoingBetInput(bet)).toEqual({ ok: true });
    const { bankrollAccountId: _account, ...withoutAccount } = bet;
    expect(validateCreateOngoingBetInput(withoutAccount)).toEqual({ ok: true });
    expect(validateCreateOngoingBetInput({ ...bet, bankrollAccountId: '' })).toEqual({ ok: true });
    expect(validateCreateOngoingBetInput({ ...bet, stakePoints: 10.123 }).ok).toBe(false);
    expect(validateCreateOngoingBetInput({ ...bet, oddsValue: 0.12345 }).ok).toBe(false);
    expect(validateCreateOngoingBetInput({ ...bet, preBetMotivation: 'winning_system' }).ok).toBe(false);
  });

  it('requires plan adherence and a reason for manual adjustment', () => {
    expect(validateSettlementCommand({
      settlementEventId: 'settlement-1', settlementType: 'full_win', planAdherence: 'yes',
      effectiveAt: '2026-08-21T01:00:00.000Z'
    })).toEqual({ ok: true });
    expect(validateSettlementCommand({
      settlementEventId: 'settlement-2', settlementType: 'manual_adjustment', planAdherence: 'partly',
      profitLossPoints: -2.5, effectiveAt: '2026-08-21T01:00:00.000Z'
    }).ok).toBe(false);
    expect(validateSettlementCommand({
      settlementEventId: 'settlement-3', settlementType: 'manual_adjustment', planAdherence: 'no',
      profitLossPoints: -2.5, adjustmentReason: 'Operator cashout', effectiveAt: '2026-08-21T01:00:00.000Z'
    })).toEqual({ ok: true });
  });
});
