export const PRE_BET_EMOTIONS = Object.freeze(['calm', 'excited', 'frustrated', 'anxious', 'tired'] as const);
export const PRE_BET_MOTIVATIONS = Object.freeze(['planned_analysis', 'familiar_market', 'chasing_loss', 'fomo', 'impulse', 'other'] as const);
export const PLAN_ADHERENCE_VALUES = Object.freeze(['yes', 'partly', 'no'] as const);
export const SETTLEMENT_TYPES = Object.freeze(['full_win', 'half_win', 'push', 'void', 'half_loss', 'full_loss', 'manual_adjustment'] as const);
export const DISCIPLINE_RULE_TYPES = Object.freeze(['big_bet', 'daily_stop_loss', 'weekly_stop_loss'] as const);
export const WEEK_START_DAYS = Object.freeze(['monday', 'sunday'] as const);

export type PreBetEmotion = typeof PRE_BET_EMOTIONS[number];
export type PreBetMotivation = typeof PRE_BET_MOTIVATIONS[number];
export type PlanAdherence = typeof PLAN_ADHERENCE_VALUES[number];
export type SettlementType = typeof SETTLEMENT_TYPES[number];
export type DisciplineRuleType = typeof DISCIPLINE_RULE_TYPES[number];
export type WeekStartDay = typeof WEEK_START_DAYS[number];

export interface DisciplineConfig {
  readonly ownerProfileId: string;
  readonly dailyStopLossPoints: number | null;
  readonly weeklyStopLossPoints: number | null;
  readonly bigBetThresholdPoints: number | null;
  readonly timeZone: string;
  readonly weekStartDay?: 'monday' | 'sunday';
  readonly cooldownSeconds: 15;
  readonly version: number;
  readonly updatedAt: string;
}

export interface CreateOngoingBetInput {
  readonly betId: string;
  readonly matchGroupId: string;
  readonly bankrollAccountId?: string;
  readonly matchId?: string | null;
  readonly homeTeamName: string;
  readonly awayTeamName: string;
  readonly competitionLabel?: string;
  readonly marketType: '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom';
  readonly customMarketLabel?: string;
  readonly selectionLabel: string;
  readonly lineValue?: number | null;
  readonly oddsFormat: 'HK';
  readonly oddsValue: number;
  readonly stakePoints: number;
  readonly preBetEmotion: PreBetEmotion;
  readonly preBetMotivation: PreBetMotivation;
  readonly preBetNote?: string;
  readonly notes?: string;
  readonly createdAt: string;
  readonly disciplineChallengeId?: string;
}

export interface DisciplineSnapshot {
  readonly ruleVersion: number;
  readonly triggeredRules: readonly DisciplineRuleType[];
  readonly dailyProfitLossPoints: number;
  readonly weeklyProfitLossPoints: number;
  readonly thresholds: Pick<DisciplineConfig, 'dailyStopLossPoints' | 'weeklyStopLossPoints' | 'bigBetThresholdPoints'>;
  readonly acknowledgedAt?: string;
}

export interface SettlementCommand {
  readonly settlementEventId: string;
  readonly settlementType: SettlementType;
  readonly planAdherence: PlanAdherence;
  readonly lessonNote?: string;
  readonly profitLossPoints?: number;
  readonly adjustmentReason?: string;
  readonly effectiveAt: string;
  readonly correctsSettlementEventId?: string;
}

export interface BetSettlementEvent extends SettlementCommand {
  readonly ownerProfileId: string;
  readonly betId: string;
  readonly bankrollAccountId: string;
  readonly calculatedProfitLossPoints: number;
  readonly ledgerDeltaPoints: number;
  readonly occurredAt: string;
}

export interface DisciplineChallenge {
  readonly challengeId: string;
  readonly ownerProfileId: string;
  readonly payloadHash: string;
  readonly ruleVersion: number;
  readonly triggeredRules: readonly DisciplineRuleType[];
  readonly dailyProfitLossPoints: number;
  readonly weeklyProfitLossPoints: number;
  readonly availableAt: string;
  readonly createdAt: string;
  readonly consumedAt?: string;
}

export type ContractValidationResult = { ok: true } | { ok: false; errors: string[] };

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const decimalsAtMost = (value: number, places: number): boolean =>
  Math.abs(value * (10 ** places) - Math.round(value * (10 ** places))) < 1e-7;

