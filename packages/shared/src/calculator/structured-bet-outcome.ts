import {
  validateLocalMatch,
  validateLocalMatchDetail,
  type LocalMatch,
  type LocalMatchDetail,
  type LocalMatchScore
} from '../contracts/local-match-contracts.js';
import {
  validateStructuredBetSelection,
  type StructuredBetSelection
} from '../contracts/structured-bet-selection.js';
import type { SettlementType } from '../contracts/core-betting-contracts.js';
import type { CloudBetRecord } from '../contracts/cloud-persistence-contracts.js';

export type AutomaticSettlementType = Exclude<SettlementType, 'void' | 'manual_adjustment'>;

export type AutomaticSettlementReviewReason =
  | 'missing_match_link'
  | 'missing_match'
  | 'invalid_match'
  | 'match_not_completed'
  | 'match_identity_mismatch'
  | 'invalid_selection'
  | 'missing_detail'
  | 'invalid_detail'
  | 'stale_detail'
  | 'incomplete_detail'
  | 'contradictory_detail'
  | 'contradictory_score'
  | 'extra_time_ambiguous'
  | 'missing_half_time_score'
  | 'missing_corner_totals'
  | 'missing_placement_minute'
  | 'fixed_window_started'
  | 'incomplete_goal_events'
  | 'invalid_goal_events';

export interface StructuredBetOutcomeEvidence {
  readonly matchId: string;
  readonly matchUpdatedAt: string;
  readonly detailUpdatedAt?: string;
  readonly basis:
    | 'full_time_score'
    | 'half_time_score'
    | 'full_time_corners'
    | 'first_half_corners'
    | 'running_full_time_score_delta'
    | 'running_half_time_score_delta'
    | 'fixed_15_goal_events';
  readonly actualHome?: number;
  readonly actualAway?: number;
  readonly actualTotal: number;
  readonly placementTotal?: number;
  readonly lineValue?: number;
  readonly windowStartMinute?: number;
  readonly windowEndMinute?: number;
}

export type StructuredBetOutcome =
  | {
      readonly status: 'settled';
      readonly settlementType: AutomaticSettlementType;
      readonly evidence: StructuredBetOutcomeEvidence;
    }
  | { readonly status: 'manual_required'; readonly reason: AutomaticSettlementReviewReason };

export type StructuredBetOutcomeCandidate = Pick<CloudBetRecord,
  | 'matchId'
  | 'marketType'
  | 'selectionCode'
  | 'marketPeriod'
  | 'lineValue'
  | 'runningWindow'
  | 'runningGoalThreshold'
  | 'windowStartMinute'
  | 'windowEndMinute'
  | 'liveScoreHome'
  | 'liveScoreAway'
  | 'liveMinute'
  | 'liveContextSource'
  | 'liveContextObservedAt'>;

export interface EvaluateStructuredBetOutcomeInput {
  readonly bet: StructuredBetOutcomeCandidate;
  readonly match: LocalMatch | null;
  readonly detail?: LocalMatchDetail | null;
}

type LegOutcome = 'win' | 'push' | 'loss';

const manual = (reason: AutomaticSettlementReviewReason): StructuredBetOutcome => ({ status: 'manual_required', reason });
const isScore = (score: LocalMatchScore): score is { home: number; away: number } =>
  Number.isSafeInteger(score.home) && Number(score.home) >= 0
  && Number.isSafeInteger(score.away) && Number(score.away) >= 0;
const sameScore = (left: LocalMatchScore, right: LocalMatchScore): boolean =>
  left.home === right.home && left.away === right.away;
const hasAnyScore = (score: LocalMatchScore): boolean => score.home !== null || score.away !== null;
const warningMatches = (detail: LocalMatchDetail, terms: readonly string[]): boolean =>
  (detail.warnings ?? []).some((warning) => terms.some((term) => warning.toLowerCase().includes(term)));

function asianLegs(lineValue: number): readonly number[] {
  const quarters = Math.round(lineValue * 4);
  return Math.abs(quarters) % 2 === 1
    ? [(quarters - 1) / 4, (quarters + 1) / 4]
    : [quarters / 4];
}

function compare(actual: number, line: number, direction: 'over' | 'under'): LegOutcome {
  const difference = direction === 'over' ? actual - line : line - actual;
  return Math.abs(difference) < 1e-8 ? 'push' : difference > 0 ? 'win' : 'loss';
}

function combineLegs(outcomes: readonly LegOutcome[]): AutomaticSettlementType | null {
  const wins = outcomes.filter((outcome) => outcome === 'win').length;
  const pushes = outcomes.filter((outcome) => outcome === 'push').length;
  const losses = outcomes.filter((outcome) => outcome === 'loss').length;
  if (wins === outcomes.length) return 'full_win';
  if (losses === outcomes.length) return 'full_loss';
  if (pushes === outcomes.length) return 'push';
  if (wins > 0 && pushes > 0 && losses === 0) return 'half_win';
  if (losses > 0 && pushes > 0 && wins === 0) return 'half_loss';
  return null;
}

