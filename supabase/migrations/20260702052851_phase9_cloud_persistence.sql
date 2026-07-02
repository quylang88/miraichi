begin;

create schema if not exists miraichi_app;

create table if not exists miraichi_app.app_profile (
  id text primary key,
  label text not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists miraichi_app.match_snapshot (
  snapshot_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  generated_at timestamptz not null,
  imported_at timestamptz not null,
  sources jsonb not null default '[]'::jsonb,
  unique (owner_profile_id, snapshot_id)
);

create table if not exists miraichi_app.match_record (
  id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  snapshot_id text not null references miraichi_app.match_snapshot(snapshot_id) on delete cascade,
  competition_id text not null,
  competition_name text not null,
  competition_type text not null check (competition_type = 'national-team'),
  season text not null,
  kickoff_utc timestamptz not null,
  status text not null check (status in ('scheduled','completed','postponed','cancelled','unknown')),
  home_team_id text not null,
  home_team_name text not null,
  home_country_code text,
  away_team_id text not null,
  away_team_name text not null,
  away_country_code text,
  home_score integer check (home_score is null or home_score >= 0),
  away_score integer check (away_score is null or away_score >= 0),
  venue text,
  round_label text,
  stage text,
  neutral_venue boolean,
  source_refs jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null,
  unique (owner_profile_id, id)
);

create table if not exists miraichi_app.bet_draft (
  draft_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  match_group_id text not null,
  market_type text not null check (market_type in ('1X2','over_under','handicap','corners','custom')),
  custom_market_label text,
  line_value numeric(18,4),
  odds_format text not null check (odds_format = 'HK'),
  odds_value numeric(18,4) not null,
  stake_points numeric(18,4) not null,
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_profile_id, draft_id)
);

create table if not exists miraichi_app.bet_record (
  bet_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  match_group_id text not null,
  match_id text,
  home_team_name text not null,
  away_team_name text not null,
  competition_label text,
  season_label text,
  market_type text not null check (market_type in ('1X2','over_under','handicap','corners','custom')),
  custom_market_label text,
  selection_label text not null,
  line_value numeric(18,4),
  odds_format text not null check (odds_format = 'HK'),
  odds_value numeric(18,4) not null,
  stake_points numeric(18,4) not null,
  status text not null check (status in ('pending','settled','void')),
  settlement_note text,
  manual_result_points numeric(18,4),
  notes text,
  tags jsonb not null default '[]'::jsonb,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_profile_id, bet_id)
);

create table if not exists miraichi_app.bankroll_account (
  account_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  label text not null,
  unit text not null check (unit = 'points'),
  opening_balance_points numeric(18,4) not null,
  current_balance_points numeric(18,4) not null,
  archived boolean not null default false,
  created_at timestamptz not null,
  updated_at timestamptz not null,
  unique (owner_profile_id, account_id)
);

create table if not exists miraichi_app.bankroll_ledger_entry (
  entry_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  account_id text not null references miraichi_app.bankroll_account(account_id) on delete restrict,
  entry_type text not null check (entry_type in ('deposit','withdrawal','transfer_in','transfer_out','correction')),
  amount_points numeric(18,4) not null check (amount_points <> 0),
  note text,
  occurred_at timestamptz not null,
  created_at timestamptz not null,
  unique (owner_profile_id, entry_id)
);

create table if not exists miraichi_app.backup_export_log (
  export_id text primary key,
  owner_profile_id text not null references miraichi_app.app_profile(id),
  schema_version text not null check (schema_version = 'miraichi.cloud-backup.v1'),
  exported_at timestamptz not null,
  sha256 text not null,
  record_counts jsonb not null,
  unique (owner_profile_id, export_id)
);

create index if not exists bet_record_owner_status_updated_idx
  on miraichi_app.bet_record (owner_profile_id, status, updated_at desc);
create index if not exists bankroll_ledger_owner_account_occurred_idx
  on miraichi_app.bankroll_ledger_entry (owner_profile_id, account_id, occurred_at desc);
create index if not exists match_record_kickoff_status_idx
  on miraichi_app.match_record (kickoff_utc, status);

alter table miraichi_app.app_profile enable row level security;
alter table miraichi_app.match_snapshot enable row level security;
alter table miraichi_app.match_record enable row level security;
alter table miraichi_app.bet_draft enable row level security;
alter table miraichi_app.bet_record enable row level security;
alter table miraichi_app.bankroll_account enable row level security;
alter table miraichi_app.bankroll_ledger_entry enable row level security;
alter table miraichi_app.backup_export_log enable row level security;

revoke all on schema miraichi_app from anon, authenticated;
revoke all on all tables in schema miraichi_app from anon, authenticated;
revoke all on all sequences in schema miraichi_app from anon, authenticated;

commit;

