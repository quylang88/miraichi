import { describe, expect, it } from 'vitest';
import type { PublicLiveMatchSnapshot } from '@miraichi/shared';
import {
  getAvailableRunningWindows,
  resolveRunningContext
} from './running-context-resolver.js';

const generatedAt = '2026-09-15T02:00:00.000Z';

function snapshot(matches: PublicLiveMatchSnapshot['matches']): PublicLiveMatchSnapshot {
  return {
    schemaVersion: 'miraichi.live-match-snapshot.v1',
    snapshotId: 'live-1', generatedAt,
    coverage: {
      kind: 'global-recent-window', upstreamLimit: 20, upstreamCount: matches.length,
      mappedCount: matches.length, publishedCount: matches.length,
      terminalCheckCount: 0, retainedTrackedCount: 0
    },
    matches, warnings: []
  };
}

function live(overrides: Partial<PublicLiveMatchSnapshot['matches'][number]> = {}): PublicLiveMatchSnapshot['matches'][number] {
  return {
    matchId: 'match-1', competition: { id: 'league-1', name: 'League One' },
    kickoffUtc: '2026-09-15T01:00:00.000Z',
    homeTeam: { id: 'arsenal', name: 'Arsenal' },
    awayTeam: { id: 'chelsea', name: 'Chelsea' },
    status: 'live', period: 'second_half', elapsedMinute: 58,
    score: { home: 2, away: 1 },
    sourceRefs: [{ sourceId: 'sportscore', observedAt: generatedAt }],
    updatedAt: generatedAt,
    ...overrides
  };
}

describe('running context resolver', () => {
  it('uses the exact scoped matchId and returns readonly snapshot context', () => {
    expect(resolveRunningContext({
      snapshot: snapshot([live()]), stale: false, matchId: 'match-1',
      homeTeamName: 'ignored', awayTeamName: 'ignored'
    })).toEqual({
      status: 'resolved', matchId: 'match-1', source: 'snapshot', readonly: true,
      liveScoreHome: 2, liveScoreAway: 1, liveMinute: 58,
      observedAt: generatedAt
    });
  });

  it('auto-links a manual match only on one exact normalized home/away pair', () => {
    expect(resolveRunningContext({
      snapshot: snapshot([live()]), stale: false,
      homeTeamName: '  ARSENAL ', awayTeamName: 'Chelsea'
    })).toMatchObject({ status: 'resolved', matchId: 'match-1' });
  });

  it('refuses ambiguous, reversed, suspended, stale, and missing-minute snapshots', () => {
    expect(resolveRunningContext({
      snapshot: snapshot([live(), live({ matchId: 'match-2' })]), stale: false,
      homeTeamName: 'Arsenal', awayTeamName: 'Chelsea'
    })).toEqual({ status: 'manual_required', reason: 'ambiguous_match' });
    expect(resolveRunningContext({
      snapshot: snapshot([live()]), stale: false,
      homeTeamName: 'Chelsea', awayTeamName: 'Arsenal'
    })).toEqual({ status: 'manual_required', reason: 'match_not_found' });
    expect(resolveRunningContext({
      snapshot: snapshot([live({ status: 'suspended' })]), stale: false, matchId: 'match-1',
      homeTeamName: 'Arsenal', awayTeamName: 'Chelsea'
    })).toEqual({ status: 'manual_required', reason: 'match_not_live' });
    expect(resolveRunningContext({
      snapshot: snapshot([live()]), stale: true, matchId: 'match-1',
      homeTeamName: 'Arsenal', awayTeamName: 'Chelsea'
    })).toEqual({ status: 'manual_required', reason: 'stale_snapshot' });
    expect(resolveRunningContext({
      snapshot: snapshot([live({ elapsedMinute: null })]), stale: false, matchId: 'match-1',
      homeTeamName: 'Arsenal', awayTeamName: 'Chelsea'
    })).toEqual({ status: 'manual_required', reason: 'missing_live_context' });
  });

  it('closes HT/FT and elapsed 15-minute blocks from the current minute', () => {
    const minute14 = getAvailableRunningWindows(14);
    expect(minute14).toMatchObject({ toHalfTime: true, toFullTime: true });
    expect(minute14.fixed15.slice(0, 2)).toEqual([
      { startMinute: 0, endMinute: 15, available: true },
      { startMinute: 15, endMinute: 30, available: true }
    ]);
    expect(getAvailableRunningWindows(45)).toMatchObject({ toHalfTime: false, toFullTime: true });
    expect(getAvailableRunningWindows(90)).toMatchObject({ toHalfTime: false, toFullTime: false });
    expect(getAvailableRunningWindows(60).fixed15.find((item) => item.endMinute === 60)?.available).toBe(false);
  });
});
