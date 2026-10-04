begin;
create table miraichi_app.match_detail_cache (
  owner_profile_id text not null,
  match_id text not null,
  detail_json jsonb check (detail_json is null or jsonb_typeof(detail_json)='object'),
  identity_key text,
  source_key text,
  etag text check (length(etag)<=500),
  last_success_at timestamptz,
  next_attempt_at timestamptz,
  lease_id text,
  lease_expires_at timestamptz,
  lease_match_key text,
  primary key(owner_profile_id,match_id),
  foreign key(owner_profile_id,match_id) references miraichi_app.match_record(owner_profile_id,id) on delete cascade,
  check ((lease_id is null)=(lease_expires_at is null))
);
create table miraichi_app.match_detail_provider_control (
  owner_profile_id text not null references miraichi_app.app_profile(id) on delete cascade,
  provider text not null check (provider in ('fotmob-unofficial','sportscore')),
  budget_day date not null default (now() at time zone 'UTC')::date,
  requests_today integer not null default 0 check (requests_today between 0 and 1000),
  next_attempt_at timestamptz,
  lease_id text,
  lease_expires_at timestamptz,
  primary key(owner_profile_id,provider),
  check ((lease_id is null)=(lease_expires_at is null))
);
alter table miraichi_app.match_detail_cache enable row level security;
alter table miraichi_app.match_detail_provider_control enable row level security;
revoke all on miraichi_app.match_detail_cache,miraichi_app.match_detail_provider_control from public,anon,authenticated,service_role;
commit;
