import { describe, expect, it } from 'vitest';
import type { LocalMatch } from '@miraichi/shared';
import {
  computeOwnerLocalDate,
  chunkFixtureIds,
  resolveProviderFixtureIdFromMatch,
  computeDueWindowPollMatches,
  planApiFootballIngestion
} from './api-football-schedule-planner.js';

function createMockMatch(options: {
  id?: string;
  kickoffUtc?: string;
  status?: LocalMatch['status'];
  providerFixtureId?: number;
  sourceRefs?: LocalMatch['sourceRefs'];
} = {}): LocalMatch {
  const matchId = options.id ?? 'canonical-match-abc-123';
  return {
    id: matchId,
    competition: {
      id: 'comp-test-1',
      name: 'Test Championship',
      type: 'club',
      season: '2026'
    },
    kickoffUtc: options.kickoffUtc ?? '2026-08-25T15:00:00.000Z',
    status: options.status ?? 'scheduled',
    homeTeam: { id: 'team-alpha', name: 'Team Alpha' },
    awayTeam: { id: 'team-beta', name: 'Team Beta' },
    score: { home: null, away: null },
    sourceRefs:
      options.sourceRefs ??
      (options.providerFixtureId !== undefined
        ? [
            {
              sourceId: 'api-football',
              sourceMatchId: String(options.providerFixtureId),
              importedAt: '2026-08-25T00:00:00.000Z'
            }
          ]
        : []),
    updatedAt: '2026-08-25T00:00:00.000Z'
  };
}

describe('computeOwnerLocalDate', () => {
  it('computes YYYY-MM-DD in default Tokyo timezone', () => {
    // 2026-08-25 15:30 UTC -> 2026-08-26 00:30 in Tokyo (+9)
    const date1 = new Date('2026-08-25T15:30:00.000Z');
    expect(computeOwnerLocalDate(date1, 'Asia/Tokyo')).toBe('2026-08-26');

    // 2026-08-25 14:30 UTC -> 2026-08-25 23:30 in Tokyo (+9)
    const date2 = new Date('2026-08-25T14:30:00.000Z');
    expect(computeOwnerLocalDate(date2, 'Asia/Tokyo')).toBe('2026-08-25');
  });

  it('respects explicitly provided timezone', () => {
    const date = new Date('2026-08-25T02:00:00.000Z');
    expect(computeOwnerLocalDate(date, 'America/New_York')).toBe('2026-08-24');
    expect(computeOwnerLocalDate(date, 'Europe/London')).toBe('2026-08-25');
    expect(computeOwnerLocalDate(date, 'Asia/Tokyo')).toBe('2026-08-25');
  });
});

