import { fetchMatchDetail, type MatchDetailViewState } from './match-detail-service.js';
import type { LocalMatchDetail } from '@miraichi/shared';
export type MatchDetailControllerState=MatchDetailViewState|{status:'loading'};
export function createMatchDetailController(options:{fetchDetail?:typeof fetchMatchDetail;onState:(state:MatchDetailControllerState)=>void}) {
  const fetchDetail=options.fetchDetail??fetchMatchDetail;
  const cache=new Map<string,LocalMatchDetail>();
  let version=0; let active:AbortController|null=null; let pendingId='';
  const cancel=()=>{version++;active?.abort();active=null;pendingId='';};
  const retain=(id:string,detail:LocalMatchDetail)=>{
    cache.delete(id);cache.set(id,detail);
    if(cache.size>20) cache.delete(cache.keys().next().value!);
  };
  const open=async(id:string):Promise<void>=>{
    if(active && pendingId===id) return;
    cancel();const requestVersion=version;const controller=new AbortController();active=controller;pendingId=id;
    const current=()=>requestVersion===version && !controller.signal.aborted;
    let lastGood=cache.get(id);
    options.onState(lastGood?{status:'ready',detail:lastGood,refreshing:true}:{status:'loading'});
    try {
      if(!lastGood) {
        const cached=await fetchDetail(id,{signal:controller.signal});
        if(!current()) return;
        if(cached.status==='ready') {lastGood=cached.detail;retain(id,lastGood);options.onState({...cached,refreshing:true});}
      }
      if(!current()) return;
      const result=await fetchDetail(id,{signal:controller.signal,refresh:true});
      if(!current()) return;
      if(result.status==='ready') {retain(id,result.detail);options.onState(result);}
      else if(lastGood) options.onState({status:'ready',detail:lastGood,refreshError:true});
      else options.onState(result);
    } catch {
      if(current()) options.onState(lastGood?{status:'ready',detail:lastGood,refreshError:true}:{status:'unavailable',match:null,warnings:['detail_request_failed']});
    } finally {if(current()) {active=null;pendingId='';}}
  };
  return {open,cancel};
}
