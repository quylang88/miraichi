begin;
create table miraichi_app.owner_session_revocation (
  token_hash text primary key check (token_hash ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null
);
alter table miraichi_app.owner_session_revocation enable row level security;
revoke all on miraichi_app.owner_session_revocation from public, anon, authenticated, service_role;
commit;