describe('chunkFixtureIds', () => {
  it('splits arrays according to chunkSize constraint', () => {
    // Empty array
    expect(chunkFixtureIds([])).toEqual([]);

    // Exactly 20
    const ids20 = Array.from({ length: 20 }, (_, i) => 1000 + i);
    expect(chunkFixtureIds(ids20, 20)).toEqual([ids20]);

    // 21 -> [20, 1]
    const ids21 = Array.from({ length: 21 }, (_, i) => 1000 + i);
    const chunks21 = chunkFixtureIds(ids21, 20);
    expect(chunks21).toHaveLength(2);
    expect(chunks21[0]).toHaveLength(20);
    expect(chunks21[1]).toHaveLength(1);
    expect(chunks21[0]).toEqual(ids21.slice(0, 20));
    expect(chunks21[1]).toEqual(ids21.slice(20, 21));

    // 41 -> [20, 20, 1]
    const ids41 = Array.from({ length: 41 }, (_, i) => 1000 + i);
    const chunks41 = chunkFixtureIds(ids41, 20);
    expect(chunks41).toHaveLength(3);
    expect(chunks41[0]).toHaveLength(20);
    expect(chunks41[1]).toHaveLength(20);
    expect(chunks41[2]).toHaveLength(1);
    expect(chunks41[0]).toEqual(ids41.slice(0, 20));
    expect(chunks41[1]).toEqual(ids41.slice(20, 40));
    expect(chunks41[2]).toEqual(ids41.slice(40, 41));
  });

  it('handles custom chunk sizes and invalid chunkSize fallback to 20', () => {
    const ids5 = [1, 2, 3, 4, 5];
    expect(chunkFixtureIds(ids5, 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunkFixtureIds(ids5, 0)).toEqual([[1, 2, 3, 4, 5]]);
    expect(chunkFixtureIds(ids5, -5)).toEqual([[1, 2, 3, 4, 5]]);
  });
});

describe('resolveProviderFixtureIdFromMatch', () => {
  it('extracts provider fixture ID strictly from sourceRefs', () => {
    const match = createMockMatch({
      id: 'match-hash-99999',
      sourceRefs: [
        {
          sourceId: 'openfootball',
          sourceMatchId: '99999',
          importedAt: '2026-08-25T00:00:00.000Z'
        },
        {
          sourceId: 'api-football',
          sourceMatchId: '12345',
          importedAt: '2026-08-25T00:00:00.000Z'
        }
      ]
    });

    expect(resolveProviderFixtureIdFromMatch(match)).toBe(12345);
  });

  it('NEVER parses provider fixture ID from canonical match ID', () => {
    const matchWithoutRef = createMockMatch({
      id: 'fixture-77777',
      sourceRefs: []
    });

    expect(resolveProviderFixtureIdFromMatch(matchWithoutRef)).toBeNull();

    const matchWithUnrelatedRef = createMockMatch({
      id: 'match-88888',
      sourceRefs: [
        {
          sourceId: 'openfootball',
          sourceMatchId: '88888',
          importedAt: '2026-08-25T00:00:00.000Z'
        }
      ]
    });

    expect(resolveProviderFixtureIdFromMatch(matchWithUnrelatedRef)).toBeNull();
  });

  it('returns null for missing, non-numeric, or negative fixture IDs', () => {
    const matchNonNumeric = createMockMatch({
      sourceRefs: [
        {
          sourceId: 'api-football',
          sourceMatchId: 'fixture-xyz',
          importedAt: '2026-08-25T00:00:00.000Z'
        }
      ]
    });
    expect(resolveProviderFixtureIdFromMatch(matchNonNumeric)).toBeNull();

    const matchZero = createMockMatch({
      sourceRefs: [
        {
          sourceId: 'api-football',
          sourceMatchId: '0',
          importedAt: '2026-08-25T00:00:00.000Z'
        }
      ]
    });
    expect(resolveProviderFixtureIdFromMatch(matchZero)).toBeNull();
  });
});

describe('computeDueWindowPollMatches', () => {
  const KICKOFF = '2026-08-25T15:00:00.000Z'; // 15:00 UTC

  it('starts result polling at kickoff +100 minutes (not due at +99m)', () => {
    const match = createMockMatch({
      id: 'match-1',
      kickoffUtc: KICKOFF,
      providerFixtureId: 1001,
      status: 'scheduled'
    });

    // 1. At 16:39 UTC (kickoff + 99 minutes) -> NOT due
    const dueAt99m = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T16:39:00.000Z')
    });
    expect(dueAt99m).toHaveLength(0);

    // 2. At 16:40 UTC (kickoff + 100 minutes) -> DUE
    const dueAt100m = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T16:40:00.000Z')
    });
    expect(dueAt100m).toHaveLength(1);
    expect(dueAt100m[0]?.fixtureId).toBe(1001);
    expect(dueAt100m[0]?.isExtendedWindow).toBe(false);
    expect(dueAt100m[0]?.windowStage).toBe('normal');

    // 3. At 17:00 UTC (kickoff + 120 minutes) -> DUE (end of normal window)
    const dueAt120m = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T17:00:00.000Z')
    });
    expect(dueAt120m).toHaveLength(1);
    expect(dueAt120m[0]?.isExtendedWindow).toBe(false);
  });

  it('extends polling up to +180 minutes only when reported status is extra time or penalties', () => {
    const match = createMockMatch({
      id: 'match-et',
      kickoffUtc: KICKOFF,
      providerFixtureId: 1002,
      status: 'scheduled'
    });

    // At 17:15 UTC (kickoff + 135 minutes)
    // Without live/ET reported status: NOT due (normal window ended at +120m)
    const dueWithoutLiveStatus = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T17:15:00.000Z')
    });
    expect(dueWithoutLiveStatus).toHaveLength(0);

    // With ET (Extra Time) reported status: DUE in extended window
    const dueWithET = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T17:15:00.000Z'),
      lastReportedStatusByMatchId: { 'match-et': 'ET' }
    });
    expect(dueWithET).toHaveLength(1);
    expect(dueWithET[0]?.fixtureId).toBe(1002);
    expect(dueWithET[0]?.isExtendedWindow).toBe(true);
    expect(dueWithET[0]?.windowStage).toBe('extended');

    // With penalties (P) reported status at 17:50 (kickoff + 170 min): DUE
    const dueWithPenalties = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T17:50:00.000Z'),
      lastReportedStatusByMatchId: { 'match-et': 'P' }
    });
    expect(dueWithPenalties).toHaveLength(1);
    expect(dueWithPenalties[0]?.isExtendedWindow).toBe(true);

    for (const ordinaryOrInterruptedStatus of ['1H', 'HT', '2H', 'LIVE', 'IN_PLAY', 'INT']) {
      const due = computeDueWindowPollMatches({
        matches: [match],
        now: new Date('2026-08-25T17:15:00.000Z'),
        lastReportedStatusByMatchId: { 'match-et': ordinaryOrInterruptedStatus }
      });
      expect(due, `${ordinaryOrInterruptedStatus} must not extend beyond +120m`).toEqual([]);
    }

    // At 18:01 UTC (kickoff + 181 minutes): STOPS regardless of status
    const dueAfter180m = computeDueWindowPollMatches({
      matches: [match],
      now: new Date('2026-08-25T18:01:00.000Z'),
      lastReportedStatusByMatchId: { 'match-et': 'P' }
    });
    expect(dueAfter180m).toHaveLength(0);
  });

  it('stops polling immediately for terminal matches (completed, cancelled, postponed, FT, AET, PEN)', () => {
    // 1. Local terminal status on match object
    const completedMatch = createMockMatch({
      id: 'match-completed',
      kickoffUtc: KICKOFF,
      providerFixtureId: 2001,
      status: 'completed'
    });
    const postponedMatch = createMockMatch({
      id: 'match-postponed',
      kickoffUtc: KICKOFF,
      providerFixtureId: 2002,
      status: 'postponed'
    });
    const cancelledMatch = createMockMatch({
      id: 'match-cancelled',
      kickoffUtc: KICKOFF,
      providerFixtureId: 2003,
      status: 'cancelled'
    });

    const now = new Date('2026-08-25T16:45:00.000Z');
    expect(
      computeDueWindowPollMatches({
        matches: [completedMatch, postponedMatch, cancelledMatch],
        now
      })
    ).toEqual([]);

    // 2. Reported provider terminal status
    const scheduledMatch = createMockMatch({
      id: 'match-ft',
      kickoffUtc: KICKOFF,
      providerFixtureId: 2004,
      status: 'scheduled'
    });

    const dueWithFT = computeDueWindowPollMatches({
      matches: [scheduledMatch],
      now,
      lastReportedStatusByMatchId: { 'match-ft': 'FT' }
    });
    expect(dueWithFT).toEqual([]);

    const dueWithAET = computeDueWindowPollMatches({
      matches: [scheduledMatch],
      now,
      lastReportedStatusByMatchId: { 'match-ft': 'AET' }
    });
    expect(dueWithAET).toEqual([]);

    const dueWithPEN = computeDueWindowPollMatches({
      matches: [scheduledMatch],
      now,
      lastReportedStatusByMatchId: { 'match-ft': 'PEN' }
    });
    expect(dueWithPEN).toEqual([]);
  });

  it('respects 150-second cadence between polls', () => {
    const match = createMockMatch({
      id: 'match-cadence',
      kickoffUtc: KICKOFF,
      providerFixtureId: 3001,
      status: 'scheduled'
    });

    const pollTime1 = new Date('2026-08-25T16:40:00.000Z');

    // Polled 60 seconds ago (16:39:00) -> NOT due
    const notDueYet = computeDueWindowPollMatches({
      matches: [match],
      now: pollTime1,
      lastPolledAtByMatchId: {
        'match-cadence': '2026-08-25T16:39:00.000Z'
      },
      pollingIntervalSeconds: 150
    });
    expect(notDueYet).toEqual([]);

    // Polled 149 seconds ago -> NOT due
    const notDue149s = computeDueWindowPollMatches({
      matches: [match],
      now: pollTime1,
      lastPolledAtByMatchId: {
        'match-cadence': new Date(pollTime1.getTime() - 149_000)
      },
      pollingIntervalSeconds: 150
    });
    expect(notDue149s).toEqual([]);

    // Polled 150 seconds ago -> DUE
    const due150s = computeDueWindowPollMatches({
      matches: [match],
      now: pollTime1,
      lastPolledAtByMatchId: {
        'match-cadence': new Date(pollTime1.getTime() - 150_000)
      },
      pollingIntervalSeconds: 150
    });
    expect(due150s).toHaveLength(1);

    // Polled 200 seconds ago -> DUE
    const due200s = computeDueWindowPollMatches({
      matches: [match],
      now: pollTime1,
      lastPolledAtByMatchId: {
        'match-cadence': new Date(pollTime1.getTime() - 200_000)
      },
      pollingIntervalSeconds: 150
    });
    expect(due200s).toHaveLength(1);
  });
});

