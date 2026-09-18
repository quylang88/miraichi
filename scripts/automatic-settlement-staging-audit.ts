import { linkedStagingQuery } from './staging-scheduler-smoke.js';

function main(): void {
  const row = linkedStagingQuery(`select
    (select count(*) from miraichi_app.bet_draft where owner_profile_id='owner-primary')::int as draft,
    (select count(*) from miraichi_app.bet_record where owner_profile_id='owner-primary')::int as bet,
    (select count(*) from miraichi_app.bankroll_ledger_entry where owner_profile_id='owner-primary')::int as ledger,
    ((select count(*) from miraichi_app.bet_draft where owner_profile_id='owner-primary' and market_type='custom')+
      (select count(*) from miraichi_app.bet_record where owner_profile_id='owner-primary' and market_type='custom'))::int as custom,
    ((select count(*) from miraichi_app.bet_draft where owner_profile_id='owner-primary' and market_type='running')+
      (select count(*) from miraichi_app.bet_record where owner_profile_id='owner-primary' and market_type='running'))::int as running,
    ((select count(*) from miraichi_app.bet_draft where owner_profile_id='owner-primary' and pre_bet_emotion is not null and pre_bet_emotion not in ('calm','excited','tilted'))+
      (select count(*) from miraichi_app.bet_record where owner_profile_id='owner-primary' and pre_bet_emotion is not null and pre_bet_emotion not in ('calm','excited','tilted')))::int as legacy_emotion,
    (select count(*) from miraichi_app.bet_record where owner_profile_id='owner-primary' and status='pending')::int as pending_bet`)[0];
  if (!row) throw new Error('Owner data audit returned no row');
  if (Number(row.custom) !== 0) throw new Error('Custom owner records require explicit review before migration');
  if (Number(row.legacy_emotion) !== 0) throw new Error('Unexpected legacy emotion records require explicit review before migration');
  console.log(JSON.stringify({ gate: 'automatic-settlement-staging-audit', status: 'passed', ...row }));
}

try { main(); } catch (error) {
  console.error(error instanceof Error ? error.message : 'Staging owner-data audit failed');
  process.exitCode = 1;
}
