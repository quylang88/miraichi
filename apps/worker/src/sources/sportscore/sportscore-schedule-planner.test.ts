import { describe, expect, it } from 'vitest';
import { SPORTSCORE_COMPETITION_REGISTRY } from '@miraichi/config';
import type { LocalMatch } from '@miraichi/shared';
import {
  createEmptySportScoreLedgerState,
  sportScoreDailyCheckpointKey,
  type SportScoreSourceLedgerState
} from './sportscore-source-ledger.js';
import {
  planSportScoreSchedule,
  sportScoreTerminalWindowKey
} from './sportscore-schedule-planner.js';

const registry = SPORTSCORE_COMPETITION_REGISTRY.slice(0, 4);
const targetDate = '2026-08-26';

function stateAt(iso = '2026-08-26T10:00:00.000Z'): SportScoreSourceLedgerState {
  return createEmptySportScoreLedgerState(iso);
}

function scheduledMatch(id: string, slug: string): LocalMatch {
  const entry = registry[0]!;
  return {
    id,
    competition: {
      id: entry.competitionId,
      name: entry.competitionName,
      type: entry.competitionType,
      season: '2026-27'
    },
    kickoffUtc: '2026-08-26T18:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: `${id}-home`, name: `${id} Home` },
    awayTeam: { id: `${id}-away`, name: `${id} Away` },
    score: { home: null, away: null },
    sourceRefs: [{
      sourceId: 'sportscore',
      sourceMatchId: slug,
      importedAt: '2026-08-26T10:00:00.000Z'
    }],
    updatedAt: '2026-08-26T10:00:00.000Z'
  };
}

