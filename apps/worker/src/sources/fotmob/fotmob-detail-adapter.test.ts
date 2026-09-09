import { describe, expect, it } from 'vitest';
import { adaptFotMobDetail } from './fotmob-detail-adapter.js';
import { validateLocalMatchDetail } from '@miraichi/shared';
import { detailCanonicalFixture as match, fotmobDetailFixture as raw } from '../../../../../tests/fixtures/fotmob-detail.js';
const observedAt = '2026-09-09T11:00:00.000Z';
const adapt = (payload: unknown = raw) => adaptFotMobDetail({ match, payload, providerMatchId: '100', leagueId: 47, observedAt });

describe('rich factual FotMob detail', () => {
  it('maps observed fields to canonical detail without analytical fields or locators', () => {
    const detail = adapt();
    expect(validateLocalMatchDetail(detail)).toEqual({ ok: true });
    expect(detail.referee).toBe('Test Referee');
    expect(detail.enrichment?.attendance).toBe(29000);
    expect(detail.enrichment?.statistics[0].rows.find((row) => row.key === 'accuratePasses')?.home).toEqual({ value: 502, percentage: 89 });
    expect(detail.enrichment?.statistics).toHaveLength(2);
    expect(detail.enrichment?.players[0].teamId).toBe('team-home');
    expect(detail.enrichment?.players[0].metrics.map((row) => row.key)).toEqual(['goals','accuratePasses']);
    expect(detail.enrichment?.shots[0]).toMatchObject({ teamId: 'team-home', x: 94, y: 34, result: 'goal', minute: 90, extraMinute: 2 });
    expect(detail.events.find((event) => event.type === 'substitution')).toMatchObject({ player: 'Outgoing', assist: 'Incoming' });
    expect(detail.scoreBreakdown?.halftime).toEqual({ home: 1, away: 0 });
    expect(detail.lineups?.[0].starters[0]).toMatchObject({ name: 'Scorer', shirtNumber: 9, position: 'F' });
    const json = JSON.stringify(detail);
    for (const forbidden of ['expectedGoals','expected_goals','rating_title','sourceMatchId','sourceUrl','shotmapEvent','profileUrl']) expect(json).not.toContain(forbidden);
  });
  it.each(['id','league','teams','kickoff'])('rejects a mismatched %s', (kind) => {
    const payload = structuredClone(raw);
    if (kind === 'id') payload.general.matchId = '101';
    if (kind === 'league') payload.general.leagueId = 48;
    if (kind === 'teams') payload.general.homeTeam.name = 'Other FC';
    if (kind === 'kickoff') payload.general.matchTimeUTCDate = '2026-08-31T15:30:00.000Z';
    expect(() => adapt(payload)).toThrow(/identity/i);
  });
  it('keeps missing fields absent and discards predicted lineups', () => {
    const payload = { ...raw, content: { lineup: { ...raw.content.lineup, lineupType: 'predicted' } } };
    const detail = adapt(payload);
    expect(detail.events).toEqual([]);
    expect(detail.lineups).toBeUndefined();
    expect(detail.teamStats).toBeUndefined();
    expect(detail.enrichment?.statistics).toEqual([]);
    expect(validateLocalMatchDetail(detail).ok).toBe(true);
  });
  it('supports another canonical competition/type without hardcoded canonical IDs', () => {
    const national = { ...match, competition: { ...match.competition, id: 'new-national-cup', type: 'national-team' as const },
      homeTeam: { ...match.homeTeam, id: 'national-home' } };
    const detail = adaptFotMobDetail({ match: national, payload: raw, providerMatchId: '100', leagueId: 47, observedAt });
    expect(detail.events[0].teamId).toBe('national-home');
  });
  it('rejects invalid enriched metrics instead of silently trusting public JSON', () => {
    const detail = adapt();
    expect(validateLocalMatchDetail({ ...detail, enrichment: { ...detail.enrichment, shots: [{ teamId: 'foreign', x: 900, y: 0 }] } }).ok).toBe(false);
    expect(validateLocalMatchDetail({ ...detail, enrichment: { ...detail.enrichment, unknownField: 'unvalidated' } }).ok).toBe(false);
  });
  it('does not turn a missing player position into goalkeeper', () => {
    const payload = structuredClone(raw);
    const player = payload.content.lineup.homeTeam.starters[0] as { usualPlayingPositionId: number | null };
    player.usualPlayingPositionId = null;
    expect(adapt(payload).lineups?.[0].starters[0].position).toBeNull();
  });
  it('reads the regular minute separately from stoppage time', () => {
    const payload = { ...raw, general: { ...raw.general, finished: false },
      header: { ...raw.header, status: { finished: false, started: true, reason: { short: '' }, liveTime: { short: '45 + 2′' } } } };
    const detail = adaptFotMobDetail({ match: { ...match, status: 'scheduled', score: { home:null, away:null } },
      payload, providerMatchId:'100', leagueId:47, observedAt });
    expect(detail.enrichment?.observedStatus).toBe('live');
    expect(detail.elapsedMinute).toBe(45);
  });
  it('rejects a finished response without a valid final score', () => {
    const payload = structuredClone(raw); payload.header.teams[0].score = -1;
    expect(() => adapt(payload)).toThrow(/score/i);
  });
  it('keeps other facts and the available lineup when only one side is covered', () => {
    const payload = { ...raw, content: { ...raw.content, lineup: { lineupType:'standard', homeTeam:raw.content.lineup.homeTeam } } };
    const detail = adapt(payload);
    expect(detail.lineups?.[0].starters).toHaveLength(1);
    expect(detail.lineups?.[1]).toMatchObject({ teamId:'team-away', formation:null, starters:[], substitutes:[] });
    expect(detail.enrichment?.statistics).toHaveLength(2);
    expect(detail.warnings).toContain('partial_lineups');
  });
  it('rejects missing provider team IDs rather than equating undefined identities', () => {
    const payload = { ...raw, general: { ...raw.general, homeTeam:{ name:'Home FC' }, awayTeam:{ name:'Away FC' } },
      header:{ ...raw.header, teams:[{score:2},{score:1}] } };
    expect(() => adapt(payload)).toThrow(/identity/i);
  });
  it.each(['AET','Pen'])('never labels the %s final score as the 90-minute score', (reason) => {
    const payload = structuredClone(raw); payload.header.status.reason.short = reason;
    expect(adapt(payload).scoreBreakdown?.fulltime).toEqual({ home:null, away:null });
  });
  it('preserves observed keeper and penalty metric aliases', () => {
    const stats = Object.fromEntries(['saves','conceded_penalties','penalties_won','keeper_high_claim','keeper_sweeper',
      'big_chance_created_team_title','clearance_off_the_line','keeper_diving_save','saves_inside_box','owngoal','errors_led_to_goal']
      .map((key) => [key, { key, stat:{ value:1, type:'integer' } }]));
    const payload = { ...raw, content:{ ...raw.content, playerStats:{ '11':{ ...raw.content.playerStats['11'], stats:[{ stats }] } } } };
    expect(adapt(payload).enrichment?.players[0].metrics.map((row) => row.key)).toEqual([
      'saves','penaltiesConceded','penaltiesWon','highClaims','sweeperActions','bigChancesCreated','clearancesOffLine',
      'divingSaves','savesInsideBox','ownGoals','errorsLedToGoal'
    ]);
  });
  it('rejects invalid scores, count fractions and out-of-range percentages at the contract boundary', () => {
    const detail = adapt();
    for (const score of [{home:1.5,away:0},{home:null,away:null}]) {
      expect(validateLocalMatchDetail({ ...detail, enrichment:{ ...detail.enrichment, score } }).ok).toBe(false);
    }
    for (const [key,value] of [['possession',150],['goals',1.5]]) {
      expect(validateLocalMatchDetail({ ...detail, enrichment:{ ...detail.enrichment,
        statistics:[{ period:'all', rows:[{key,home:{value},away:{value:0}}] }] } }).ok).toBe(false);
    }
  });
});
