import { describe, expect, it, vi } from 'vitest';
import { selectMatchDetailSource, fetchSelectedMatchDetail } from './match-detail-source.js';
import { detailCanonicalFixture, fotmobDetailFixture } from '../../../../tests/fixtures/fotmob-detail.js';
import { adaptSportScoreDetail } from './sportscore-detail-adapter.js';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
const match = {...detailCanonicalFixture,competition:{...detailCanonicalFixture.competition,season:'2026-27'}};
const now = '2026-09-09T11:00:00.000Z';
describe('detail source selection', () => {
  it('selects current registered FotMob by retained match reference; never invents a locator', () => {
    expect(selectMatchDetailSource(match,now)).toEqual({provider:'fotmob-unofficial',id:'100',leagueId:47});
    expect(selectMatchDetailSource({...match,sourceRefs:[]},now)).toBeNull();
    expect(selectMatchDetailSource({...match,competition:{...match.competition,season:'2025-26'}},now)).toBeNull();
    expect(selectMatchDetailSource({...match,competition:{...match.competition,id:'not-in-registry'}},now)).toBeNull();
  });
  it('uses an observed widget slug only, with one selected source request', async () => {
    const widgetMatch = {...match,sourceRefs:[{sourceId:'sportscore' as const,sourceMatchId:'home-vs-away',sourceUrl:'https://sportscore.com/football/match/home-vs-away/',importedAt:now}]};
    expect(selectMatchDetailSource(widgetMatch,now)).toEqual({provider:'sportscore',id:'home-vs-away'});
    const source = selectMatchDetailSource(match,now)!;
    const fotmob = {get:vi.fn(async () => ({status:'modified' as const,payload:fotmobDetailFixture}))};
    const sportscore = {getMatch:vi.fn()};
    const result = await fetchSelectedMatchDetail({match,source,observedAt:now,fotmob,sportscore});
    expect(result.status).toBe('modified'); expect(fotmob.get).toHaveBeenCalledTimes(1); expect(sportscore.getMatch).not.toHaveBeenCalled();
  });
  it('rejects current editions that have not been verified in the source binding', () => {
    const entry=structuredClone(COMPETITION_SOURCE_REGISTRY.find((e) => e.competitionId===match.competition.id)!);
    entry.sourceBindings.detail!.availableCanonicalSeasons=['2025-26'];
    expect(selectMatchDetailSource(match,now,[entry])).toBeNull();
    expect(selectMatchDetailSource({...match,competition:{...match.competition,season:'2027-28'}},'2027-09-09T00:00:00Z')).toBeNull();
  });
  it('does not reinterpret legacy provider IDs as observed widget slugs', () => {
    for(const id of ['987654','home-vs-away']) expect(selectMatchDetailSource({...match,sourceRefs:[{sourceId:'sportscore',sourceMatchId:id,importedAt:now}]},now)).toBeNull();
  });
});
const widget = {sport:'football',match:{home:'Home FC',away:'Away FC',time:match.kickoffUtc,competition:'Premier League',
  url:'/football/match/home-vs-away/',status:'finished',home_score:'2',away_score:'1',home_ht_score:1,away_ht_score:0,
  incidents:[{time:60,type:'Substitution',side:'home',player_out:'Outgoing',player_in:'Incoming',is_sub:true}],
  lineups:{confirmed:true,home_formation:'4-3-3',home_xi:[{name:'Home Player',number:9,position:'F',rating:'8.5'}],away_xi:[],home_subs:[],away_subs:[]},stats:[]}};
describe('SportScore widget factual detail', () => {
  it('unwraps observed widget shape and maps facts while leaving absent stats absent', () => {
    const detail = adaptSportScoreDetail({match,payload:widget,slug:'home-vs-away',observedAt:now});
    expect(detail.events[0]).toMatchObject({type:'substitution',player:'Outgoing',assist:'Incoming',teamId:'team-home'});
    expect(detail.lineups?.[0].starters[0].name).toBe('Home Player');
    expect(detail.enrichment?.statistics).toEqual([]);
    expect(JSON.stringify(detail)).not.toMatch(/rating|sourceMatchId|sourceUrl|tracker/);
  });
  it('rejects a reused slug for another kickoff and never exposes an unconfirmed lineup', () => {
    expect(() => adaptSportScoreDetail({match,payload:{...widget,match:{...widget.match,time:'2026-09-01T00:00:00Z'}},slug:'home-vs-away',observedAt:now})).toThrow(/identity/);
    expect(adaptSportScoreDetail({match,payload:{...widget,match:{...widget.match,lineups:{...widget.match.lineups,confirmed:false}}},slug:'home-vs-away',observedAt:now}).lineups).toBeUndefined();
  });
  it('keeps known widget live status/minute variants without changing the canonical feed status', () => {
    const detail=adaptSportScoreDetail({match:{...match,status:'scheduled',score:{home:null,away:null}},
      payload:{...widget,match:{...widget.match,status:'second-half',status_text:"67'"}},slug:'home-vs-away',observedAt:now});
    expect(detail.enrichment?.observedStatus).toBe('live'); expect(detail.elapsedMinute).toBe(67); expect(detail.match.status).toBe('scheduled');
  });
});
