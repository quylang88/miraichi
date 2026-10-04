import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createPostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';

const withoutTransaction = (sql: string): string => sql.replace(/^begin;\s*/iu, '').replace(/\s*commit;\s*$/iu, '');

async function main(): Promise<void> {
  const client = createPostgresQueryClient('postgresql://postgres:postgres@127.0.0.1:15422/postgres');
  const owner = `smoke-settlement-review-${randomUUID()}`;
  const migration = withoutTransaction(readFileSync('supabase/migrations/20260916100000_automatic_settlement_review.sql', 'utf8'));
  const columnCount = async (): Promise<number> => Number((await client.query<{ count: string }>(
    "select count(*)::text as count from information_schema.columns where table_schema='miraichi_app' and table_name='bet_record' and column_name in ('settlement_review_status','settlement_review_reason','settlement_evidence_at')"
  )).rows[0]?.count ?? 0);
  const initial = await columnCount();
  let rolledBack = false;
  let invalidRejected = false;
  try {
    await client.transaction(async (tx) => {
      await tx.query(migration);
      if (Number((await tx.query<{ count: string }>(
        "select count(*)::text as count from information_schema.columns where table_schema='miraichi_app' and table_name='bet_record' and column_name in ('settlement_review_status','settlement_review_reason','settlement_evidence_at')"
      )).rows[0]?.count ?? 0) !== 3) throw new Error('Settlement review columns are missing');
      await tx.query('insert into miraichi_app.app_profile(id,label) values($1,$1)', [owner]);
      await tx.query("insert into miraichi_app.bet_record(bet_id,owner_profile_id,match_group_id,home_team_name,away_team_name,market_type,selection_label,odds_format,odds_value,stake_points,status,settlement_review_status,settlement_review_reason,settlement_evidence_at,created_at,updated_at) values($1,$2,'match','A','B','1X2','A · FT','HK',0.9,10,'pending','manual_required','missing_detail',now(),now(),now())", [`bet-${owner}`, owner]);
      await tx.query('savepoint invalid_review');
      try {
        await tx.query("update miraichi_app.bet_record set settlement_review_reason='invented_reason' where owner_profile_id=$1", [owner]);
      } catch {
        invalidRejected = true;
        await tx.query('rollback to savepoint invalid_review');
      }
      await tx.query('release savepoint invalid_review');
      if (!invalidRejected) throw new Error('Invalid review reason was accepted');
      await tx.query("update miraichi_app.bet_record set status='settled',settlement_type='full_win',profit_loss_points=9,settled_at=now(),settlement_review_status='auto_settled',settlement_review_reason=null where owner_profile_id=$1", [owner]);
      throw new Error('intentional local rollback');
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'intentional local rollback') rolledBack = true;
    else throw error;
  }
  const ownerRows = await client.query('select id from miraichi_app.app_profile where id=$1', [owner]);
  if (!rolledBack || await columnCount() !== initial || ownerRows.rows.length !== 0) throw new Error('Local rollback or cleanup failed');
  console.log(JSON.stringify({ gate: 'automatic-settlement-review-local-sql', status: 'passed', constraints: true, rollback: true, cleanup: true }));
}

void main().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : 'Automatic settlement review SQL gate failed');
  process.exit(1);
});
