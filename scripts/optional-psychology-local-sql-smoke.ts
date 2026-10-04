import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createPostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';

async function main(): Promise<void> {
  const client = createPostgresQueryClient('postgresql://postgres:postgres@127.0.0.1:15422/postgres');
  const owner = `smoke-psychology-${randomUUID()}`;
  const migration = readFileSync('supabase/migrations/20260915140000_optional_pre_bet_psychology.sql', 'utf8');
  const column = async () => (await client.query<{is_nullable:string}>("select is_nullable from information_schema.columns where table_schema='miraichi_app' and table_name='bet_settlement_event' and column_name='plan_adherence'")).rows[0]?.is_nullable;
  const initial = await column();
  if (initial !== 'NO' && initial !== 'YES') throw new Error('Local settlement schema is missing');
  let rollback = false;
  try {
    await client.transaction(async (tx) => {
      await tx.query(migration);
      const nullable = (await tx.query<{is_nullable:string}>("select is_nullable from information_schema.columns where table_schema='miraichi_app' and table_name='bet_settlement_event' and column_name='plan_adherence'")).rows[0]?.is_nullable;
      if (nullable !== 'YES') throw new Error('Migration did not permit absent adherence');
      await tx.query('insert into miraichi_app.app_profile(id,label) values($1,$1)', [owner]);
      await tx.query("insert into miraichi_app.bankroll_account(account_id,owner_profile_id,label,unit,opening_balance_points,current_balance_points,created_at,updated_at) values($1,$2,'Smoke','points',100,100,now(),now())", [`account-${owner}`, owner]);
      await tx.query("insert into miraichi_app.bet_record(bet_id,owner_profile_id,match_group_id,home_team_name,away_team_name,market_type,selection_label,odds_format,odds_value,stake_points,status,created_at,updated_at) values($1,$2,'match','A','B','1X2','A','HK',0.9,10,'pending',now(),now())", [`bet-${owner}`, owner]);
      await tx.query("insert into miraichi_app.bet_settlement_event(settlement_event_id,owner_profile_id,bet_id,bankroll_account_id,settlement_type,plan_adherence,calculated_profit_loss_points,ledger_delta_points,effective_at,occurred_at) values($1,$2,$3,$4,'full_win',null,9,9,now(),now())", [`event-${owner}`,owner,`bet-${owner}`,`account-${owner}`]);
      if ((await tx.query('select settlement_event_id from miraichi_app.bet_settlement_event where owner_profile_id=$1 and plan_adherence is null',[owner])).rows.length !== 1) throw new Error('Null settlement did not persist inside transaction');
      throw new Error('intentional local rollback');
    });
  } catch (error) { if (error instanceof Error && error.message === 'intentional local rollback') rollback = true; else throw error; }
  if (!rollback || await column() !== initial || (await client.query('select id from miraichi_app.app_profile where id=$1',[owner])).rows.length !== 0) throw new Error('Local rollback/cleanup failed');
  console.log(JSON.stringify({gate:'optional-psychology-local-sql',status:'passed',nullableWithinTransaction:true,rollback:true,cleanup:true}));
}
void main().then(() => process.exit(0)).catch(() => { console.error('Optional psychology local SQL gate failed'); process.exit(1); });
