# API Route Map

## Factual Match Data

- `GET /api/v1/health`
- `GET /api/v1/matches`
- `GET /api/v1/matches/detail?id=<matchId>`
- `GET /api/v1/data-snapshot/status`
- `GET /api/v1/ingestion/status`

## Owner Records

- `/api/v1/bet-drafts`
- `/api/v1/bets`
- `/api/v1/bankroll/accounts`
- `/api/v1/bankroll/ledger`
- `/api/v1/backups/export`
- `/api/v1/backups/import`
- `/api/v1/backups/log`
- `/api/v1/cloud-persistence/status`

Any unregistered route returns JSON `404`.
