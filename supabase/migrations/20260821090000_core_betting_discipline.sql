begin;

alter table miraichi_app.bet_record
  add column if not exists bankroll_account_id text,
  add column if not exists pre_bet_emotion text,
  add column if not exists pre_bet_motivation text,
  add column if not exists pre_bet_note text,
  add column if not exists discipline_snapshot jsonb,
  add column if not exists settlement_type text,
  add column if not exists profit_loss_points numeric(18,4),
  add column if not exists settled_at timestamptz,
  add column if not exists post_bet_plan_adherence text,
  add column if not exists post_bet_lesson_note text;

update miraichi_app.bet_record
set profit_loss_points = manual_result_points
where profit_loss_points is null and manual_result_points is not null;

update miraichi_app.bet_record
set status = 'settled', settlement_type = 'void',
    profit_loss_points = coalesce(profit_loss_points, 0), settled_at = coalesce(settled_at, updated_at)
where status = 'void';

alter table miraichi_app.bet_record
  drop constraint if exists bet_record_pre_bet_emotion_check,
  add constraint bet_record_pre_bet_emotion_check check (pre_bet_emotion is null or pre_bet_emotion in ('calm','excited','frustrated','anxious','tired')),
  drop constraint if exists bet_record_pre_bet_motivation_check,
  add constraint bet_record_pre_bet_motivation_check check (pre_bet_motivation is null or pre_bet_motivation in ('planned_analysis','familiar_market','chasing_loss','fomo','impulse','other')),
  drop constraint if exists bet_record_settlement_type_check,
  add constraint bet_record_settlement_type_check check (settlement_type is null or settlement_type in ('full_win','half_win','push','void','half_loss','full_loss','manual_adjustment')),
  drop constraint if exists bet_record_plan_adherence_check,
  add constraint bet_record_plan_adherence_check check (post_bet_plan_adherence is null or post_bet_plan_adherence in ('yes','partly','no'));

create table if not exists miraichi_app.discipline_config (
  owner_profile_id text primary key references miraichi_app.app_profile(id),
  daily_stop_loss_points numeric(18,2) check (daily_stop_loss_points is null or daily_stop_loss_points > 0),
  weekly_stop_loss_points numeric(18,2) check (weekly_stop_loss_points is null or weekly_stop_loss_points > 0),
  big_bet_threshold_points numeric(18,2) check (big_bet_threshold_points is null or big_bet_threshold_points > 0),
  time_zone text not null,
  cooldown_seconds integer not null check (cooldown_seconds = 15),
  version integer not null check (version > 0),
  updated_at timestamptz not null
);

create table if not exists miraichi_app.discipline_challenge (
  challenge_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  payload_hash text not null,
  rule_version integer not null,
  triggered_rules jsonb not null,
  daily_profit_loss_points numeric(18,4) not null,
  weekly_profit_loss_points numeric(18,4) not null,
  available_at timestamptz not null,
  created_at timestamptz not null,
  consumed_at timestamptz,
  unique (owner_profile_id, challenge_id)
);

create table if not exists miraichi_app.bet_settlement_event (
  settlement_event_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  bet_id text not null references miraichi_app.bet_record(bet_id),
  bankroll_account_id text not null references miraichi_app.bankroll_account(account_id),
  settlement_type text not null check (settlement_type in ('full_win','half_win','push','void','half_loss','full_loss','manual_adjustment')),
  plan_adherence text not null check (plan_adherence in ('yes','partly','no')),
  lesson_note text,
  profit_loss_points numeric(18,4),
  adjustment_reason text,
  calculated_profit_loss_points numeric(18,4) not null,
  ledger_delta_points numeric(18,4) not null,
  effective_at timestamptz not null,
  occurred_at timestamptz not null,
  corrects_settlement_event_id text references miraichi_app.bet_settlement_event(settlement_event_id),
  unique (owner_profile_id, settlement_event_id)
);

alter table miraichi_app.bankroll_ledger_entry
  add column if not exists transfer_id text,
  add column if not exists bet_id text,
  add column if not exists settlement_event_id text,
  add column if not exists effective_at timestamptz;

alter table miraichi_app.bankroll_ledger_entry
  drop constraint if exists bankroll_ledger_entry_entry_type_check,
  add constraint bankroll_ledger_entry_entry_type_check check (entry_type in ('deposit','withdrawal','transfer_in','transfer_out','correction','bet_settlement','bet_settlement_correction')),
  drop constraint if exists bankroll_ledger_owner_settlement_unique,
  add constraint bankroll_ledger_owner_settlement_unique unique (owner_profile_id, settlement_event_id);

alter table miraichi_app.backup_export_log
  drop constraint if exists backup_export_log_schema_version_check,
  add constraint backup_export_log_schema_version_check check (schema_version in ('miraichi.cloud-backup.v1','miraichi.cloud-backup.v2'));

create index if not exists bet_record_owner_account_status_idx
  on miraichi_app.bet_record (owner_profile_id, bankroll_account_id, status);
create index if not exists settlement_event_owner_effective_idx
  on miraichi_app.bet_settlement_event (owner_profile_id, effective_at);
create index if not exists discipline_challenge_owner_available_idx
  on miraichi_app.discipline_challenge (owner_profile_id, available_at);

alter table miraichi_app.discipline_config enable row level security;
alter table miraichi_app.discipline_challenge enable row level security;
alter table miraichi_app.bet_settlement_event enable row level security;

revoke all on all tables in schema miraichi_app from anon, authenticated;
revoke all on all sequences in schema miraichi_app from anon, authenticated;

commit;