export function isValidIanaTimeZone(value: unknown): value is string {
  if (!text(value)) return false;
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(0); return true; } catch { return false; }
}

export function validateDisciplineConfig(input: unknown): ContractValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['Input must be an object'] };
  const value = input as Partial<DisciplineConfig>;
  const errors: string[] = [];
  if (!text(value.ownerProfileId)) errors.push('ownerProfileId is required');
  for (const key of ['dailyStopLossPoints', 'weeklyStopLossPoints', 'bigBetThresholdPoints'] as const) {
    const threshold = value[key];
    if (threshold !== null && (!finite(threshold) || threshold <= 0 || !decimalsAtMost(threshold, 2))) errors.push(`${key} must be null or a positive number with at most 2 decimals`);
  }
  if (!isValidIanaTimeZone(value.timeZone)) errors.push('timeZone must be a valid IANA timezone');
  if (value.weekStartDay !== undefined && !WEEK_START_DAYS.includes(value.weekStartDay as WeekStartDay)) {
    errors.push('weekStartDay must be monday or sunday');
  }
  if (value.cooldownSeconds !== 15) errors.push('cooldownSeconds must be 15 in V1');
  if (!Number.isInteger(value.version) || Number(value.version) < 1) errors.push('version must be a positive integer');
  if (!text(value.updatedAt) || !ISO.test(value.updatedAt)) errors.push('updatedAt must be an ISO datetime');
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateCreateOngoingBetInput(input: unknown): ContractValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['Input must be an object'] };
  const value = input as Partial<CreateOngoingBetInput>;
  const errors: string[] = [];
  for (const key of ['betId', 'matchGroupId', 'homeTeamName', 'awayTeamName', 'selectionLabel'] as const) {
    if (!text(value[key])) errors.push(`${key} is required`);
  }
  if (value.bankrollAccountId !== undefined && typeof value.bankrollAccountId !== 'string') errors.push('bankrollAccountId is invalid');
  if (!['1X2', 'over_under', 'handicap', 'corners', 'custom'].includes(String(value.marketType))) errors.push('marketType is invalid');
  if (value.oddsFormat !== 'HK') errors.push('oddsFormat must be HK');
  if (!finite(value.oddsValue) || value.oddsValue <= 0 || !decimalsAtMost(value.oddsValue, 4)) errors.push('oddsValue must be positive with at most 4 decimals');
  if (!finite(value.stakePoints) || value.stakePoints <= 0 || !decimalsAtMost(value.stakePoints, 2)) errors.push('stakePoints must be positive with at most 2 decimals');
  if (!PRE_BET_EMOTIONS.includes(value.preBetEmotion as PreBetEmotion)) errors.push('preBetEmotion is invalid');
  if (!PRE_BET_MOTIVATIONS.includes(value.preBetMotivation as PreBetMotivation)) errors.push('preBetMotivation is invalid');
  if (!text(value.createdAt) || !ISO.test(value.createdAt)) errors.push('createdAt must be an ISO datetime');
  return errors.length ? { ok: false, errors } : { ok: true };
}

export function validateSettlementCommand(input: unknown): ContractValidationResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, errors: ['Input must be an object'] };
  const value = input as Partial<SettlementCommand>;
  const errors: string[] = [];
  if (!text(value.settlementEventId)) errors.push('settlementEventId is required');
  if (!SETTLEMENT_TYPES.includes(value.settlementType as SettlementType)) errors.push('settlementType is invalid');
  if (!PLAN_ADHERENCE_VALUES.includes(value.planAdherence as PlanAdherence)) errors.push('planAdherence is invalid');
  if (!text(value.effectiveAt) || !ISO.test(value.effectiveAt)) errors.push('effectiveAt must be an ISO datetime');
  if (value.settlementType === 'manual_adjustment') {
    if (!finite(value.profitLossPoints) || !decimalsAtMost(value.profitLossPoints, 4)) errors.push('profitLossPoints is required with at most 4 decimals');
    if (!text(value.adjustmentReason)) errors.push('adjustmentReason is required for manual adjustment');
  } else if (value.profitLossPoints !== undefined || value.adjustmentReason !== undefined) {
    errors.push('Standard settlement cannot provide a manual result');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
