import { describe, expect, it } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import { adaptFotMobDailyTerminalResults } from './fotmob-daily-adapter.js';
import type { FotMobDailyPayload } from './fotmob-daily-client.js';
import type { FotMobRawMatch } from './fotmob-season-client.js';

const entry = COMPETITION_SOURCE_REGISTRY[0]!;
const leagueId = entry.sourceBindings.result!.externalNumericId!;

function baseMatch(input: {
  matchId?: string;
  providerMatchId?: string;
  status?: 'scheduled' | 'completed';
} = {}): CanonicalWarehouseSnapshot {
  const matchId = input.matchId ?? 'match-current-alpha';
  const providerMatchId = input.providerMatchId ?? '501';
  return {
    matches: [{
      matchId,
      competitionId: entry.competitionId,
      season: '2026-27',
      kickoffUtc: '2026-08-31T12:00:00.000Z',
      status: input.status ?? 'scheduled',
      homeTeamId: 'team-home',
      awayTeamId: 'team-away',
      scoreHome: input.status === 'completed' ? 1 : null,
      scoreAway: input.status === 'completed' ? 0 : null,
      updatedAt: '2026-08-30T00:00:00.000Z'
    }],
    teams: [
      { teamId: 'team-home', name: 'Home', updatedAt: '2026-08-30T00:00:00.000Z' },
      { teamId: 'team-away', name: 'Away', updatedAt: '2026-08-30T00:00:00.000Z' }
    ],
    competitions: [{
      competitionId: entry.competitionId,
      name: entry.competitionName,
      type: entry.competitionType,
      updatedAt: '2026-08-30T00:00:00.000Z'
    }],
    links: [{
      entityType: 'match',
      entityId: matchId,
      provider: 'fotmob-unofficial',
      providerEntityType: 'match',
      providerEntityId: providerMatchId,
      confidence: 1,
      linkedBy: 'test',
      linkedAt: '2026-08-30T00:00:00.000Z'
    }],
    provenance: []
  };
}

function rawMatch(overrides: Partial<FotMobRawMatch> = {}): FotMobRawMatch {
  return {
    id: 501,
    home: { id: 1, name: 'Home', score: 2 },
    away: { id: 2, name: 'Away', score: 1 },
    status: {
      utcTime: '2026-08-31T12:00:00.000Z',
      finished: true,
      started: true,
      cancelled: false,
      scoreStr: '2 - 1'
    },
    ...overrides
  };
}

function payload(matches: FotMobRawMatch[], id = leagueId): FotMobDailyPayload {
  return { date: '20260831', leagues: [{ id, name: 'Competition Alpha', matches }] };
}

describe('FotMob daily terminal adapter', () => {
  it('updates an existing canonical match through its private provider link', () => {
    const result = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([rawMatch()]),
      observedAt: '2026-08-31T14:00:00.000Z'
    });

    expect(result.delta.matches).toEqual([expect.objectContaining({
      matchId: 'match-current-alpha',
      competitionId: entry.competitionId,
      season: '2026-27',
      status: 'completed',
      scoreHome: 2,
      scoreAway: 1,
      updatedAt: '2026-08-31T14:00:00.000Z'
    })]);
    expect(result.delta.teams).toEqual([]);
    expect(result.delta.links).toEqual([]);
    expect(result.observations).toEqual([{
      matchId: 'match-current-alpha',
      providerMatchId: '501',
      outcome: 'terminal'
    }]);
    expect(result.delta.provenance.map((item) => item.fieldPath).sort()).toEqual([
      'scoreAway', 'scoreHome', 'status'
    ]);
  });

  it('maps postponed and cancelled reasons without inventing a score', () => {
    const postponed = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([rawMatch({
        status: {
          utcTime: '2026-08-31T12:00:00.000Z',
          finished: false,
          started: false,
          cancelled: true,
          reason: { short: 'PP', long: 'Postponed' }
        }
      })]),
      observedAt: '2026-08-31T14:00:00.000Z'
    });
    expect(postponed.delta.matches[0]).toMatchObject({
      status: 'postponed', scoreHome: null, scoreAway: null
    });

    const cancelled = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([rawMatch({
        status: {
          utcTime: '2026-08-31T12:00:00.000Z',
          finished: false,
          started: false,
          cancelled: true,
          reason: { short: 'CANC', long: 'Cancelled' }
        }
      })]),
      observedAt: '2026-08-31T14:00:00.000Z'
    });
    expect(cancelled.delta.matches[0]).toMatchObject({
      status: 'cancelled', scoreHome: null, scoreAway: null
    });
  });

  it('observes but never persists scheduled or in-play data', () => {
    const live = rawMatch({
      status: {
        utcTime: '2026-08-31T12:00:00.000Z',
        finished: false,
        started: true,
        cancelled: false,
        scoreStr: '8 - 7'
      }
    });
    const result = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([live]),
      observedAt: '2026-08-31T14:00:00.000Z'
    });

    expect(result.delta.matches).toEqual([]);
    expect(result.delta.provenance).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('8 - 7');
    expect(result.observations).toEqual([{
      matchId: 'match-current-alpha', providerMatchId: '501', outcome: 'non_terminal'
    }]);
  });

  it('rejects unknown terminal matches instead of guessing a canonical season', () => {
    const result = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([rawMatch({ id: 999 })]),
      observedAt: '2026-08-31T14:00:00.000Z'
    });

    expect(result.delta.matches).toEqual([]);
    expect(result.issues).toEqual([expect.objectContaining({ code: 'unknown_match' })]);
  });

  it('rejects a terminal row with an invalid final score', () => {
    const result = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([rawMatch({
        home: { id: 1, name: 'Home' },
        away: { id: 2, name: 'Away' },
        status: {
          utcTime: '2026-08-31T12:00:00.000Z',
          finished: true,
          started: true,
          cancelled: false
        }
      })]),
      observedAt: '2026-08-31T14:00:00.000Z'
    });

    expect(result.delta.matches).toEqual([]);
    expect(result.observations[0]).toMatchObject({ outcome: 'invalid' });
    expect(result.issues).toEqual([expect.objectContaining({ code: 'invalid_score' })]);
  });

  it('ignores global response leagues outside the canonical registry', () => {
    const result = adaptFotMobDailyTerminalResults({
      registry: COMPETITION_SOURCE_REGISTRY,
      base: baseMatch(),
      rawPayload: payload([rawMatch()], 999_999),
      observedAt: '2026-08-31T14:00:00.000Z'
    });
    expect(result).toMatchObject({
      delta: { matches: [], links: [], provenance: [] },
      observations: [],
      issues: []
    });
  });
});
