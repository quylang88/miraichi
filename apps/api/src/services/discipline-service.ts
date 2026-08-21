import { createHash } from 'node:crypto';
import type { BetSettlementEvent, DisciplineChallenge, DisciplineConfig, DisciplineRuleType } from '@miraichi/shared';

export interface DisciplineEvaluation {
  readonly triggeredRules: DisciplineRuleType[];
  readonly dailyProfitLossPoints: number;
  readonly weeklyProfitLossPoints: number;
}

const dateKey = (iso: string, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};
const weekStart = (key: string): string => {
  const date = new Date(`${key}T00:00:00.000Z`);
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() - day + 1);
  return date.toISOString().slice(0, 10);
};
const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10_000) / 10_000;

export function evaluateDisciplineAttempt({ config, stakePoints, settlementEvents, at }: {
  readonly config: DisciplineConfig | null;
  readonly stakePoints: number;
  readonly settlementEvents: readonly BetSettlementEvent[];
  readonly at: string;
}): DisciplineEvaluation {
  if (!config) return { triggeredRules: [], dailyProfitLossPoints: 0, weeklyProfitLossPoints: 0 };
  const currentDate = dateKey(at, config.timeZone);
  const currentWeek = weekStart(currentDate);
  let dailyProfitLossPoints = 0;
  let weeklyProfitLossPoints = 0;
  for (const event of settlementEvents) {
    const effectiveDate = dateKey(event.effectiveAt, config.timeZone);
    if (effectiveDate === currentDate) dailyProfitLossPoints += event.ledgerDeltaPoints;
    if (weekStart(effectiveDate) === currentWeek) weeklyProfitLossPoints += event.ledgerDeltaPoints;
  }
  dailyProfitLossPoints = round4(dailyProfitLossPoints);
  weeklyProfitLossPoints = round4(weeklyProfitLossPoints);
  const triggeredRules: DisciplineRuleType[] = [];
  if (config.bigBetThresholdPoints !== null && stakePoints >= config.bigBetThresholdPoints) triggeredRules.push('big_bet');
  if (config.dailyStopLossPoints !== null && dailyProfitLossPoints <= -config.dailyStopLossPoints) triggeredRules.push('daily_stop_loss');
  if (config.weeklyStopLossPoints !== null && weeklyProfitLossPoints <= -config.weeklyStopLossPoints) triggeredRules.push('weekly_stop_loss');
  return { triggeredRules, dailyProfitLossPoints, weeklyProfitLossPoints };
}

const canonical = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).filter(([key]) => key !== 'disciplineChallengeId').sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
};

export function hashBetAttemptPayload(payload: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonical(payload)), 'utf8').digest('hex');
}

export function buildDisciplineChallenge({ challengeId, ownerProfileId, payload, config, evaluation, now }: {
  readonly challengeId: string;
  readonly ownerProfileId: string;
  readonly payload: unknown;
  readonly config: DisciplineConfig;
  readonly evaluation: DisciplineEvaluation;
  readonly now: string;
}): DisciplineChallenge {
  return {
    challengeId, ownerProfileId, payloadHash: hashBetAttemptPayload(payload), ruleVersion: config.version,
    triggeredRules: [...evaluation.triggeredRules], dailyProfitLossPoints: evaluation.dailyProfitLossPoints,
    weeklyProfitLossPoints: evaluation.weeklyProfitLossPoints, createdAt: now,
    availableAt: new Date(new Date(now).getTime() + config.cooldownSeconds * 1000).toISOString()
  };
}
