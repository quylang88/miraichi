# Hosted provider refresh and Matches LIVE

Owner boundary: 2026-09-09 handoff. The old candidate is rejected. Frankfurt only; current
providers, current editions, terminal results and factual live overlay only. No historical
season, lazy detail, API-Football, ESPN, bypass, new paid service or Tokyo/production action.

## Facts and decision

Both worker jobs import filesystem warehouse publication, filesystem ledgers and file leases:
`apps/worker/src/jobs/season-hydration-job.ts` and `fotmob-terminal-result-job.ts`.
The hosted DB already retains private source references with canonical match/team/competition IDs
in `miraichi_app.match_record`. Edge must operate from those rows, never a local serving snapshot.

Use the existing pure provider clients/adapters/planners with a DB-backed coordinator. Current
refresh reads only the selected current competition editions; terminal refresh reads only the
bounded due window. A private Postgres control row stores the shared canonical-publication lease,
revision, current ETags/checkpoints, terminal due ledger and durable failure/circuit backoff.
Acquire before reading; commit match deltas, snapshot metadata and checkpoints in one transaction,
fenced by lease identity, DB expiry and revision. Re-read affected rows at publication, preserve
newer data and completed results, and align rescheduled provider matches to their canonical IDs.
Never publish a stale base or replace the whole warehouse. No raw live body is persisted.

Current cadence: scheduler every five minutes, current-only planner, 24-hour TTL, ETag/304,
registry order, hard cap nine requests per invocation; stop starting requests at the run deadline.
The Edge composition defaults to three requests per invocation to bound CPU and DB transfer;
MIRAICHI_CURRENT_REFRESH_BATCH_SIZE may lower it or raise it only within the hard nine-request cap.
Terminal cadence: scheduler every minute, due ledger enforces at least two minutes between date
requests, at most two dates per invocation, zero provider requests without due matches.
Kickoff +105 minutes / four-hour cutoff and finite retries retain the approved local policy.
The 0–2 minute FT objective is best effort once due, not an SLA.

Live cadence: five-minute background and visible refresh, shared durable lease; manual cooldown
60 seconds includes failed attempts. Retain last-good on failure and stop after blocked access.
One list plus at most five tracked terminal checks means at most 1,728 requests/day at five minutes;
the one-minute manual floor bounds the combined worst case to 8,640/day. SportScore documents
approximately 10,000 requests/day/IP and a 60-second cache. Shared hosted egress is not a dedicated
quota guarantee; failures must back off. Five minutes does not conflict with the documented limit.

Sources checked 2026-09-09:
- https://sportscore.com/developers/
- https://sportscore.com/terms/
- https://supabase.com/docs/guides/functions/schedule-functions
- https://supabase.com/docs/guides/functions/limits

Use three named pg_cron jobs and four Vault names: existing function URL, gateway token, live
token, plus an independent provider-refresh token. Resolve secrets at invocation time, force
Frankfurt, and restrict provider routes to the provider token even when an owner cookie exists.
The browser receives only sanitized Miraichi contracts. No internal headers or locators.

## LIVE behavior and staging gate

One button with exact text LIVE and aria-pressed replaces the normal Matches list when active.
Render only live/halftime/suspended with normal row styling, score and minute. Retain last-good
while refreshing. Hide date/search/filter controls while active and restore their unchanged state
when disabled. No new tab, second panel or always-visible live area. Keep static attribution and
EN/VI key parity. Distinguish empty, unavailable and stale honestly.

Commit browser tests under tests/e2e. Require the exact Frankfurt Cloudflare STAGING_URL and
owner password; missing configuration fails. No recording, trace, password logging or secret
assertion output. Test real login/session/four tabs/LIVE/logout, static/API health and redaction.
Exercise deterministic live/empty rendering in explicitly identified browser response fixtures
as well as real hosted live responses; fixtures are not evidence of provider live availability.
Scheduler smoke checks exact Vault/job counts, controlled delivery, valid progress or fresh no-op.
Owner data, if created, uses unique markers and finally cleanup; cleanup failure fails the gate.
Logout must invalidate the server session, including replay, rather than merely delete a cookie.
After each deployment run the committed hosted gate. Drill scheduler disable/restore, Edge and
Worker rollback without deleting data. Stop at a new owner-feedback phase only after all pass.
