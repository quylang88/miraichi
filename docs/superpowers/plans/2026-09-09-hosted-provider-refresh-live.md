# Hosted automatic refresh and LIVE implementation plan

Approved by the owner's 2026-09-09 handoff. Sequential RED → GREEN → focused checks; independent
source/hosting approvals are already present. Each completed slice records real evidence here.

1. **Pure hosted canonical bridge and planner dependency isolation.** Files:
   `apps/worker/src/sources/shared/hosted-canonical.ts`, colocated test,
   `fotmob/fotmob-result-ledger-contract.ts`, `fotmob-terminal-plan.ts`, existing ledger module.
   RED: round-trip private canonical refs and reschedule identity; live exclusion; planner bundle
   rejects filesystem imports. GREEN: pure conversions and ledger-key exports.
   Verify: `pnpm exec vitest run apps/worker/src/sources/shared/hosted-canonical.test.ts`.
2. **Durable hosted coordinator and publication.** Files: `apps/api/src/refresh/hosted-provider-*.ts`
   with colocated tests, `supabase/migrations/20260909120000_hosted_provider_refresh.sql`.
   RED: concurrent/expired fence, rollback, TTL/304, cap/order/current-only, due no-op, 403/429
   circuit, preserved last-good and canonical identity. GREEN: Postgres store plus bounded runner,
   no filesystem or full-snapshot rewrite. Verify: `pnpm exec vitest run apps/api/src/refresh`.
3. **Protected Edge routes and scheduler.** Files: Edge composition, refresh route/auth module,
   scheduler migration/SQL mirror and tests. RED: missing/wrong/owner-only token denied before
   work, exact job/Vault counts and Frankfurt delivery. GREEN: provider-only token routes, three
   idempotent jobs, independent Vault token. Verify: refresh/Edge tests, Edge build/graph audit.
4. **Live cadence, failure cooldown and fencing.** Files: live coordinator/widget client,
   live contract and SQL, colocated tests. RED: five-minute background refresh, repeated failed
   manual refresh cannot request before 60 seconds, circuit stops remaining checks, stale caller
   cannot publish. GREEN: bounded shared refresh behavior. Verify: live/contract/persistence tests.
5. **Matches LIVE quality-up.** Files: matches screen/test, production shell/state/action wiring,
   live lifecycle tests, EN/VI catalogs, CSS. RED: default has no live panel, exact toggle replaces
   date list, allowed statuses only, score/minute, empty, preserved controls and manual refresh.
   GREEN: one accessible toggle and shared row presentation. Verify: screen/shell/live/i18n tests.
6. **Durable logout invalidation.** Files: owner auth boundary/store and tests, Edge composition,
   session revocation migration. RED: saved cookie replay after logout fails across handlers;
   simultaneous logins have distinct tokens. GREEN: bounded durable revocation and token nonce.
   Verify: auth and Edge-owner integration suites.
7. **Committed hosted browser and scheduler gate.** Files: `tests/e2e/staging-owner-flow.ts`,
   `scripts/verify-staging-hosted.ts`, configuration/tests, package scripts/lockfile, runbook.
   RED: absent URL/password and localhost fail; cleanup failure fails. GREEN: real Chromium
   Frankfurt four-tab flow plus explicit deterministic live cases, sanitized scheduler evidence.
   Verify: `pnpm run test:e2e:staging` and `pnpm run verify:staging:hosted` against staging.
8. **Integration and staging closeout.** Run `verify:local`, `test:integration`, `verify:release`,
   `verify:staging`, Edge build/graph/runtime, Cloudflare artifact verification. Apply reviewed
   Frankfurt migrations, deploy, run hosted gate after every deploy. Drill rollback/restore and
   cleanup. Record actual versions/counts/results in PROJECT_PLAN and runbook, commit/push current
   branch. End at `phase:owner-feedback`; no production approval is implied.

## Evidence

- Slice 1: observed RED for `node:fs/promises` in the terminal planner graph, then RED for missing
  hosted canonical conversion. Extracted pure ledger contracts and canonical merge; round-trip
  and rescheduled identity tests passed. Focused runs: 9 ledger/planner tests, then 7 bridge/merge/
  planner tests; TypeScript passed. Local evidence only.

- Preflight: clean branch `feat/api-football-rapid-ingestion`, HEAD `f3113ed`; remote Edge v5 ACTIVE
  and Worker `1c71033f-f97f-42b9-9884-1862d64ad870` at 100% independently checked on 2026-09-09.
- The earlier untracked owner smoke depends on a missing `.secrets/staging-smoke.env`. The owner
  requested reuse of one existing file: hosted E2E will read STAGING_URL and MIRAICHI_OWNER_PASSWORD
  from the gitignored root `.env`. The password must never be included in deployment secret input.
