import { describe, expect, it, vi } from 'vitest';
import { HostedMatchDetailCoordinator } from './hosted-match-detail.js';
import type { HostedMatchDetailStore, DetailLease } from './hosted-match-detail-store.js';
import { detailCanonicalFixture, fotmobDetailFixture } from '../../../../tests/fixtures/fotmob-detail.js';
import { adaptFotMobDetail } from '../../../worker/src/sources/fotmob/fotmob-detail-adapter.js';
import { MatchDetailSourceError } from '../../../worker/src/sources/fotmob/fotmob-detail-client.js';
const now='2026-09-10T00:00:00.000Z';
const match={...detailCanonicalFixture,competition:{...detailCanonicalFixture.competition,season:'2026-27'}};
const detail=adaptFotMobDetail({match,payload:fotmobDetailFixture,providerMatchId:'100',leagueId:47,observedAt:now});
function setup() {
  const lease:DetailLease={id:'lease',match,source:{provider:'fotmob-unofficial',id:'100',leagueId:47},startedAt:now,etag:'"prior"'};
  const store={read:vi.fn(async () => ({match,detail,lastSuccessAt:now,retryAfterSeconds:60,now})),
    acquire:vi.fn(async () => ({lease,outcome:'busy' as const})),finish:vi.fn(async () => true)} satisfies HostedMatchDetailStore;
  const fetchDetail=vi.fn(async () => ({status:'modified' as const,detail,etag:'"next"'}));
  return {store,fetchDetail,coordinator:new HostedMatchDetailCoordinator(store,fetchDetail)};
}
describe('hosted detail explicit refresh', () => {
  it('reads the last good cache without acquiring a lease or calling a source', async () => {
    const t=setup(); const result=await t.coordinator.read(match.id);
    expect(result?.refresh?.outcome).toBe('cached'); expect(result?.events).toEqual(detail.events);
    expect(t.store.acquire).not.toHaveBeenCalled(); expect(t.fetchDetail).not.toHaveBeenCalled();
  });
  it('retains the factual stadium from cached detail while rebasing canonical status and score', async () => {
    const t=setup();
    expect((await t.coordinator.read(match.id))?.match.venue).toBe('Test Ground');
    expect((await t.coordinator.refresh(match.id))?.match).toMatchObject({venue:'Test Ground',status:match.status,score:match.score});
  });
  it('fetches only the explicitly selected canonical match once and publishes inside its lease', async () => {
    const t=setup(); expect((await t.coordinator.refresh(match.id))?.refresh?.outcome).toBe('refreshed');
    expect(t.fetchDetail).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({match,etag:'"prior"',source:{provider:'fotmob-unofficial',id:'100',leagueId:47}}));
    expect(t.store.finish).toHaveBeenCalledWith(expect.objectContaining({id:'lease'}),{status:'modified',detail,etag:'"next"'});
  });
  it('never requests an unsupported/historical/unknown match', async () => {
    const t=setup(); t.store.read.mockResolvedValue({...await t.store.read(),match:{...match,sourceRefs:[]}});
    expect((await t.coordinator.refresh(match.id))?.refresh?.outcome).toBe('unsupported');
    expect(t.fetchDetail).not.toHaveBeenCalled(); expect(t.store.acquire).not.toHaveBeenCalled();
  });
  it('returns cooldown cache without a provider call when a lease cannot be acquired', async () => {
    const t=setup(); t.store.acquire.mockResolvedValue({lease:null,outcome:'cooldown'} as never);
    expect((await t.coordinator.refresh(match.id))?.refresh).toMatchObject({outcome:'cooldown',lastSuccessAt:now});
    expect(t.fetchDetail).not.toHaveBeenCalled();
  });
  it('reports the provider cooldown instead of the shorter per-match cache cooldown', async () => {
    const t=setup(); t.store.acquire.mockResolvedValue({lease:null,outcome:'cooldown',retryAfterSeconds:21600} as never);
    expect((await t.coordinator.refresh(match.id))?.refresh?.retryAfterSeconds).toBe(21600);
  });
  it('retains the longer match cooldown when the provider floor is only one second', async () => {
    const t=setup(); t.store.acquire.mockResolvedValue({lease:null,outcome:'cooldown',retryAfterSeconds:1} as never);
    expect((await t.coordinator.refresh(match.id))?.refresh?.retryAfterSeconds).toBe(60);
  });
  it('preserves last good detail after a blocked provider and records a shared circuit failure', async () => {
    const t=setup(); t.fetchDetail.mockRejectedValue(new MatchDetailSourceError('blocked'));
    const result=await t.coordinator.refresh(match.id);
    expect(result?.events).toEqual(detail.events); expect(result?.refresh?.outcome).toBe('unavailable');
    expect(t.store.finish).toHaveBeenCalledWith(expect.anything(),{status:'failed',blocked:true});
  });
  it('treats a lost publication fence as unavailable and never returns the unpublished candidate', async () => {
    const t=setup(); t.store.finish.mockResolvedValue(false);
    t.fetchDetail.mockResolvedValue({status:'modified',detail:{...detail,events:[]},etag:'"next"'});
    const result=await t.coordinator.refresh(match.id);
    expect(result?.events).toEqual(detail.events); expect(result?.refresh?.outcome).toBe('unavailable');
  });
});
