begin;
create table miraichi_app.provider_refresh_control (
  owner_profile_id text primary key references miraichi_app.app_profile(id),
  revision bigint not null default 0 check (revision >= 0),
  state_json jsonb not null default '{"current":{},"dates":{},"matches":{},"circuits":{}}'::jsonb
    check (jsonb_typeof(state_json) = 'object'),
  lease_id text,
  lease_expires_at timestamptz,
  last_completed_at timestamptz,
  check ((lease_id is null) = (lease_expires_at is null))
);
alter table miraichi_app.provider_refresh_control enable row level security;
revoke all on miraichi_app.provider_refresh_control from public, anon, authenticated, service_role;
create index match_record_due_refresh_idx on miraichi_app.match_record(owner_profile_id,kickoff_utc)
  where status='scheduled';
commit;
