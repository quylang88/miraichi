import { describe, expect, it } from 'vitest';
import type { LocalMatch, LocalMatchDetail } from '../contracts/local-match-contracts.js';
import type { StructuredBetSelection } from '../contracts/structured-bet-selection.js';
import { evaluateStructuredBetOutcome } from './structured-bet-outcome.js';

const updatedAt = '2026-09-15T12:00:00.000Z';
const homeId = 'team-home';
const awayId = 'team-away';

function completedMatch(home = 3, away = 1): LocalMatch {
  return {
    id: 'match-1',
    competition: { id: 'league-1', name: 'League', type: 'club', season: '2026' },
    kickoffUtc: '2026-09-15T09:00:00.000Z',
    status: 'completed',
    homeTeam: { id: homeId, name: 'Home FC' },
    awayTeam: { id: awayId, name: 'Away FC' },
    score: { home, away },
    sourceRefs: [{ sourceId: 'openfootball', importedAt: updatedAt }],
    updatedAt
  };
}

function completedDetail(overrides: Partial<LocalMatchDetail> = {}): LocalMatchDetail {
  const match = completedMatch();
  return {
    match,
    status: 'completed',
    elapsedMinute: null,
    scoreBreakdown: {
      halftime: { home: 1, away: 1 },
      fulltime: { home: 3, away: 1 },
      extratime: { home: null, away: null },
      penalty: { home: null, away: null }
    },
    events: [
      { minute: 15, teamId: homeId, type: 'goal', label: 'goal' },
      { minute: 30, teamId: awayId, type: 'goal', label: 'goal' },
      { minute: 31, teamId: homeId, type: 'goal', label: 'goal' },
      { minute: 90, extraMinute: 2, teamId: homeId, type: 'goal', label: 'goal' }
    ],
    teamStats: [
      { teamId: homeId, cornerKicks: 7, yellowCards: null, redCards: null, totalShots: null, shotsOnGoal: null, possessionPercentage: null },
      { teamId: awayId, cornerKicks: 3, yellowCards: null, redCards: null, totalShots: null, shotsOnGoal: null, possessionPercentage: null }
    ],
    enrichment: {
      observedStatus: 'completed',
      score: { home: 3, away: 1 },
      statistics: [
        { period: 'all', rows: [{ key: 'corners', home: { value: 7 }, away: { value: 3 } }] },
        { period: 'firstHalf', rows: [{ key: 'corners', home: { value: 2 }, away: { value: 1 } }] }
      ],
      players: [], shots: [], coaches: []
    },
    warnings: [],
    updatedAt,
    ...overrides
  };
}

function evaluate(selection: StructuredBetSelection, options: {
  match?: LocalMatch | null;
  detail?: LocalMatchDetail | null;
  matchId?: string | null;
} = {}) {
  return evaluateStructuredBetOutcome({
    bet: { matchId: options.matchId === undefined ? 'match-1' : options.matchId, ...selection },
    match: options.match === undefined ? completedMatch() : options.match,
    detail: options.detail === undefined ? completedDetail() : options.detail
  });
}

