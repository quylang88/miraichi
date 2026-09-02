begin;

create table if not exists miraichi_app.live_match_snapshot (
  owner_profile_id text primary key references miraichi_app.app_profile(id) on delete cascade,
  snapshot_id text not null,
  schema_version text not null check (schema_version = 'miraichi.live-match-snapshot.v1'),
  generated_at timestamptz not null,
  overlay_json jsonb not null check (jsonb_typeof(overlay_json) = 'object'),
  updated_at timestamptz not null
);

create table if not exists miraichi_app.live_refresh_state (
  owner_profile_id text primary key references miraichi_app.app_profile(id) on delete cascade,
  status text not null check (status in ('running','succeeded','failed')),
  reason text not null check (reason in ('visible','manual','hourly')),
  last_attempt_at timestamptz not null,
  last_success_at timestamptz,
  last_completed_at timestamptz,
  last_error_code text check (last_error_code is null or last_error_code in ('upstream_timeout','upstream_unavailable','upstream_contract_invalid','persistence_unavailable','internal_error')),
  lease_id text,
  lease_acquired_at timestamptz,
  lease_expires_at timestamptz,
  updated_at timestamptz not null,
  check (
    (status = 'running' and lease_id is not null and lease_acquired_at is not null and lease_expires_at is not null and lease_expires_at > lease_acquired_at)
    or
    (status <> 'running' and lease_id is null and lease_acquired_at is null and lease_expires_at is null)
  )
);

create index if not exists live_refresh_state_lease_expiry_idx
  on miraichi_app.live_refresh_state (lease_expires_at)
  where status = 'running';

alter table miraichi_app.live_match_snapshot enable row level security;
alter table miraichi_app.live_refresh_state enable row level security;

revoke all on miraichi_app.live_match_snapshot from anon, authenticated;
revoke all on miraichi_app.live_refresh_state from anon, authenticated;

commit;
