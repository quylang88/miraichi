import type { IncomingMessage, ServerResponse } from 'node:http';
import { toProviderNeutralLocalMatch, validateLocalMatchDetail, type LocalMatchDetail } from '@miraichi/shared';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import type { HostedMatchDetailCoordinator } from '../detail/hosted-match-detail.js';
export interface MatchDetailStore {getDetail(matchId:string):Promise<LocalMatchDetail|null>}
export interface MatchDetailQueue {enqueue(matchId:string):Promise<{status:string}>}
export interface MatchDetailRouteDependencies {
  repository?:MatchSnapshotRepository;
  detailStore?:MatchDetailStore;
  coordinator?:Pick<HostedMatchDetailCoordinator,'read'|'refresh'>;
  /** Legacy injection compatibility only. Detail routes never enqueue work. */
  queue?:MatchDetailQueue;
  dataRoot?:string;
}
export type MatchDetailResponse=LocalMatchDetail;
function sanitize(detail:LocalMatchDetail):LocalMatchDetail {
  return {match:toProviderNeutralLocalMatch(detail.match),status:detail.status,elapsedMinute:detail.elapsedMinute,events:detail.events,updatedAt:detail.updatedAt,
    ...(detail.referee!==undefined?{referee:detail.referee}:{}),...(detail.scoreBreakdown?{scoreBreakdown:detail.scoreBreakdown}:{}),
    ...(detail.teamStats?{teamStats:detail.teamStats}:{}),...(detail.lineups?{lineups:detail.lineups}:{}),
    ...(detail.warnings?{warnings:detail.warnings}:{}),...(detail.notes?{notes:detail.notes}:{}),
    ...(detail.enrichment?{enrichment:detail.enrichment}:{}),...(detail.refresh?{refresh:detail.refresh}:{})};
}
export async function handleMatchDetail(req:IncomingMessage,res:ServerResponse,deps:MatchDetailRouteDependencies={}):Promise<void> {
  const send=(status:number,payload:unknown)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(payload));};
  const error=(status:number,code:string,message:string)=>send(status,{error:{code,message}});
  const url=new URL(req.url||'/','http://localhost');
  const refresh=url.pathname==='/api/v1/matches/detail/refresh';
  if(req.method!==(refresh?'POST':'GET')) {error(405,'method_not_allowed','Method not allowed.');return;}
  const id=url.searchParams.get('id');
  if(!id || !/^[a-zA-Z0-9_-]{1,200}$/u.test(id) || [...url.searchParams.keys()].length!==1) {
    error(400,'match_id_required','Exactly one canonical id parameter is required.');return;
  }
  try {
    let detail:LocalMatchDetail|null;
    if(deps.coordinator) detail=await (refresh?deps.coordinator.refresh(id):deps.coordinator.read(id));
    else {
      if(!deps.repository) throw new Error('Match repository unavailable');
      const match=await deps.repository.findById(id);
      if(!match) {error(404,'match_not_found','Match was not found.');return;}
      const cached=await deps.detailStore?.getDetail(id);
      detail=cached?{...cached,refresh:{outcome:refresh?'unsupported':'cached',lastSuccessAt:cached.updatedAt,retryAfterSeconds:null}}:
        {match:toProviderNeutralLocalMatch(match),status:match.status,elapsedMinute:null,events:[],updatedAt:match.updatedAt,
          refresh:{outcome:refresh?'unsupported':'unavailable',lastSuccessAt:null,retryAfterSeconds:null}};
    }
    if(!detail) {error(404,'match_not_found','Match was not found.');return;}
    const publicDetail=sanitize(detail);
    if(!validateLocalMatchDetail(publicDetail).ok || publicDetail.match.id!==id) throw new Error('Invalid detail response');
    send(200,publicDetail);
  } catch(failure) {
    const status=typeof failure==='object' && failure!==null && 'statusCode' in failure && failure.statusCode===503?503:500;
    error(status,status===503?'match_detail_unavailable':'match_detail_route_error','Match detail service is temporarily unavailable.');
  }
}
