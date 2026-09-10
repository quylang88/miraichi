import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMatchDetailController, type MatchDetailControllerState } from './match-detail-controller.js';
import type { MatchDetailViewState, FetchMatchDetailOptions } from './match-detail-service.js';
import { detailCanonicalFixture } from '../../../../tests/fixtures/fotmob-detail.js';
const ready=(id:string):MatchDetailViewState=>({status:'ready',detail:{match:{...detailCanonicalFixture,id,sourceRefs:[]},status:'completed',elapsedMinute:null,events:[],updatedAt:detailCanonicalFixture.updatedAt}});
const unavailable:MatchDetailViewState={status:'unavailable',match:null,warnings:['detail_request_failed']};
describe('explicit detail interaction controller',()=>{
  afterEach(()=>vi.useRealTimers());
  it('does no work until open, reads cached detail, then refreshes that one selected match',async()=>{
    const fetchDetail=vi.fn(async(id:string,_options?:FetchMatchDetailOptions)=>ready(id));
    const states:MatchDetailControllerState[]=[];
    const controller=createMatchDetailController({fetchDetail,onState:state=>states.push(state)});
    expect(fetchDetail).not.toHaveBeenCalled();
    await controller.open('match-a');
    expect(fetchDetail.mock.calls.map(([id,options])=>[id,Boolean(options?.refresh)])).toEqual([['match-a',false],['match-a',true]]);
    expect(states).toContainEqual(expect.objectContaining({status:'ready',refreshing:true}));
    expect(states.at(-1)).toMatchObject({status:'ready',detail:{match:{id:'match-a'}}});
  });
  it('keeps last good detail after refresh failure and never schedules pending retries',async()=>{
    vi.useFakeTimers(); const onState=vi.fn();
    const fetchDetail=vi.fn(async()=>ready('match-a'));
    const controller=createMatchDetailController({fetchDetail,onState});
    await controller.open('match-a');
    fetchDetail.mockResolvedValue(unavailable); await controller.open('match-a');
    expect(onState.mock.lastCall?.[0]).toMatchObject({status:'ready',refreshError:true,detail:{match:{id:'match-a'}}});
    const calls=fetchDetail.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30*60_000);
    expect(fetchDetail).toHaveBeenCalledTimes(calls);
    fetchDetail.mockResolvedValue({status:'pending',match:detailCanonicalFixture,retryAfterSeconds:1});
    await controller.open('match-b'); const pendingCalls=fetchDetail.mock.calls.length;
    await vi.advanceTimersByTimeAsync(30*60_000); expect(fetchDetail).toHaveBeenCalledTimes(pendingCalls);
  });
  it('ignores late previous-match results and aborts when leaving Information',async()=>{
    let resolveA!:(value:MatchDetailViewState)=>void; const deferred=new Promise<MatchDetailViewState>(resolve=>{resolveA=resolve;});
    const fetchDetail=vi.fn((id:string,_options?:FetchMatchDetailOptions)=>id==='match-a'?deferred:Promise.resolve(ready(id)));
    const onState=vi.fn(); const controller=createMatchDetailController({fetchDetail,onState});
    const first=controller.open('match-a'); await controller.open('match-b');
    resolveA(ready('match-a')); await first;
    expect(onState.mock.lastCall?.[0]).toMatchObject({status:'ready',detail:{match:{id:'match-b'}}});
    expect(fetchDetail.mock.calls.filter(([id])=>id==='match-a')).toHaveLength(1);
    expect(fetchDetail.mock.calls[0]?.[1]?.signal?.aborted).toBe(true);
    const pending=controller.open('match-a'); controller.cancel(); await pending;
    expect(fetchDetail.mock.calls.at(-1)?.[1]?.signal?.aborted).toBe(true);
  });
});
