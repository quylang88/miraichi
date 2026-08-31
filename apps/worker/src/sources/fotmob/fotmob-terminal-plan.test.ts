import { describe, expect, it } from 'vitest';
import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import type { FotMobResultLedgerState } from './fotmob-result-ledger.js';
import { buildFotMobTerminalPlan } from './fotmob-terminal-plan.js';

function snapshot(matches: Array<{ matchId: string; providerMatchId: string; kickoffUtc: string }>): CanonicalWarehouseSnapshot {
  return {
    matches: matches.map((match) => ({
      matchId: match.matchId,
      competitionId: 'competition-alpha',
      season: '2026-27',
      kickoffUtc: match.kickoffUtc,
      status: 'scheduled',
      homeTeamId: `home-${match.matchId}`,
      awayTeamId: `away-${match.matchId}`,
      scoreHome: null,
      scoreAway: null,
      updatedAt: '2026-08-30T00:00:00.000Z'
    })),
    teams: [],
    competitions: [],
    links: matches.map((match) => ({
      entityType: 'match',
      entityId: match.matchId,
      provider: 'fotmob-unofficial',
      providerEntityType: 'match',
      providerEntityId: match.providerMatchId,
      confidence: 1,
      linkedBy: 'test',
      linkedAt: '2026-08-30T00:00:00.000Z'
    })),
    provenance: []
  };
}

function ledger(overrides: Partial<FotMobResultLedgerState> = {}): FotMobResultLedgerState {
  return {
    schemaVersion: 'miraichi.fotmob-terminal-results-ledger.v1',
    revision: 0,
    dates: {},
    matches: {},
    updatedAt: '2026-08-31T00:00:00.000Z',
    ...overrides
  };
}

describe('FotMob terminal-check planner', () => {
  it('opens at kickoff +105 and coalesces matches by owner-local provider date', () => {
    const base = snapshot([
      { matchId: 'match-a', providerMatchId: '501', kickoffUtc: '2026-08-31T12:00:00.000Z' },
      { matchId: 'match-b', providerMatchId: '502', kickoffUtc: '2026-08-31T13:00:00.000Z' }
    ]);
    expect(buildFotMobTerminalPlan({
      base,
      ledger: ledger(),
      now: new Date('2026-08-31T13:44:59.999Z'),
      timeZone: 'Asia/Tokyo',
      maxDates: 2
    }).groups).toEqual([]);

    const firstDue = buildFotMobTerminalPlan({
      base,
      ledger: ledger(),
      now: new Date('2026-08-31T14:45:00.000Z'),
      timeZone: 'Asia/Tokyo',
      maxDates: 2
    });
    expect(firstDue.groups).toEqual([{
      date: '2026-08-31',
      matches: [
        { matchId: 'match-a', providerMatchId: '501', kickoffUtc: '2026-08-31T12:00:00.000Z' },
        { matchId: 'match-b', providerMatchId: '502', kickoffUtc: '2026-08-31T13:00:00.000Z' }
      ]
    }]);
  });

  it('respects durable match retry and date failure backoff', () => {
    const base = snapshot([
      { matchId: 'match-a', providerMatchId: '501', kickoffUtc: '2026-08-31T12:00:00.000Z' }
    ]);
    const state = ledger({
      dates: {
        'fotmob-unofficial|2026-08-31': {
          failureCount: 1,
          nextAttemptAt: '2026-08-31T14:10:00.000Z',
          lastError: 'temporary'
        }
      },
      matches: {
        'fotmob-unofficial|match-a': {
          attemptCount: 1,
          nextCheckAt: '2026-08-31T14:05:00.000Z'
        }
      }
    });
    expect(buildFotMobTerminalPlan({
      base,
      ledger: state,
      now: new Date('2026-08-31T14:09:59.999Z'),
      timeZone: 'Asia/Tokyo',
      maxDates: 2
    }).groups).toEqual([]);
    expect(buildFotMobTerminalPlan({
      base,
      ledger: state,
      now: new Date('2026-08-31T14:10:00.000Z'),
      timeZone: 'Asia/Tokyo',
      maxDates: 2
    }).groups[0]).toMatchObject({ date: '2026-08-31' });
  });

  it('marks 45-attempt and kickoff +240 minute matches exhausted without a request', () => {
    const base = snapshot([
      { matchId: 'match-attempts', providerMatchId: '501', kickoffUtc: '2026-08-31T12:00:00.000Z' },
      { matchId: 'match-cutoff', providerMatchId: '502', kickoffUtc: '2026-08-31T10:00:00.000Z' }
    ]);
    const plan = buildFotMobTerminalPlan({
      base,
      ledger: ledger({
        matches: {
          'fotmob-unofficial|match-attempts': { attemptCount: 45 }
        }
      }),
      now: new Date('2026-08-31T14:00:00.000Z'),
      timeZone: 'Asia/Tokyo',
      maxDates: 2
    });
    expect(plan.groups).toEqual([]);
    expect(plan.exhaustedMatchIds.sort()).toEqual(['match-attempts', 'match-cutoff']);
  });

  it('carries a date ETag and caps the number of provider dates', () => {
    const base = snapshot([
      { matchId: 'match-a', providerMatchId: '501', kickoffUtc: '2026-08-30T14:30:00.000Z' },
      { matchId: 'match-b', providerMatchId: '502', kickoffUtc: '2026-08-30T15:30:00.000Z' }
    ]);
    const plan = buildFotMobTerminalPlan({
      base,
      ledger: ledger({
        dates: {
          'fotmob-unofficial|2026-08-30': {
            etag: 'W/"old"', lastCheckedAt: '2026-08-30T14:00:00.000Z', failureCount: 0
          }
        }
      }),
      now: new Date('2026-08-30T17:15:00.000Z'),
      timeZone: 'Asia/Tokyo',
      maxDates: 1
    });
    expect(plan.groups).toHaveLength(1);
    expect(plan.groups[0]).toMatchObject({ date: '2026-08-30', etag: 'W/"old"' });
  });
});
