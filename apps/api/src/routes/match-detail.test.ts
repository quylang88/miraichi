import { describe, expect, it, vi } from 'vitest';
import { handleMatchDetail, type MatchDetailRouteDependencies } from './match-detail.js';
import { validateLocalMatchDetail } from '@miraichi/shared';
import { detailCanonicalFixture, fotmobDetailFixture } from '../../../../tests/fixtures/fotmob-detail.js';
import { adaptFotMobDetail } from '../../../worker/src/sources/fotmob/fotmob-detail-adapter.js';
const match=detailCanonicalFixture;
const detail=adaptFotMobDetail({match,payload:fotmobDetailFixture,providerMatchId:'100',leagueId:47,observedAt:match.updatedAt});
function dependencies() {
  return {repository:{findById:vi.fn(async()=>match),listMatches:vi.fn(),getStatus:vi.fn()},
    detailStore:{getDetail:vi.fn(async()=>null)},queue:{enqueue:vi.fn()},
    coordinator:{read:vi.fn(async()=>({...detail,refresh:{outcome:'cached',lastSuccessAt:detail.updatedAt,retryAfterSeconds:0}})),
      refresh:vi.fn(async()=>({...detail,refresh:{outcome:'refreshed',lastSuccessAt:detail.updatedAt,retryAfterSeconds:60}}))}};
}
async function call(url:string,method='GET',deps:unknown=dependencies()) {
  const out={statusCode:0,body:'',headers:{} as Record<string,string>,writeHead(status:number,headers:Record<string,string>){this.statusCode=status;this.headers=headers;},end(body:string){this.body=body;}};
  await handleMatchDetail({url,method} as never,out as never,deps as MatchDetailRouteDependencies);
  return {...out,payload:JSON.parse(out.body)};
}
describe('explicit owner match detail route',()=>{
  it('GET reads rich cache without a source refresh or a background queue',async()=>{
    const deps=dependencies(); const out=await call(`/api/v1/matches/detail?id=${match.id}`,'GET',deps);
    expect(out.statusCode).toBe(200); expect(out.payload.enrichment.shots).toHaveLength(1);
    expect(out.payload.refresh.outcome).toBe('cached'); expect(out.headers['Cache-Control']).toBe('no-store');
    expect(deps.coordinator.read).toHaveBeenCalledWith(match.id); expect(deps.coordinator.refresh).not.toHaveBeenCalled(); expect(deps.queue.enqueue).not.toHaveBeenCalled();
  });
  it('POST refresh invokes only the selected canonical match',async()=>{
    const deps=dependencies(); const out=await call(`/api/v1/matches/detail/refresh?id=${match.id}`,'POST',deps);
    expect(out.statusCode).toBe(200); expect(out.payload.refresh.outcome).toBe('refreshed');
    expect(deps.coordinator.refresh).toHaveBeenCalledExactlyOnceWith(match.id); expect(deps.coordinator.read).not.toHaveBeenCalled();
    expect(validateLocalMatchDetail(out.payload).ok).toBe(true);
  });
  it.each([['/api/v1/matches/detail','POST'],['/api/v1/matches/detail/refresh','GET'],['/api/v1/matches/detail','DELETE']])('rejects the wrong method for %s',async(path,method)=>{
    const deps=dependencies(); expect((await call(`${path}?id=${match.id}`,method,deps)).statusCode).toBe(405);
    expect(deps.coordinator.refresh).not.toHaveBeenCalled(); expect(deps.coordinator.read).not.toHaveBeenCalled();
  });
  it.each(['','?id=','?id=%20','?id=a&id=b','?id=a&sourceId=fotmob','?id=https://bad.example'])('rejects ambiguous/invalid query %s',async(query)=>{
    const deps=dependencies(); expect((await call(`/api/v1/matches/detail/refresh${query}`,'POST',deps)).statusCode).toBe(400);
    expect(deps.coordinator.refresh).not.toHaveBeenCalled();
  });
  it('returns 404 for an unknown canonical match without exposing input or upstream errors',async()=>{
    const deps=dependencies(); deps.coordinator.read.mockResolvedValue(null as never);
    expect((await call('/api/v1/matches/detail?id=unknown','GET',deps)).statusCode).toBe(404);
    deps.coordinator.read.mockRejectedValue(new Error('private source URL and credentials'));
    const failed=await call('/api/v1/matches/detail?id=unknown','GET',deps);
    expect(failed.statusCode).toBe(500); expect(failed.body).not.toContain('private source');
  });
  it.each(['club','national-team'] as const)('returns canonical-only GET without enqueueing for %s when hosted detail is absent',async(type)=>{
    const deps=dependencies(); const {coordinator:_,...fallback}=deps;
    fallback.repository.findById.mockResolvedValue({...match,competition:{...match.competition,type}});
    const out=await call(`/api/v1/matches/detail?id=${match.id}`,'GET',fallback);
    expect(out.statusCode).toBe(200); expect(out.payload.status).toBe('completed'); expect(out.payload.refresh.outcome).toBe('unavailable');
    expect(deps.queue.enqueue).not.toHaveBeenCalled(); expect(out.body).not.toMatch(/sourceMatchId|sourceUrl|fotmob\.com/);
  });
  it('preserves rich last-good and retry metadata while stripping provider locators',async()=>{
    const deps=dependencies(); deps.coordinator.refresh.mockResolvedValue({...detail,match,
      refresh:{outcome:'cooldown',lastSuccessAt:detail.updatedAt,retryAfterSeconds:21600}});
    const out=await call(`/api/v1/matches/detail/refresh?id=${match.id}`,'POST',deps);
    expect(out.payload.enrichment.players).toHaveLength(1); expect(out.payload.refresh.retryAfterSeconds).toBe(21600);
    expect(out.body).not.toMatch(/sourceMatchId|sourceUrl/);
  });
});
