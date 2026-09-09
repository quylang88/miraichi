import { toProviderNeutralLocalMatch, type LocalMatchDetail, type MatchDetailRefreshState } from '@miraichi/shared';
import type { DetailRead, HostedMatchDetailStore } from './hosted-match-detail-store.js';
import { fetchSelectedMatchDetail, selectMatchDetailSource } from './match-detail-source.js';
import { MatchDetailSourceError } from '../../../worker/src/sources/fotmob/fotmob-detail-client.js';
import { SportScoreWidgetClientError } from '../live/sportscore-widget-client.js';
function response(value:DetailRead,outcome:MatchDetailRefreshState['outcome']):LocalMatchDetail {
  return {...(value.detail ?? {elapsedMinute:null,events:[],updatedAt:value.match.updatedAt}),
    match:{...toProviderNeutralLocalMatch(value.match),...(value.detail?.match.venue?{venue:value.detail.match.venue}:{})},status:value.match.status,
    refresh:{outcome,lastSuccessAt:value.lastSuccessAt,retryAfterSeconds:value.retryAfterSeconds}};
}
export class HostedMatchDetailCoordinator {
  constructor(private readonly store:HostedMatchDetailStore,private readonly fetchDetail:typeof fetchSelectedMatchDetail=fetchSelectedMatchDetail) {}
  async read(id:string):Promise<LocalMatchDetail|null> {
    const value=await this.store.read(id);
    return value?response(value,value.detail?'cached':'unavailable'):null;
  }
  async refresh(id:string):Promise<LocalMatchDetail|null> {
    const before=await this.store.read(id); if(!before) return null;
    const source=selectMatchDetailSource(before.match,before.now);
    if(!source) return response(before,'unsupported');
    const acquired=await this.store.acquire(before.match,source);
    if(!acquired.lease) {
      const latest=await this.store.read(id)??before;
      const delays=[latest.retryAfterSeconds,acquired.retryAfterSeconds].filter((value):value is number=>typeof value==='number');
      return response({...latest,retryAfterSeconds:delays.length?Math.max(...delays):null},acquired.outcome);
    }
    const lease=acquired.lease;
    let outcome:MatchDetailRefreshState['outcome']='unavailable';
    try {
      const result=await this.fetchDetail({match:lease.match,source:lease.source,observedAt:lease.startedAt,...(lease.etag?{etag:lease.etag}:{})});
      if(await this.store.finish(lease,result)) outcome=result.status==='modified'?'refreshed':'not_modified';
    } catch(error) {
      const blocked=(error instanceof MatchDetailSourceError || error instanceof SportScoreWidgetClientError) && error.code==='blocked';
      // An uncertain persistence failure must never make an unpublished candidate visible.
      try {await this.store.finish(lease,{status:'failed',blocked});} catch { /* Durable lease expires; read last good below. */ }
    }
    return response(await this.store.read(id)??before,outcome);
  }
}
