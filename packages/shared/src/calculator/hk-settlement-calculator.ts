import type { SettlementType } from '../contracts/core-betting-contracts.js';

export interface HkSettlementInput {
  readonly stakePoints: number;
  readonly oddsValue: number;
  readonly settlementType: SettlementType;
  readonly profitLossPoints?: number;
}

const SCALE = 10_000n;
const toScaled = (value: number, field: string): bigint => {
  if (!Number.isFinite(value)) throw new Error(`${field} must be finite`);
  return BigInt(Math.round(value * Number(SCALE)));
};
const divideRounded = (numerator: bigint, denominator: bigint): bigint => {
  const negative = numerator < 0n;
  const absolute = negative ? -numerator : numerator;
  const rounded = (absolute + denominator / 2n) / denominator;
  return negative ? -rounded : rounded;
};
const fromScaled = (value: bigint): number => Number(value) / Number(SCALE);

export function calculateHkSettlementProfitLoss(input: HkSettlementInput): number {
  if (!Number.isFinite(input.stakePoints) || input.stakePoints <= 0) throw new Error('stakePoints must be positive');
  if (!Number.isFinite(input.oddsValue) || input.oddsValue <= 0) throw new Error('oddsValue must be positive');
  const stake = toScaled(input.stakePoints, 'stakePoints');
  const odds = toScaled(input.oddsValue, 'oddsValue');
  let result: bigint;
  switch (input.settlementType) {
    case 'full_win': result = divideRounded(stake * odds, SCALE); break;
    case 'half_win': result = divideRounded(stake * odds, SCALE * 2n); break;
    case 'push':
    case 'void': result = 0n; break;
    case 'half_loss': result = -divideRounded(stake, 2n); break;
    case 'full_loss': result = -stake; break;
    case 'manual_adjustment':
      if (!Number.isFinite(input.profitLossPoints)) throw new Error('profitLossPoints is required for manual adjustment');
      result = toScaled(input.profitLossPoints!, 'profitLossPoints');
      break;
  }
  return fromScaled(result);
}
