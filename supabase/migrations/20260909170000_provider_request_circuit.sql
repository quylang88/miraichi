begin;
create table miraichi_app.provider_request_circuit (
  owner_profile_id text not null references miraichi_app.app_profile(id) on delete cascade,
  provider text not null check(provider in ('fotmob-unofficial','sportscore')),
  blocked_until timestamptz not null,
  primary key(owner_profile_id,provider)
);
alter table miraichi_app.provider_request_circuit enable row level security;
revoke all on miraichi_app.provider_request_circuit from public,anon,authenticated,service_role;
commit;
