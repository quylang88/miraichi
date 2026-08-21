import { describe, expect, it } from 'vitest';
import { calculateHkSettlementProfitLoss } from './hk-settlement-calculator.js';

describe('HK settlement calculator', () => {
  it.each([
    ['full_win', 95], ['half_win', 47.5], ['push', 0], ['void', 0],
    ['half_loss', -50], ['full_loss', -100]
  ] as const)('calculates %s without a silent fallback', (settlementType, expected) => {
    expect(calculateHkSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType })).toBe(expected);
  });

  it('rounds deterministically to four decimal places', () => {
    expect(calculateHkSettlementProfitLoss({ stakePoints: 10.01, oddsValue: 0.3333, settlementType: 'full_win' })).toBe(3.3363);
  });

  it('requires an explicit signed result for manual adjustment', () => {
    expect(() => calculateHkSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'manual_adjustment' })).toThrow('profitLossPoints');
    expect(calculateHkSettlementProfitLoss({ stakePoints: 100, oddsValue: 0.95, settlementType: 'manual_adjustment', profitLossPoints: -12.3456 })).toBe(-12.3456);
  });

  it('rejects invalid stake and odds instead of guessing', () => {
    expect(() => calculateHkSettlementProfitLoss({ stakePoints: 0, oddsValue: 0.95, settlementType: 'full_win' })).toThrow('stakePoints');
    expect(() => calculateHkSettlementProfitLoss({ stakePoints: 10, oddsValue: Number.NaN, settlementType: 'full_win' })).toThrow('oddsValue');
  });
});