describe('planApiFootballIngestion', () => {
  it('plans daily sync exactly ONCE across 100 scheduler heartbeats outside a concluding window', () => {
    const nowStart = new Date('2026-08-25T01:00:00.000Z');
    let lastSuccessfulDailySyncDate: string | null = null;
    let dailySyncPlanCount = 0;
    let idleCount = 0;

    // Simulate 100 ticks (e.g. every 150 seconds)
    for (let tick = 0; tick < 100; tick++) {
      const currentTickTime = new Date(nowStart.getTime() + tick * 150_000);
      const plan = planApiFootballIngestion({
        mode: 'auto',
        now: currentTickTime,
        timeZone: 'Asia/Tokyo',
        lastSuccessfulDailySyncDate,
        matches: []
      });

      if (plan.actions.some((a) => a.type === 'daily_sync')) {
        dailySyncPlanCount++;
        // Simulate successful daily sync execution
        lastSuccessfulDailySyncDate = plan.targetDate;
      } else if (plan.reason === 'idle') {
        idleCount++;
      }
    }

    expect(dailySyncPlanCount).toBe(1);
    expect(idleCount).toBe(99);
    expect(lastSuccessfulDailySyncDate).toBe('2026-08-25');
  });

  it('leaves daily sync due on failure, and does not retry until next local date on success', () => {
    const today = '2026-08-25';
    const dateToday = new Date('2026-08-25T05:00:00.000Z');

    // 1. Initial attempt: daily sync is due
    const plan1 = planApiFootballIngestion({
      mode: 'auto',
      now: dateToday,
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: null,
      matches: []
    });
    expect(plan1.dailySyncDue).toBe(true);
    expect(plan1.actions).toEqual([{ type: 'daily_sync', date: today }]);

    // 2. Failed attempt: lastSuccessfulDailySyncDate remains null -> STILL due
    const planAfterFailure = planApiFootballIngestion({
      mode: 'auto',
      now: new Date(dateToday.getTime() + 150_000),
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: null,
      matches: []
    });
    expect(planAfterFailure.dailySyncDue).toBe(true);
    expect(planAfterFailure.actions).toEqual([{ type: 'daily_sync', date: today }]);

    // 3. Successful attempt: marks date complete -> NOT due anymore on same date
    const planAfterSuccess = planApiFootballIngestion({
      mode: 'auto',
      now: new Date(dateToday.getTime() + 300_000),
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: today,
      matches: []
    });
    expect(planAfterSuccess.dailySyncDue).toBe(false);
    expect(planAfterSuccess.actions).toEqual([]);
    expect(planAfterSuccess.reason).toBe('idle');

    // 4. Next local date arrives -> DUE again
    const dateTomorrow = new Date('2026-08-26T05:00:00.000Z');
    const planTomorrow = planApiFootballIngestion({
      mode: 'auto',
      now: dateTomorrow,
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: today, // still yesterday's date
      matches: []
    });
    expect(planTomorrow.dailySyncDue).toBe(true);
    expect(planTomorrow.actions).toEqual([{ type: 'daily_sync', date: '2026-08-26' }]);
  });

  it('chunks 21 and 41 due fixtures into 20-fixture batches', () => {
    const KICKOFF = '2026-08-25T15:00:00.000Z';
    const now = new Date('2026-08-25T16:45:00.000Z'); // Kickoff + 105 min

    // 21 due matches
    const matches21 = Array.from({ length: 21 }, (_, i) =>
      createMockMatch({
        id: `match-${i + 1}`,
        kickoffUtc: KICKOFF,
        providerFixtureId: 5000 + i,
        status: 'scheduled'
      })
    );

    const plan21 = planApiFootballIngestion({
      mode: 'window_poll',
      now,
      matches: matches21,
      chunkSize: 20
    });

    expect(plan21.actions).toHaveLength(2);
    expect(plan21.actions[0]?.type).toBe('window_poll');
    expect(plan21.actions[1]?.type).toBe('window_poll');
    if (plan21.actions[0]?.type === 'window_poll' && plan21.actions[1]?.type === 'window_poll') {
      expect(plan21.actions[0].fixtureIds).toHaveLength(20);
      expect(plan21.actions[1].fixtureIds).toHaveLength(1);
      expect(plan21.actions[0].matches).toHaveLength(20);
      expect(plan21.actions[1].matches).toHaveLength(1);
    }

    // 41 due matches
    const matches41 = Array.from({ length: 41 }, (_, i) =>
      createMockMatch({
        id: `match-${i + 1}`,
        kickoffUtc: KICKOFF,
        providerFixtureId: 6000 + i,
        status: 'scheduled'
      })
    );

    const plan41 = planApiFootballIngestion({
      mode: 'window_poll',
      now,
      matches: matches41,
      chunkSize: 20
    });

    expect(plan41.actions).toHaveLength(3);
    if (
      plan41.actions[0]?.type === 'window_poll' &&
      plan41.actions[1]?.type === 'window_poll' &&
      plan41.actions[2]?.type === 'window_poll'
    ) {
      expect(plan41.actions[0].fixtureIds).toHaveLength(20);
      expect(plan41.actions[1].fixtureIds).toHaveLength(20);
      expect(plan41.actions[2].fixtureIds).toHaveLength(1);
    }
  });

  it('returns 0 actions when idle or when quota is exhausted', () => {
    const today = '2026-08-25';
    const now = new Date('2026-08-25T05:00:00.000Z');

    // 1. Idle (daily sync done, no concluding matches)
    const idlePlan = planApiFootballIngestion({
      mode: 'auto',
      now,
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: today,
      matches: []
    });
    expect(idlePlan.actions).toHaveLength(0);
    expect(idlePlan.reason).toBe('idle');

    // 2. Quota exhausted (canRequest: false)
    const quotaPlan = planApiFootballIngestion({
      mode: 'auto',
      now,
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: null, // would be due
      canRequest: false,
      matches: [
        createMockMatch({
          kickoffUtc: '2026-08-25T03:00:00.000Z', // in window
          providerFixtureId: 1001,
          status: 'scheduled'
        })
      ]
    });
    expect(quotaPlan.actions).toHaveLength(0);
    expect(quotaPlan.reason).toBe('quota_deferred');

    const idleWithoutQuota = planApiFootballIngestion({
      mode: 'auto',
      now,
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: today,
      canRequest: false,
      matches: []
    });
    expect(idleWithoutQuota.actions).toEqual([]);
    expect(idleWithoutQuota.reason).toBe('idle');
  });

  it('plans both daily sync and due window polls in auto mode when both are due', () => {
    // 16:45 UTC is 01:45 on 2026-08-26 in Tokyo (+9)
    const now = new Date('2026-08-25T16:45:00.000Z');
    const todayJst = '2026-08-26';

    const matchInWindow = createMockMatch({
      id: 'match-window',
      kickoffUtc: '2026-08-25T15:00:00.000Z',
      providerFixtureId: 7001,
      status: 'scheduled'
    });

    const plan = planApiFootballIngestion({
      mode: 'auto',
      now,
      timeZone: 'Asia/Tokyo',
      lastSuccessfulDailySyncDate: null, // daily sync is due
      matches: [matchInWindow]
    });

    expect(plan.actions).toHaveLength(2);
    expect(plan.actions[0]).toEqual({ type: 'daily_sync', date: todayJst });
    expect(plan.actions[1]?.type).toBe('window_poll');
    if (plan.actions[1]?.type === 'window_poll') {
      expect(plan.actions[1].fixtureIds).toEqual([7001]);
    }
  });

  it('supports Map instances for lastPolledAt and lastReportedStatus', () => {
    const KICKOFF = '2026-08-25T15:00:00.000Z';
    const now = new Date('2026-08-25T17:15:00.000Z'); // Kickoff + 135m (extended window)

    const match = createMockMatch({
      id: 'match-map',
      kickoffUtc: KICKOFF,
      providerFixtureId: 8001,
      status: 'scheduled'
    });

    const lastPolledMap = new Map<string, string>([
      ['match-map', '2026-08-25T17:10:00.000Z'] // 5 minutes ago (> 150s)
    ]);
    const lastReportedStatusMap = new Map<string, string>([
      ['match-map', 'et'] // lowercase extra-time status
    ]);

    const due = computeDueWindowPollMatches({
      matches: [match],
      now,
      lastPolledAtByMatchId: lastPolledMap,
      lastReportedStatusByMatchId: lastReportedStatusMap
    });

    expect(due).toHaveLength(1);
    expect(due[0]?.fixtureId).toBe(8001);
    expect(due[0]?.isExtendedWindow).toBe(true);
  });

  it('gracefully skips matches with invalid kickoff timestamps', () => {
    const matchInvalidKickoff = createMockMatch({
      id: 'match-invalid-time',
      kickoffUtc: 'invalid-date-string',
      providerFixtureId: 9001,
      status: 'scheduled'
    });

    const due = computeDueWindowPollMatches({
      matches: [matchInvalidKickoff],
      now: new Date('2026-08-25T16:45:00.000Z')
    });

    expect(due).toEqual([]);
  });

  it('handles explicit daily_sync and window_poll modes', () => {
    const today = '2026-08-25';
    const now = new Date('2026-08-25T05:00:00.000Z');

    // Explicit CLI mode uses the same due gate; it is not a force bypass.
    const planDaily = planApiFootballIngestion({
      mode: 'daily_sync',
      now,
      timeZone: 'UTC',
      lastSuccessfulDailySyncDate: today,
      matches: []
    });
    expect(planDaily.actions).toEqual([]);
    expect(planDaily.reason).toBe('idle');

    // window_poll mode with no due matches returns idle
    const planPollIdle = planApiFootballIngestion({
      mode: 'window_poll',
      now,
      timeZone: 'UTC',
      matches: []
    });
    expect(planPollIdle.actions).toHaveLength(0);
    expect(planPollIdle.reason).toBe('idle');
  });
});