function settleAsian(actual: number, lineValue: number, direction: 'over' | 'under'): AutomaticSettlementType | null {
  return combineLegs(asianLegs(lineValue).map((line) => compare(actual, line, direction)));
}

function inspectDetail(match: LocalMatch, detail: LocalMatchDetail): AutomaticSettlementReviewReason | null {
  if (!validateLocalMatchDetail(detail).ok) return 'invalid_detail';
  if (detail.match.id !== match.id) return 'match_identity_mismatch';
  if (detail.status !== 'completed' || detail.match.status !== 'completed') return 'match_not_completed';
  if (Date.parse(detail.updatedAt) < Date.parse(match.updatedAt)
    || warningMatches(detail, ['stale'])) return 'stale_detail';
  if (!sameScore(detail.match.score, match.score)) return 'contradictory_score';
  if (detail.enrichment) {
    if (detail.enrichment.observedStatus !== 'completed') return 'contradictory_detail';
    if (!isScore(detail.enrichment.score) || !sameScore(detail.enrichment.score, match.score)) return 'contradictory_score';
  }
  const breakdown = detail.scoreBreakdown;
  if (breakdown) {
    if (hasAnyScore(breakdown.extratime) || hasAnyScore(breakdown.penalty)) return 'extra_time_ambiguous';
    if (hasAnyScore(breakdown.fulltime)
      && (!isScore(breakdown.fulltime) || !sameScore(breakdown.fulltime, match.score))) return 'contradictory_score';
  }
  return null;
}

function periodScore(
  period: StructuredBetSelection['marketPeriod'],
  match: LocalMatch,
  detail: LocalMatchDetail | null
): { score: { home: number; away: number }; basis: 'full_time_score' | 'half_time_score'; detailUsed: boolean }
  | AutomaticSettlementReviewReason {
  if (period === 'full_time') return { score: match.score as { home: number; away: number }, basis: 'full_time_score', detailUsed: false };
  if (!detail) return 'missing_detail';
  if (warningMatches(detail, ['partial_detail', 'score_breakdown_partial', 'score_breakdown_unavailable'])) return 'incomplete_detail';
  const score = detail.scoreBreakdown?.halftime;
  if (!score || !isScore(score)) return 'missing_half_time_score';
  if (score.home > Number(match.score.home) || score.away > Number(match.score.away)) return 'contradictory_score';
  return { score, basis: 'half_time_score', detailUsed: true };
}

function statisticCorners(detail: LocalMatchDetail, period: 'all' | 'firstHalf'): { home: number; away: number } | null {
  const row = detail.enrichment?.statistics
    .find((group) => group.period === period)?.rows.find((item) => item.key === 'corners');
  return row && Number.isSafeInteger(row.home.value) && Number.isSafeInteger(row.away.value)
    ? { home: Number(row.home.value), away: Number(row.away.value) }
    : null;
}

function fullTimeTeamCorners(detail: LocalMatchDetail): { home: number; away: number } | null {
  const home = detail.teamStats?.find((row) => row.teamId === detail.match.homeTeam.id)?.cornerKicks;
  const away = detail.teamStats?.find((row) => row.teamId === detail.match.awayTeam.id)?.cornerKicks;
  return Number.isSafeInteger(home) && Number.isSafeInteger(away)
    ? { home: Number(home), away: Number(away) }
    : null;
}

function cornerScore(
  period: StructuredBetSelection['marketPeriod'],
  detail: LocalMatchDetail | null
): { score: { home: number; away: number }; basis: 'full_time_corners' | 'first_half_corners' }
  | AutomaticSettlementReviewReason {
  if (!detail) return 'missing_detail';
  if (warningMatches(detail, ['partial_detail', 'corners_partial', 'corners_unavailable', 'statistics_partial', 'statistics_unavailable'])) {
    return 'incomplete_detail';
  }
  if (period === 'first_half') {
    const score = statisticCorners(detail, 'firstHalf');
    return score ? { score, basis: 'first_half_corners' } : 'missing_corner_totals';
  }
  const stats = statisticCorners(detail, 'all');
  const teamStats = fullTimeTeamCorners(detail);
  if (stats && teamStats && !sameScore(stats, teamStats)) return 'contradictory_detail';
  const score = stats ?? teamStats;
  return score ? { score, basis: 'full_time_corners' } : 'missing_corner_totals';
}

function evidence(input: {
  match: LocalMatch;
  detail?: LocalMatchDetail | null;
  basis: StructuredBetOutcomeEvidence['basis'];
  score?: { home: number; away: number };
  actualTotal: number;
  placementTotal?: number;
  lineValue?: number;
  windowStartMinute?: number;
  windowEndMinute?: number;
}): StructuredBetOutcomeEvidence {
  return {
    matchId: input.match.id,
    matchUpdatedAt: input.match.updatedAt,
    ...(input.detail ? { detailUpdatedAt: input.detail.updatedAt } : {}),
    basis: input.basis,
    ...(input.score ? { actualHome: input.score.home, actualAway: input.score.away } : {}),
    actualTotal: input.actualTotal,
    ...(input.placementTotal === undefined ? {} : { placementTotal: input.placementTotal }),
    ...(input.lineValue === undefined ? {} : { lineValue: input.lineValue }),
    ...(input.windowStartMinute === undefined ? {} : { windowStartMinute: input.windowStartMinute }),
    ...(input.windowEndMinute === undefined ? {} : { windowEndMinute: input.windowEndMinute })
  };
}