describe('SportScore per-competition schedule planner', () => {
  it('plans exactly one scoped daily request per enabled competition and never a global query', () => {
    const plan = planSportScoreSchedule({
      registry,
      targetDate,
      now: new Date('2026-08-26T10:00:00.000Z'),
      ledger: stateAt(),
      matches: [],
      maxRequestsPerRun: 10
    });

    expect(plan.actions).toHaveLength(4);
    expect(plan.actions.map((action) => action.competitionEntry.competitionId)).toEqual(
      registry.map((entry) => entry.competitionId)
    );
    expect(plan.actions.every((action) => action.date === targetDate && action.daily)).toBe(true);
    expect(plan.actions.every((action) => action.competitionEntry.providerCompetitionSlug.length > 0))
      .toBe(true);
    expect(new Set(plan.actions.map((action) =>
      `${action.competitionEntry.competitionId}|${action.date}`
    )).size).toBe(4);
  });

  it('rotates fairly after the attempted batch even when no success checkpoint advanced', () => {
    const first = planSportScoreSchedule({
      registry,
      targetDate,
      now: new Date('2026-08-26T10:00:00.000Z'),
      ledger: stateAt(),
      matches: [],
      maxRequestsPerRun: 2
    });
    const restartedState = stateAt();
    restartedState.rotationCursor = first.nextRotationCursor;
    const second = planSportScoreSchedule({
      registry,
      targetDate,
      now: new Date('2026-08-26T10:01:00.000Z'),
      ledger: restartedState,
      matches: [],
      maxRequestsPerRun: 2
    });

    expect(first.actions.map((action) => action.competitionEntry.competitionId)).toEqual(
      registry.slice(0, 2).map((entry) => entry.competitionId)
    );
    expect(second.actions.map((action) => action.competitionEntry.competitionId)).toEqual(
      registry.slice(2, 4).map((entry) => entry.competitionId)
    );
  });

  it('shares one competition request across simultaneous matches at +15 and +30 only', () => {
    const firstEntry = registry[0]!;
    const matches = [
      scheduledMatch('match-a', 'northbridge-athletic-vs-rivergate-city'),
      scheduledMatch('match-b', 'harbour-town-vs-mountain-united')
    ];
    const ledger = stateAt();
    ledger.daily[sportScoreDailyCheckpointKey(firstEntry.competitionId, targetDate)] = {
      completedAt: '2026-08-26T10:00:00.000Z',
      failureCount: 0
    };
    const windowKey = sportScoreTerminalWindowKey(
      firstEntry.competitionId,
      targetDate,
      '2026-08-26T20:00:00.000Z'
    );

    const early = planSportScoreSchedule({
      registry,
      targetDate,
      now: new Date('2026-08-26T20:14:59.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    });
    expect(early.actions).toHaveLength(3);
    expect(early.actions.some((action) => action.competitionEntry === firstEntry)).toBe(false);

    const plus15 = planSportScoreSchedule({
      registry,
      targetDate,
      now: new Date('2026-08-26T20:15:00.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    });
    const terminalAction = plus15.actions.find((action) =>
      action.competitionEntry.competitionId === firstEntry.competitionId
    );
    expect(terminalAction).toMatchObject({ daily: false, date: targetDate });
    expect(terminalAction?.terminalWindows).toEqual([{
      windowKey,
      stage: 'plus_15',
      expectedEndAt: '2026-08-26T20:00:00.000Z',
      matchIds: ['match-a', 'match-b'],
      sourceMatchSlugs: [
        'northbridge-athletic-vs-rivergate-city',
        'harbour-town-vs-mountain-united'
      ]
    }]);

    ledger.terminalWindows[windowKey] = {
      plus15CompletedAt: '2026-08-26T20:15:00.000Z',
      failureCount: 0
    };
    const between = planSportScoreSchedule({
      registry: [firstEntry],
      targetDate,
      now: new Date('2026-08-26T20:29:59.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    });
    const plus30 = planSportScoreSchedule({
      registry: [firstEntry],
      targetDate,
      now: new Date('2026-08-26T20:30:00.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    });

    expect(between.actions).toHaveLength(0);
    expect(plus30.actions[0]?.terminalWindows[0]?.stage).toBe('plus_30');

    ledger.terminalWindows[windowKey] = {
      plus15CompletedAt: '2026-08-26T20:15:00.000Z',
      plus30CompletedAt: '2026-08-26T20:30:00.000Z',
      nextAttemptAt: '2026-08-26T21:00:00.000Z',
      recoveryAttempts: 0,
      failureCount: 0
    };
    expect(planSportScoreSchedule({
      registry: [firstEntry],
      targetDate,
      now: new Date('2026-08-26T20:59:59.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    }).actions).toHaveLength(0);
    expect(planSportScoreSchedule({
      registry: [firstEntry],
      targetDate,
      now: new Date('2026-08-26T21:00:00.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    }).actions[0]?.terminalWindows[0]).toMatchObject({
      stage: 'recovery',
      recoveryAttempt: 1
    });

    ledger.terminalWindows[windowKey] = {
      plus15CompletedAt: '2026-08-26T20:15:00.000Z',
      plus30CompletedAt: '2026-08-26T20:30:00.000Z',
      recoveryAttempts: 2,
      exhaustedAt: '2026-08-26T20:30:00.000Z',
      failureCount: 0
    };
    expect(planSportScoreSchedule({
      registry: [firstEntry],
      targetDate,
      now: new Date('2026-08-26T20:31:00.000Z'),
      ledger,
      matches,
      maxRequestsPerRun: 10
    }).actions).toHaveLength(0);
  });

  it('honors durable failure deferrals instead of producing a tight retry loop', () => {
    const firstEntry = registry[0]!;
    const ledger = stateAt();
    ledger.daily[sportScoreDailyCheckpointKey(firstEntry.competitionId, targetDate)] = {
      completedAt: '2026-08-26T10:00:00.000Z',
      failureCount: 0
    };
    const windowKey = sportScoreTerminalWindowKey(
      firstEntry.competitionId,
      targetDate,
      '2026-08-26T20:00:00.000Z'
    );
    ledger.terminalWindows[windowKey] = {
      nextAttemptAt: '2026-08-26T20:30:00.000Z',
      failureCount: 1
    };

    expect(planSportScoreSchedule({
      registry: [firstEntry],
      targetDate,
      now: new Date('2026-08-26T20:20:00.000Z'),
      ledger,
      matches: [scheduledMatch('match-a', 'northbridge-athletic-vs-rivergate-city')],
      maxRequestsPerRun: 10
    }).actions).toHaveLength(0);
  });

  it('reuses the original provider query date instead of deriving a duplicate UTC date', () => {
    const entry = registry[0]!;
    const ledger = stateAt();
    ledger.daily[sportScoreDailyCheckpointKey(entry.competitionId, targetDate)] = {
      completedAt: '2026-08-26T10:00:00.000Z',
      failureCount: 0
    };
    const expectedEndAt = '2026-08-26T01:30:00.000Z';
    const windowKey = sportScoreTerminalWindowKey(
      entry.competitionId,
      targetDate,
      expectedEndAt
    );
    ledger.terminalSchedules[windowKey] = {
      competitionId: entry.competitionId,
      date: targetDate,
      expectedEndAt,
      sourceMatchSlugs: ['northbridge-athletic-vs-rivergate-city'],
      matchIds: []
    };
    const match = {
      ...scheduledMatch('match-offset', 'northbridge-athletic-vs-rivergate-city'),
      kickoffUtc: '2026-08-25T23:30:00.000Z'
    };

    const plan = planSportScoreSchedule({
      registry: [entry],
      targetDate,
      now: new Date('2026-08-26T01:45:00.000Z'),
      ledger,
      matches: [match],
      maxRequestsPerRun: 10
    });

    expect(plan.actions).toHaveLength(1);
    expect(plan.actions[0]).toMatchObject({ date: targetDate, daily: false });
    expect(plan.actions[0]?.terminalWindows).toHaveLength(1);
    expect(plan.actions[0]?.terminalWindows[0]?.windowKey).toBe(windowKey);
  });
});
