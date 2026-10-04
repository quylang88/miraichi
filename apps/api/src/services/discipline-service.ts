import { createHash } from 'node:crypto';
import type { BetSettlementEvent, DisciplineChallenge, DisciplineConfig, DisciplineRuleType, PreBetMotivation } from '@miraichi/shared';

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
const weekStart = (key: string, weekStartDay: 'monday' | 'sunday' = 'monday'): string => {
  const date = new Date(`${key}T00:00:00.000Z`);
  const day = date.getUTCDay();
  if (weekStartDay === 'sunday') {
    date.setUTCDate(date.getUTCDate() - day);
  } else {
    const diff = day === 0 ? 6 : day - 1;
    date.setUTCDate(date.getUTCDate() - diff);
  }
  return date.toISOString().slice(0, 10);
};
const round4 = (value: number): number => Math.round((value + Number.EPSILON) * 10_000) / 10_000;

const RISKY_MOTIVATIONS = new Set<PreBetMotivation>(['chasing_loss', 'fomo', 'impulse']);

export function evaluateDisciplineAttempt({ config, stakePoints, availableBalancePoints, preBetMotivation, settlementEvents, at }: {
  readonly config: DisciplineConfig | null;
  readonly stakePoints: number;
  readonly availableBalancePoints?: number | null;
  readonly preBetMotivation?: PreBetMotivation;
  readonly settlementEvents: readonly BetSettlementEvent[];
  readonly at: string;
}): DisciplineEvaluation {
  let dailyProfitLossPoints = 0;
  let weeklyProfitLossPoints = 0;
  if (config) {
    const weekStartDay = config.weekStartDay ?? 'monday';
    const currentDate = dateKey(at, config.timeZone);
    const currentWeek = weekStart(currentDate, weekStartDay);
    for (const event of settlementEvents) {
      const effectiveDate = dateKey(event.effectiveAt, config.timeZone);
      if (effectiveDate === currentDate) dailyProfitLossPoints += event.ledgerDeltaPoints;
      if (weekStart(effectiveDate, weekStartDay) === currentWeek) weeklyProfitLossPoints += event.ledgerDeltaPoints;
    }
  }
  dailyProfitLossPoints = round4(dailyProfitLossPoints);
  weeklyProfitLossPoints = round4(weeklyProfitLossPoints);
  const triggeredRules: DisciplineRuleType[] = [];
  if (config?.bigBetThresholdPoints !== null && config?.bigBetThresholdPoints !== undefined && stakePoints >= config.bigBetThresholdPoints) triggeredRules.push('big_bet');
  if (config?.dailyStopLossPoints !== null && config?.dailyStopLossPoints !== undefined && dailyProfitLossPoints <= -config.dailyStopLossPoints) triggeredRules.push('daily_stop_loss');
  if (config?.weeklyStopLossPoints !== null && config?.weeklyStopLossPoints !== undefined && weeklyProfitLossPoints <= -config.weeklyStopLossPoints) triggeredRules.push('weekly_stop_loss');
  if (availableBalancePoints !== null && availableBalancePoints !== undefined && Number.isFinite(availableBalancePoints) && stakePoints > availableBalancePoints) triggeredRules.push('overexposure');
  if (preBetMotivation && RISKY_MOTIVATIONS.has(preBetMotivation)) triggeredRules.push('risky_motivation');
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
  readonly config: DisciplineConfig | null;
  readonly evaluation: DisciplineEvaluation;
  readonly now: string;
}): DisciplineChallenge {
  return {
    challengeId, ownerProfileId, payloadHash: hashBetAttemptPayload(payload), ruleVersion: config?.version ?? 0,
    triggeredRules: [...evaluation.triggeredRules], dailyProfitLossPoints: evaluation.dailyProfitLossPoints,
    weeklyProfitLossPoints: evaluation.weeklyProfitLossPoints, createdAt: now,
    availableAt: new Date(new Date(now).getTime() + (config?.cooldownSeconds ?? 15) * 1000).toISOString()
  };
}