describe('structured bet outcome evaluator', () => {
  it.each([
    ['over', 2.5, 4, 'full_win'],
    ['over', 4, 4, 'push'],
    ['over', 4.5, 4, 'full_loss'],
    ['over', 3.75, 4, 'half_win'],
    ['over', 4.25, 4, 'half_loss'],
    ['under', 4.5, 4, 'full_win'],
    ['under', 4, 4, 'push'],
    ['under', 3.5, 4, 'full_loss'],
    ['under', 4.25, 4, 'half_win'],
    ['under', 3.75, 4, 'half_loss']
  ] as const)('settles %s %.2f at %d goals as %s', (selectionCode, lineValue, _total, settlementType) => {
    expect(evaluate({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode, lineValue }))
      .toMatchObject({ status: 'settled', settlementType, evidence: { basis: 'full_time_score', actualTotal: 4, lineValue } });
  });

  it('settles 1X2 for full time and first half', () => {
    expect(evaluate({ marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'home' }))
      .toMatchObject({ status: 'settled', settlementType: 'full_win' });
    expect(evaluate({ marketType: '1X2', marketPeriod: 'first_half', selectionCode: 'draw' }))
      .toMatchObject({ status: 'settled', settlementType: 'full_win', evidence: { basis: 'half_time_score' } });
    expect(evaluate({ marketType: '1X2', marketPeriod: 'first_half', selectionCode: 'away' }))
      .toMatchObject({ status: 'settled', settlementType: 'full_loss' });
  });

  it('applies the signed handicap to the selected side', () => {
    expect(evaluate({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'away', lineValue: 2 }))
      .toMatchObject({ status: 'settled', settlementType: 'push', evidence: { actualHome: 3, actualAway: 1, lineValue: 2 } });
    expect(evaluate({ marketType: 'handicap', marketPeriod: 'first_half', selectionCode: 'home', lineValue: -0.25 }))
      .toMatchObject({ status: 'settled', settlementType: 'half_loss' });
  });

  it('uses period-specific goals and corners', () => {
    expect(evaluate({ marketType: 'over_under', marketPeriod: 'first_half', selectionCode: 'under', lineValue: 2.25 }))
      .toMatchObject({ status: 'settled', settlementType: 'half_win', evidence: { actualTotal: 2 } });
    expect(evaluate({ marketType: 'corners', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 9.5 }))
      .toMatchObject({ status: 'settled', settlementType: 'full_win', evidence: { basis: 'full_time_corners', actualTotal: 10 } });
    expect(evaluate({ marketType: 'corners', marketPeriod: 'first_half', selectionCode: 'under', lineValue: 3.25 }))
      .toMatchObject({ status: 'settled', settlementType: 'half_win', evidence: { basis: 'first_half_corners', actualTotal: 3 } });
  });

  it.each([
    [0.5, 0, 'full_loss'],
    [0.5, 1, 'full_win'],
    [0.75, 0, 'full_loss'],
    [0.75, 1, 'half_win'],
    [0.75, 2, 'full_win']
  ] as const)('settles Running FT threshold %s with %s later goals as %s', (runningGoalThreshold, addedGoals, settlementType) => {
    const match = completedMatch(1 + addedGoals, 1);
    expect(evaluate({
      marketType: 'running', runningWindow: 'to_full_time', runningGoalThreshold,
      liveScoreHome: 1, liveScoreAway: 1, liveContextSource: 'manual'
    }, { match, detail: null })).toMatchObject({
      status: 'settled', settlementType,
      evidence: { basis: 'running_full_time_score_delta', placementTotal: 2, actualTotal: addedGoals, lineValue: runningGoalThreshold }
    });
  });

  it('settles Running HT from the halftime score and rejects a regressed placement score', () => {
    const selection: StructuredBetSelection = {
      marketType: 'running', runningWindow: 'to_half_time', runningGoalThreshold: 0.5,
      liveScoreHome: 1, liveScoreAway: 0, liveContextSource: 'manual'
    };
    expect(evaluate(selection)).toMatchObject({ status: 'settled', settlementType: 'full_win', evidence: { actualTotal: 1 } });
    expect(evaluate({ ...selection, liveScoreHome: 2 })).toEqual({ status: 'manual_required', reason: 'contradictory_score' });
  });

  it('uses (start, end] minute boundaries for fixed 15-minute Running bets', () => {
    const base: StructuredBetSelection = {
      marketType: 'running', runningWindow: 'fixed_15', runningGoalThreshold: 0.5,
      windowStartMinute: 15, windowEndMinute: 30, liveScoreHome: 1, liveScoreAway: 0,
      liveMinute: 15, liveContextSource: 'manual'
    };
    expect(evaluate(base)).toMatchObject({
      status: 'settled', settlementType: 'full_win',
      evidence: { basis: 'fixed_15_goal_events', actualTotal: 1, windowStartMinute: 15, windowEndMinute: 30 }
    });
    expect(evaluate({ ...base, windowStartMinute: 30, windowEndMinute: 45, liveMinute: 30 }))
      .toMatchObject({ status: 'settled', settlementType: 'full_win', evidence: { actualTotal: 1 } });
    expect(evaluate({ ...base, windowStartMinute: 45, windowEndMinute: 60, liveMinute: 45 }))
      .toMatchObject({ status: 'settled', settlementType: 'full_loss', evidence: { actualTotal: 0 } });
  });

  it('returns explicit manual-review reasons instead of guessing from unsafe evidence', () => {
    const ft = { marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'home' } as const;
    expect(evaluate(ft, { matchId: null })).toEqual({ status: 'manual_required', reason: 'missing_match_link' });
    expect(evaluate(ft, { match: null })).toEqual({ status: 'manual_required', reason: 'missing_match' });
    expect(evaluate(ft, { match: { ...completedMatch(), status: 'postponed' } })).toEqual({ status: 'manual_required', reason: 'match_not_completed' });
    expect(evaluate(ft, { matchId: 'other' })).toEqual({ status: 'manual_required', reason: 'match_identity_mismatch' });
    expect(evaluate(ft, { detail: completedDetail({ match: { ...completedMatch(), id: 'other' } }) }))
      .toEqual({ status: 'manual_required', reason: 'match_identity_mismatch' });
    expect(evaluate({ ...ft, selectionCode: 'over' } as StructuredBetSelection)).toEqual({ status: 'manual_required', reason: 'invalid_selection' });
    const { scoreBreakdown: _scoreBreakdown, ...withoutScoreBreakdown } = completedDetail();
    expect(evaluate({ marketType: '1X2', marketPeriod: 'first_half', selectionCode: 'home' }, {
      detail: withoutScoreBreakdown
    })).toEqual({ status: 'manual_required', reason: 'missing_half_time_score' });
    expect(evaluate(ft, { detail: completedDetail({ match: completedMatch(2, 2) }) }))
      .toEqual({ status: 'manual_required', reason: 'contradictory_score' });
    expect(evaluate(ft, { detail: completedDetail({ scoreBreakdown: {
      halftime: { home: 1, away: 1 }, fulltime: { home: 3, away: 1 },
      extratime: { home: 1, away: 0 }, penalty: { home: null, away: null }
    } }) })).toEqual({ status: 'manual_required', reason: 'extra_time_ambiguous' });
  });

  it('requires complete, current detail for corners and fixed windows', () => {
    const corners = { marketType: 'corners', marketPeriod: 'first_half', selectionCode: 'over', lineValue: 2.5 } as const;
    expect(evaluate(corners, { detail: null })).toEqual({ status: 'manual_required', reason: 'missing_detail' });
    expect(evaluate(corners, { detail: completedDetail({ warnings: ['partial_detail'] }) }))
      .toEqual({ status: 'manual_required', reason: 'incomplete_detail' });
    expect(evaluate(corners, { detail: completedDetail({ updatedAt: '2026-09-15T11:59:59.000Z' }) }))
      .toEqual({ status: 'manual_required', reason: 'stale_detail' });
    const { enrichment: _enrichment, ...withoutEnrichment } = completedDetail();
    expect(evaluate(corners, { detail: withoutEnrichment }))
      .toEqual({ status: 'manual_required', reason: 'missing_corner_totals' });
    expect(evaluate({ ...corners, marketPeriod: 'full_time' }, { detail: completedDetail({
      teamStats: [
        { teamId: homeId, cornerKicks: 6, yellowCards: null, redCards: null, totalShots: null, shotsOnGoal: null, possessionPercentage: null },
        { teamId: awayId, cornerKicks: 3, yellowCards: null, redCards: null, totalShots: null, shotsOnGoal: null, possessionPercentage: null }
      ]
    }) })).toEqual({ status: 'manual_required', reason: 'contradictory_detail' });

    const fixed = {
      marketType: 'running', runningWindow: 'fixed_15', runningGoalThreshold: 0.5,
      windowStartMinute: 15, windowEndMinute: 30, liveScoreHome: 1, liveScoreAway: 0,
      liveMinute: 15, liveContextSource: 'manual'
    } as const;
    const { liveMinute: _liveMinute, ...withoutMinute } = fixed;
    expect(evaluate(withoutMinute)).toEqual({ status: 'manual_required', reason: 'missing_placement_minute' });
    expect(evaluate({ ...fixed, liveMinute: 16 })).toEqual({ status: 'manual_required', reason: 'fixed_window_started' });
    expect(evaluate(fixed, { detail: completedDetail({ warnings: ['events_partial'] }) }))
      .toEqual({ status: 'manual_required', reason: 'incomplete_goal_events' });
    expect(evaluate(fixed, { detail: completedDetail({ events: completedDetail().events.slice(0, 3) }) }))
      .toEqual({ status: 'manual_required', reason: 'incomplete_goal_events' });
    expect(evaluate(fixed, { detail: completedDetail({ events: [
      ...completedDetail().events.slice(0, 3),
      { minute: null, teamId: homeId, type: 'goal', label: 'goal' }
    ] }) })).toEqual({ status: 'manual_required', reason: 'invalid_goal_events' });
  });
});
