import { randomUUID } from 'node:crypto';
import { validateLocalMatchDetail, type LocalMatch, type LocalMatchDetail } from '@miraichi/shared';
import type { SelectedDetailSource } from './match-detail-source.js';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import { mapCloudMatchRow } from '../persistence/supabase/supabase-cloud-persistence-adapter.js';
import { postgresJson } from '../persistence/supabase/postgres-parameters.js';
export interface DetailRead {
  match:LocalMatch; detail:LocalMatchDetail|null; now:string; lastSuccessAt:string|null; retryAfterSeconds:number|null;
}
export interface DetailLease {id:string;match:LocalMatch;source:SelectedDetailSource;startedAt:string;etag?:string}
export type DetailCompletion = {status:'modified';detail:LocalMatchDetail;etag?:string}|{status:'not_modified';etag:string}|{status:'failed';blocked:boolean};
export interface DetailAcquisition {lease:DetailLease|null;outcome:'busy'|'cooldown'|'unavailable';retryAfterSeconds?:number|null}
export interface HostedMatchDetailStore {
  read(id:string):Promise<DetailRead|null>;
  acquire(match:LocalMatch,source:SelectedDetailSource):Promise<DetailAcquisition>;
  finish(lease:DetailLease,result:DetailCompletion):Promise<boolean>;
}
const iso=(v:unknown):string => v instanceof Date?v.toISOString():String(v);
const sourceKey=(source:SelectedDetailSource)=>`${source.provider}:${source.id}`;
function identityKey(match:LocalMatch):string {
  return JSON.stringify([match.id,match.competition.id,match.competition.season,match.homeTeam,match.awayTeam,match.kickoffUtc]);
}
const matchKey=(match:LocalMatch)=>JSON.stringify([identityKey(match),match.status,match.score,match.updatedAt,match.sourceRefs]);
export class PostgresHostedMatchDetailStore implements HostedMatchDetailStore {
  constructor(private readonly client:PostgresQueryClient,private readonly owner:string) {}
  async read(id:string):Promise<DetailRead|null> {
    const result=await this.client.query(`select m.*,c.detail_json,c.identity_key,c.last_success_at,
      clock_timestamp() as read_at, greatest(0,ceil(extract(epoch from c.next_attempt_at-clock_timestamp()))) as retry_seconds
      from miraichi_app.match_record m left join miraichi_app.match_detail_cache c on c.owner_profile_id=m.owner_profile_id and c.match_id=m.id
      where m.owner_profile_id=$1 and m.id=$2`,[this.owner,id]);
    const row=result.rows[0]; if(!row) return null;
    const match=mapCloudMatchRow(row);
    const detail=row.identity_key===identityKey(match) && validateLocalMatchDetail(row.detail_json).ok?row.detail_json as LocalMatchDetail:null;
    return {match,detail,now:iso(row.read_at),lastSuccessAt:detail && row.last_success_at?iso(row.last_success_at):null,
      retryAfterSeconds:row.retry_seconds==null?null:Math.min(86400,Number(row.retry_seconds))};
  }
  async acquire(match:LocalMatch,source:SelectedDetailSource):Promise<DetailAcquisition> {
    return this.client.transaction(async(tx)=>{
      await tx.query(`insert into miraichi_app.match_detail_provider_control(owner_profile_id,provider) values($1,$2) on conflict do nothing`,[this.owner,source.provider]);
      const control=(await tx.query(`select *,budget_day::text as budget_date,clock_timestamp() as started_at,
        (clock_timestamp() at time zone 'UTC')::date::text as today from miraichi_app.match_detail_provider_control
        where owner_profile_id=$1 and provider=$2 for update`,[this.owner,source.provider])).rows[0];
      const startedAt=iso(control.started_at); const now=Date.parse(startedAt);
      const denied=(outcome:'busy'|'cooldown',until:unknown):DetailAcquisition => ({lease:null,outcome,
        retryAfterSeconds:Math.min(86400,Math.max(1,Math.ceil((Date.parse(iso(until))-now)/1000)))});
      if(control.lease_expires_at && Date.parse(iso(control.lease_expires_at))>now) return denied('busy',control.lease_expires_at);
      if(control.next_attempt_at && Date.parse(iso(control.next_attempt_at))>now) return denied('cooldown',control.next_attempt_at);
      const sameDay=String(control.budget_date)===String(control.today);
      if(sameDay && Number(control.requests_today)>=1000) return denied('cooldown',new Date(Date.parse(`${control.today}T00:00:00Z`)+86400000));
      const existing=(await tx.query(`select state_json->'circuits'->>$2 as blocked_until from miraichi_app.provider_refresh_control where owner_profile_id=$1`,[this.owner,source.provider])).rows[0];
      if(existing?.blocked_until && Date.parse(String(existing.blocked_until))>now) return denied('cooldown',existing.blocked_until);
      if(source.provider==='sportscore') {
        const live=(await tx.query(`select last_attempt_at,last_error_code from miraichi_app.live_refresh_state where owner_profile_id=$1`,[this.owner])).rows[0];
        if(live?.last_error_code==='upstream_blocked' && Date.parse(iso(live.last_attempt_at))+900000>now) return denied('cooldown',new Date(Date.parse(iso(live.last_attempt_at))+900000));
      }
      const current=(await tx.query(`select * from miraichi_app.match_record where owner_profile_id=$1 and id=$2 for share`,[this.owner,match.id])).rows[0];
      if(!current || matchKey(mapCloudMatchRow(current))!==matchKey(match)) return {lease:null,outcome:'unavailable'};
      await tx.query(`insert into miraichi_app.match_detail_cache(owner_profile_id,match_id) values($1,$2) on conflict do nothing`,[this.owner,match.id]);
      const cache=(await tx.query(`select * from miraichi_app.match_detail_cache where owner_profile_id=$1 and match_id=$2 for update`,[this.owner,match.id])).rows[0];
      if(cache.lease_expires_at && Date.parse(iso(cache.lease_expires_at))>now) return denied('busy',cache.lease_expires_at);
      if(cache.next_attempt_at && Date.parse(iso(cache.next_attempt_at))>now) return denied('cooldown',cache.next_attempt_at);
      const id=randomUUID();
      await tx.query(`update miraichi_app.match_detail_provider_control set lease_id=$3,lease_expires_at=clock_timestamp()+interval '30 seconds',
        next_attempt_at=clock_timestamp()+interval '1 second',budget_day=(clock_timestamp() at time zone 'UTC')::date,
        requests_today=case when budget_day=(clock_timestamp() at time zone 'UTC')::date then requests_today+1 else 1 end
        where owner_profile_id=$1 and provider=$2`,[this.owner,source.provider,id]);
      await tx.query(`update miraichi_app.match_detail_cache set lease_id=$3,lease_expires_at=clock_timestamp()+interval '30 seconds',
        lease_match_key=$4,next_attempt_at=clock_timestamp()+interval '60 seconds' where owner_profile_id=$1 and match_id=$2`,[this.owner,match.id,id,matchKey(match)]);
      const etag=cache.identity_key===identityKey(match) && cache.source_key===sourceKey(source) && cache.detail_json && cache.etag?String(cache.etag):undefined;
      return {lease:{id,match,source,startedAt,...(etag?{etag}:{})},outcome:'busy'};
    });
  }
  async finish(lease:DetailLease,result:DetailCompletion):Promise<boolean> {
    if(result.status==='modified' && (!validateLocalMatchDetail(result.detail).ok || identityKey(result.detail.match)!==identityKey(lease.match))) return false;
    return this.client.transaction(async(tx)=>{
      const provider=(await tx.query(`select * from miraichi_app.match_detail_provider_control where owner_profile_id=$1 and provider=$2
        and lease_id=$3 and lease_expires_at>clock_timestamp() for update`,[this.owner,lease.source.provider,lease.id])).rows[0];
      if(!provider) return false;
      if(result.status==='failed') {
        // Access failures concern this provider request even when the canonical match changed.
        const delay=result.blocked?(lease.source.provider==='fotmob-unofficial'?21600:900):60;
        await tx.query(`update miraichi_app.match_detail_cache set next_attempt_at=clock_timestamp()+make_interval(secs=>$4),
          lease_id=null,lease_expires_at=null,lease_match_key=null where owner_profile_id=$1 and match_id=$2 and lease_id=$3`,
        [this.owner,lease.match.id,lease.id,delay]);
        const failed=await tx.query(`update miraichi_app.match_detail_provider_control set lease_id=null,lease_expires_at=null,
          next_attempt_at=clock_timestamp()+make_interval(secs=>$4) where owner_profile_id=$1 and provider=$2 and lease_id=$3
          and lease_expires_at>clock_timestamp() returning provider`,[this.owner,lease.source.provider,lease.id,result.blocked?delay:1]);
        if(!failed.rows.length) throw new Error('Detail failure lease expired during transaction');
        return true;
      }
      const cache=(await tx.query(`select * from miraichi_app.match_detail_cache where owner_profile_id=$1 and match_id=$2
        and lease_id=$3 and lease_expires_at>clock_timestamp() for update`,[this.owner,lease.match.id,lease.id])).rows[0];
      if(!cache || cache.lease_match_key!==matchKey(lease.match)) return false;
      const current=(await tx.query(`select * from miraichi_app.match_record where owner_profile_id=$1 and id=$2 for share`,[this.owner,lease.match.id])).rows[0];
      if(!current || matchKey(mapCloudMatchRow(current))!==matchKey(lease.match)) return false;
      if(result.status==='not_modified' && (!cache.detail_json || cache.source_key!==sourceKey(lease.source) || cache.etag!==result.etag || lease.etag!==result.etag)) return false;
      const published=await tx.query(`update miraichi_app.match_detail_cache set
        detail_json=case when $4 then $5::jsonb else detail_json end,
        identity_key=case when $4 then $6 else identity_key end,
        source_key=case when $4 then $7 else source_key end,
        etag=case when $4 then $8 else etag end,
        last_success_at=case when $9 then clock_timestamp() else last_success_at end,
        next_attempt_at=clock_timestamp()+make_interval(secs=>greatest(60,$10)),lease_id=null,lease_expires_at=null,lease_match_key=null
        where owner_profile_id=$1 and match_id=$2 and lease_id=$3 and lease_expires_at>clock_timestamp() returning match_id`,
      [this.owner,lease.match.id,lease.id,result.status==='modified',postgresJson(result.status==='modified'?result.detail:null),identityKey(lease.match),sourceKey(lease.source),
        result.status==='modified'?result.etag??null:null,true,0]);
      if(!published.rows.length) return false;
      const finished=await tx.query(`update miraichi_app.match_detail_provider_control set lease_id=null,lease_expires_at=null,
        next_attempt_at=clock_timestamp()+make_interval(secs=>$4) where owner_profile_id=$1 and provider=$2 and lease_id=$3
        and lease_expires_at>clock_timestamp() returning provider`,[this.owner,lease.source.provider,lease.id,1]);
      if(!finished.rows.length) throw new Error('Detail provider lease expired during publication');
      return true;
    });
  }
}
