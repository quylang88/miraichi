import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createPostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';

async function main():Promise<void>{
  const client=createPostgresQueryClient('postgresql://postgres:postgres@127.0.0.1:15422/postgres');
  const owner=`smoke-running-${randomUUID()}`;
  const withoutTransaction=(sql:string)=>sql.replace(/^begin;\s*/i,'').replace(/\s*commit;\s*$/i,'');
  const structuredMigration=withoutTransaction(readFileSync('supabase/migrations/20260915120000_structured_bet_context.sql','utf8'));
  const migration=withoutTransaction(readFileSync('supabase/migrations/20260915150000_running_goal_threshold.sql','utf8'));
  const exists=async()=>Number((await client.query<{count:string}>("select count(*)::text as count from information_schema.columns where table_schema='miraichi_app' and table_name in ('bet_draft','bet_record') and column_name='running_goal_threshold'")).rows[0]?.count??0);
  const initial=await exists();let rolledBack=false;
  try{
    await client.transaction(async(tx)=>{
      if(initial===0)await tx.query(structuredMigration);
      await tx.query(migration);
      if(await (async()=>Number((await tx.query<{count:string}>("select count(*)::text as count from information_schema.columns where table_schema='miraichi_app' and table_name in ('bet_draft','bet_record') and column_name='running_goal_threshold'")).rows[0]?.count??0))()!==2)throw new Error('threshold columns missing');
      await tx.query('insert into miraichi_app.app_profile(id,label) values($1,$1)',[owner]);
      await tx.query("insert into miraichi_app.bet_draft(draft_id,owner_profile_id,match_group_id,market_type,running_window,running_goal_threshold,odds_format,odds_value,stake_points,created_at,updated_at) values($1,$2,'m','running','to_full_time',0.75,'HK',0.9,10,now(),now())",[`d-${owner}`,owner]);
      let rejected=false;try{await tx.query("insert into miraichi_app.bet_draft(draft_id,owner_profile_id,match_group_id,market_type,running_window,running_goal_threshold,odds_format,odds_value,stake_points,created_at,updated_at) values($1,$2,'m','running','fixed_15',0.75,'HK',0.9,10,now(),now())",[`bad-${owner}`,owner]);}catch{rejected=true;}
      if(!rejected)throw new Error('fixed_15 accepted 0.75');
      throw new Error('intentional local rollback');
    });
  }catch(error){if(error instanceof Error&&error.message==='intentional local rollback')rolledBack=true;else throw error;}
  if(!rolledBack||await exists()!==initial||(await client.query('select id from miraichi_app.app_profile where id=$1',[owner])).rows.length)throw new Error('rollback or cleanup failed');
  console.log(JSON.stringify({gate:'running-goal-threshold-local-sql',status:'passed',constraints:true,rollback:true,cleanup:true}));
}
void main().then(()=>process.exit(0)).catch((error)=>{console.error(error instanceof Error?error.message:'Running goal threshold local SQL gate failed');process.exit(1);});
