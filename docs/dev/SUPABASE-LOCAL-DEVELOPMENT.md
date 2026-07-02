# Supabase Local Development

## Purpose

This document records the Phase 9 local Supabase workflow for developing Miraichi cloud persistence without deploying to staging or cloud Supabase.

## Boundary

- Use local Docker Postgres first.
- Keep `apps/web -> apps/api -> Supabase Postgres`.
- Do not add browser Supabase clients.
- Do not add `SUPABASE_SERVICE_ROLE_KEY`, `VITE_SUPABASE_*`, or `NEXT_PUBLIC_SUPABASE_*`.
- Do not treat local verification as staging or production approval.

## Required local `.env`

```env
APP_ENV=local
API_URL=http://localhost:3001
CLOUD_PERSISTENCE_MODE=supabase
SUPABASE_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
MIRAICHI_OWNER_PROFILE_ID=owner-primary
LOCAL_MATCH_SNAPSHOT_PATH=apps/api/data/local-match-snapshots/national-team-matches.json
```

## Daily local workflow

Start the local Supabase Postgres container:

```powershell
pnpm run supabase:local:start
```

Print the local DBeaver connection fields:

```powershell
pnpm run supabase:local:status
```

Sync the current national-team snapshot into local Supabase:

```powershell
pnpm run supabase:local:sync
```

Verify the local Supabase developer setup:

```powershell
pnpm run supabase:local:verify
```

The verifier checks:

- local Supabase DB URL;
- Phase 9 migration `20260702052851`;
- all 8 expected `miraichi_app` tables;
- synced snapshot/match data;
- `supabase db lint --local`;
- `supabase db advisors --local --type security`.

## DBeaver connection

Use PostgreSQL connection type:

| Field | Value |
| --- | --- |
| Host | `127.0.0.1` |
| Port | `54322` |
| Database | `postgres` |
| Username | `postgres` |
| Password | `postgres` |
| SSL | disable/off |

After connecting, inspect:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'miraichi_app'
order by table_name;
```

Check synced match data:

```sql
select
  (select count(*)::int from miraichi_app.match_record) as match_count,
  (select count(*)::int from miraichi_app.match_snapshot) as snapshot_count;
```

## Reset local DB

Resetting local DB deletes local Supabase data and reapplies migrations:

```powershell
pnpm exec supabase db reset --local
pnpm run supabase:local:sync
pnpm run supabase:local:verify
```

Do not use this reset command if there is unsaved local database data you care about.

## Stop local services

Stop containers while preserving local data:

```powershell
pnpm exec supabase stop
```

Avoid `pnpm exec supabase stop --no-backup` unless you intentionally want to delete local Supabase data volumes.