function settled(settlementType: AutomaticSettlementType | null, value: StructuredBetOutcomeEvidence): StructuredBetOutcome {
  return settlementType ? { status: 'settled', settlementType, evidence: value } : manual('invalid_selection');
}

function evaluateRunning(
  bet: StructuredBetSelection,
  match: LocalMatch,
  detail: LocalMatchDetail | null
): StructuredBetOutcome {
  if (bet.runningWindow === 'fixed_15') {
    if (bet.liveMinute === undefined) return manual('missing_placement_minute');
    if (bet.windowStartMinute === undefined || bet.windowEndMinute === undefined || bet.liveMinute > bet.windowStartMinute) {
      return manual('fixed_window_started');
    }
    if (!detail) return manual('missing_detail');
    if (warningMatches(detail, ['partial_detail'])) return manual('incomplete_detail');
    if (warningMatches(detail, ['events_partial', 'events_unavailable'])) return manual('incomplete_goal_events');
    const goals = detail.events.filter((event) => event.type === 'goal');
    if (goals.some((goal) => goal.minute === null)) return manual('invalid_goal_events');
    if (goals.length !== Number(match.score.home) + Number(match.score.away)) return manual('incomplete_goal_events');
    const total = goals.filter((goal) => Number(goal.minute) > bet.windowStartMinute!
      && Number(goal.minute) <= bet.windowEndMinute!).length;
    return settled(settleAsian(total, 0.5, 'over'), evidence({
      match, detail, basis: 'fixed_15_goal_events', actualTotal: total, lineValue: 0.5,
      windowStartMinute: bet.windowStartMinute, windowEndMinute: bet.windowEndMinute
    }));
  }

  const scoreResult = periodScore(bet.runningWindow === 'to_half_time' ? 'first_half' : 'full_time', match, detail);
  if (typeof scoreResult === 'string') return manual(scoreResult);
  const placementHome = Number(bet.liveScoreHome);
  const placementAway = Number(bet.liveScoreAway);
  if (scoreResult.score.home < placementHome || scoreResult.score.away < placementAway) return manual('contradictory_score');
  const placementTotal = placementHome + placementAway;
  const total = scoreResult.score.home + scoreResult.score.away - placementTotal;
  const lineValue = Number(bet.runningGoalThreshold);
  return settled(settleAsian(total, lineValue, 'over'), evidence({
    match,
    ...(scoreResult.detailUsed ? { detail } : {}),
    basis: bet.runningWindow === 'to_half_time' ? 'running_half_time_score_delta' : 'running_full_time_score_delta',
    score: scoreResult.score,
    actualTotal: total,
    placementTotal,
    lineValue
  }));
}

export function evaluateStructuredBetOutcome(input: EvaluateStructuredBetOutcomeInput): StructuredBetOutcome {
  if (!input.bet.matchId) return manual('missing_match_link');
  if (!input.match) return manual('missing_match');
  if (input.match.id !== input.bet.matchId) return manual('match_identity_mismatch');
  if (!validateLocalMatch(input.match).ok) return manual('invalid_match');
  if (input.match.status !== 'completed' || !isScore(input.match.score)) return manual('match_not_completed');
  if (!validateStructuredBetSelection(input.bet).ok) return manual('invalid_selection');

  const detail = input.detail ?? null;
  if (detail) {
    const unsafe = inspectDetail(input.match, detail);
    if (unsafe) return manual(unsafe);
  }

  const bet = input.bet as StructuredBetSelection;
  if (bet.marketType === 'running') return evaluateRunning(bet, input.match, detail);

  const result = bet.marketType === 'corners'
    ? cornerScore(bet.marketPeriod, detail)
    : periodScore(bet.marketPeriod, input.match, detail);
  if (typeof result === 'string') return manual(result);
  const total = result.score.home + result.score.away;
  const resultEvidence = evidence({
    match: input.match,
    ...(('detailUsed' in result && result.detailUsed) || bet.marketType === 'corners' ? { detail } : {}),
    basis: result.basis,
    score: result.score,
    actualTotal: total,
    ...(bet.lineValue === undefined || bet.lineValue === null ? {} : { lineValue: bet.lineValue })
  });

  if (bet.marketType === '1X2') {
    const winner = result.score.home === result.score.away ? 'draw' : result.score.home > result.score.away ? 'home' : 'away';
    return settled(bet.selectionCode === winner ? 'full_win' : 'full_loss', resultEvidence);
  }
  if (bet.marketType === 'handicap') {
    const selected = bet.selectionCode === 'home' ? result.score.home - result.score.away : result.score.away - result.score.home;
    return settled(settleAsian(selected, -Number(bet.lineValue), 'over'), resultEvidence);
  }
  return settled(settleAsian(total, Number(bet.lineValue), bet.selectionCode as 'over' | 'under'), resultEvidence);
}
