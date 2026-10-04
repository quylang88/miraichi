# Miraichi API

The API is the only browser-facing boundary for factual match data and owner persistence.

It serves health, matches, match detail, snapshot status, bet drafts, bet records, bankroll accounts/ledger, backups, cloud-persistence status, and ingestion status. Match reads prefer the local serving store and fall back to the configured cloud snapshot only when the local store is missing.

Run with `pnpm run dev:api`. Configure server-only persistence in `.env`; never expose database credentials to `apps/web`.
