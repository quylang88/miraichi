import type { LocalMatchSnapshotQuery } from '@miraichi/shared';
import type { MatchSnapshotRepository } from './match-snapshot-repository.js';
const isMissing=(error:unknown)=>(error as {code?:string}).code==='local_snapshot_missing';
export class FallbackMatchSnapshotRepository implements MatchSnapshotRepository {
  constructor(private readonly local:MatchSnapshotRepository,private readonly cloud:MatchSnapshotRepository){}
  async listMatches(query:LocalMatchSnapshotQuery={}){try{return await this.local.listMatches(query);}catch(localError){if(!isMissing(localError))throw localError;try{const result=await this.cloud.listMatches(query);return{...result,snapshot:{...result.snapshot,warnings:[...result.snapshot.warnings,'cloud_snapshot_fallback']}};}catch{const error=localError as Error&{warnings?:string[]};error.warnings=['cloud_snapshot_unavailable'];throw error;}}}
  async findById(id:string){try{return await this.local.findById(id);}catch(localError){if(!isMissing(localError))throw localError;try{return await this.cloud.findById(id);}catch{throw localError;}}}
  async getStatus(){const local=await this.local.getStatus();if(local.freshness!=='missing')return local;try{const cloud=await this.cloud.getStatus();if(cloud.freshness==='missing')return{...local,warnings:[...local.warnings,'cloud_snapshot_unavailable']};return{...cloud,warnings:[...cloud.warnings,'cloud_snapshot_fallback']};}catch{return{...local,warnings:[...local.warnings,'cloud_snapshot_unavailable']};}}
}
