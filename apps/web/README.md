# Miraichi Web

The web app is an owner-only TypeScript PWA with four primary tabs: `Today`, `Matches`, `Bets`, and `Bankroll`.

It calls only `/api/v1/*` endpoints. Match states must distinguish loading, ready, empty, stale, and unavailable conditions. Owner workflows support manual odds, bet drafts/records, point accounts, ledger entries, and backup import/export.

Run `pnpm run dev:web` for development or `pnpm run build:web-static` for the static artifact.
