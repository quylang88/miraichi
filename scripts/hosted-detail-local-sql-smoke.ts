import { randomUUID } from 'node:crypto';
import { createPostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';
import { PostgresHostedProviderStore } from '../apps/api/src/refresh/hosted-provider-postgres-store.js';
import { PostgresHostedMatchDetailStore } from '../apps/api/src/detail/hosted-match-detail-store.js';
import { toCanonicalWarehouse } from '../apps/worker/src/sources/shared/hosted-canonical.js';
import { adaptFotMobDetail } from '../apps/worker/src/sources/fotmob/fotmob-detail-adapter.js';
import { detailCanonicalFixture, fotmobDetailFixture } from '../tests/fixtures/fotmob-detail.js';
import { gate } from './staging-hosted-config.js';

async function main() {
  // Deliberately fixed disposable local database; this gate cannot target staging or production.
  const client=createPostgresQueryClient('postgresql://postgres:postgres@127.0.0.1:15422/postgres');
  const owner=`e2e-detail-${randomUUID()}`;
  const match={...detailCanonicalFixture,id:`match-${owner}`,competition:{...detailCanonicalFixture.competition,season:'2026-27'}};
  const second={...match,id:`${match.id}-second`,competition:{id:'national-test',name:'National Cup',type:'national-team' as const,season:'2026'}};
  const source={provider:'fotmob-unofficial' as const,id:'100',leagueId:47};
  const resetCooldown=async () => {
    await client.query("update miraichi_app.match_detail_cache set next_attempt_at=null where owner_profile_id=$1",[owner]);
    await client.query("update miraichi_app.match_detail_provider_control set next_attempt_at=null where owner_profile_id=$1",[owner]);
  };
  try {
    await client.query('insert into miraichi_app.app_profile(id,label) values($1,$1)',[owner]);
    const canonical=new PostgresHostedProviderStore(client,owner); const initial=await canonical.acquire(); gate(initial,'canonical lease');
    await canonical.finish(initial,initial.state,[toCanonicalWarehouse([match,second])]);
    const store=new PostgresHostedMatchDetailStore(client,owner);
    const before=await store.read(match.id); gate(before && !before.detail,'readonly empty cache');
    gate((await client.query('select * from miraichi_app.match_detail_cache where owner_profile_id=$1',[owner])).rowCount===0,'read creates no state');
    const first=await store.acquire(before.match,source); gate(first.lease,'first detail lease');
    const concurrent=await store.acquire(before.match,source); gate(!concurrent.lease,'same match concurrency excluded');
    gate(!(await store.acquire((await store.read(second.id))!.match,source)).lease,'provider concurrency excluded');
    const detail=adaptFotMobDetail({match:before.match,payload:fotmobDetailFixture,providerMatchId:'100',leagueId:47,observedAt:first.lease.startedAt});
    gate(await store.finish(first.lease,{status:'modified',detail,etag:'"first"'}),'first cache published');
    gate((await store.read(match.id))?.detail?.events.length===3,'rich cache readable');
    gate(!(await store.acquire(before.match,source)).lease,'successful call cooldown');
    await resetCooldown();
    const conditional=await store.acquire(before.match,source); gate(conditional.lease?.etag==='"first"','etag reused');
    gate(await store.finish(conditional.lease,{status:'not_modified',etag:'"first"'}),'304 cache retained');
    await resetCooldown();
    const failing=await store.acquire(before.match,source); gate(failing.lease,'failure lease');
    gate(await store.finish(failing.lease,{status:'failed',blocked:true}),'blocked response recorded');
    gate((await store.read(match.id))?.detail?.events.length===3,'failure keeps last good');
    const blockedOther=await store.acquire((await store.read(second.id))!.match,source);
    gate(!blockedOther.lease && (blockedOther.retryAfterSeconds??0)>21000,'circuit blocks other matches with truthful retry');
    await resetCooldown();
    const changedBlocked=await store.acquire(before.match,source); gate(changedBlocked.lease,'changed blocked lease');
    await client.query("update miraichi_app.match_record set updated_at=updated_at+interval '1 second' where id=$1",[match.id]);
    gate(await store.finish(changedBlocked.lease,{status:'failed',blocked:true}),'circuit survives canonical version change');
    gate(!(await store.acquire((await store.read(second.id))!.match,source)).lease,'changed canonical still blocks other matches');
    await client.query('update miraichi_app.match_record set updated_at=$2 where id=$1',[match.id,match.updatedAt]);
    await resetCooldown();
    const expired=await store.acquire(before.match,source); gate(expired.lease,'expired test lease');
    await client.query("update miraichi_app.match_detail_cache set lease_expires_at=clock_timestamp()-interval '1 second' where owner_profile_id=$1",[owner]);
    gate(!await store.finish(expired.lease,{status:'modified',detail,etag:'"wrong"'}),'expired lease rejected');
    await client.query('update miraichi_app.match_detail_provider_control set lease_id=null,lease_expires_at=null where owner_profile_id=$1',[owner]);
    await resetCooldown();
    const changed=await store.acquire(before.match,source); gate(changed.lease,'canonical change lease');
    await client.query("update miraichi_app.match_record set kickoff_utc=kickoff_utc+interval '1 hour' where id=$1",[match.id]);
    gate(!await store.finish(changed.lease,{status:'modified',detail}),'canonical identity change rejected');
    gate(!(await store.read(match.id))?.detail,'cache for changed identity hidden');
    await client.query('update miraichi_app.match_record set kickoff_utc=$2 where id=$1',[match.id,match.kickoffUtc]);
    await client.query('update miraichi_app.match_detail_cache set lease_id=null,lease_expires_at=null where owner_profile_id=$1',[owner]);
    await client.query('update miraichi_app.match_detail_provider_control set lease_id=null,lease_expires_at=null where owner_profile_id=$1',[owner]);
    await resetCooldown();
    const rollback=await store.acquire(before.match,source); gate(rollback.lease,'rollback lease');
    const intentionalRollback=new Error('intentional rollback'); let exercisedRollback=false;
    try { await client.transaction(async (tx) => {
      gate(await new PostgresHostedMatchDetailStore(tx,owner).finish(rollback.lease!,{status:'modified',detail:{...detail,events:[]}}),'transaction publication');
      gate((await new PostgresHostedMatchDetailStore(tx,owner).read(match.id))?.detail?.events.length===0,'candidate visible inside transaction');
      throw intentionalRollback;
    }); } catch(error) { if(error!==intentionalRollback) throw error; exercisedRollback=true; }
    gate(exercisedRollback,'intentional rollback exercised');
    gate((await store.read(match.id))?.detail?.events.length===3,'rollback preserves previous cache');
    await client.query('update miraichi_app.match_detail_provider_control set lease_id=null,lease_expires_at=null,requests_today=1000 where owner_profile_id=$1',[owner]);
    await resetCooldown();
    const quota=await store.acquire((await store.read(second.id))!.match,source);
    gate(!quota.lease && (quota.retryAfterSeconds??0)>0,'daily provider budget enforced with truthful retry');
    gate((await store.read(match.id))?.match.status==='completed','canonical remains unchanged');
    console.log(JSON.stringify({gate:'local-detail-sql',status:'passed',lease:true,cooldown:true,circuit:true,budget:true,etag:true,identityFence:true,rollback:true}));
  } finally {
    await client.transaction(async (tx) => {
      await tx.query('delete from miraichi_app.match_detail_provider_control where owner_profile_id=$1',[owner]);
      await tx.query('delete from miraichi_app.provider_refresh_control where owner_profile_id=$1',[owner]);
      await tx.query('delete from miraichi_app.match_snapshot where owner_profile_id=$1',[owner]);
      await tx.query('delete from miraichi_app.app_profile where id=$1',[owner]);
    });
    gate((await client.query('select id from miraichi_app.app_profile where id=$1',[owner])).rowCount===0,'detail SQL cleanup');
  }
}
void main().then(()=>process.exit(0)).catch((error:unknown)=>{console.error(error instanceof Error?error.message:'Local detail SQL gate failed');process.exit(1);});
