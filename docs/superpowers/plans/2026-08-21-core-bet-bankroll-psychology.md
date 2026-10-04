# Core Bet, Bankroll & Psychology Discipline Implementation Plan

> Owner approved on 2026-08-21. Execute slices in order with a failing test observed before production behavior.

## Slice 1 — Shared contracts and settlement math

**Files**
- Create `packages/shared/src/contracts/core-betting-contracts.ts` and colocated test.
- Create `packages/shared/src/calculator/hk-settlement-calculator.ts` and colocated test.
- Modify shared contract indexes and `packages/shared/src/index.ts`.

**Red tests**
- Validate nullable discipline thresholds, IANA timezone, enum values, positive stake with at most two decimals, HK odds, psychology requirements, manual-adjustment reason, and forbidden fields.
- Prove all standard outcomes, four-decimal rounding, and rejection of missing/invalid inputs.

**Implementation**
- Add the ADR-0046 types and a decimal-safe calculator. Do not add risk defaults or reporting formulas outside the approved count/P&L aggregation.

**Verify**
- `pnpm exec vitest run packages/shared/src/contracts/core-betting-contracts.test.ts packages/shared/src/calculator/hk-settlement-calculator.test.ts`
- `pnpm run typecheck`

## Slice 2 — Migration, adapters, and backup V2

**Files**
- Create a versioned migration under `supabase/migrations/` and mirror SQL under the API persistence SQL directory.
- Modify cloud persistence contracts/adapters and their tests.
- Modify backup route/tests for V2 export and V1 import mapping.

**Red tests**
- Assert tables/columns/constraints/indexes, RLS/revokes, idempotency uniqueness, V1 mapping, V2 round trip, legacy void/manual-result mapping, and no forbidden formula fields.
- Prove memory and Supabase adapter parity for config, challenge, settlement transaction, report-window reads, and paired transfer.

**Implementation**
- Add discipline config/challenge and settlement event persistence; extend bet/ledger projections; add transaction methods; preserve legacy reads and backup import.

**Verify**
- `pnpm exec vitest run apps/api/src/persistence packages/shared/src/contracts/cloud-persistence-contracts.test.ts apps/api/src/routes/backups.test.ts`
- `pnpm run typecheck`

## Slice 3 — Discipline and ongoing bet creation API

**Files**
- Create API discipline service/route and tests.
- Modify bets route/tests and API routing.

**Red tests**
- No-config safe path; equality threshold; daily and ISO-week boundary in configured timezone; challenge payload hash/rule version/available time; early, replayed, and stale challenge rejection; server reevaluation; manual match without feed.

**Implementation**
- Add `GET/PUT /api/v1/discipline-config`, `POST /api/v1/discipline-challenges`, and challenge-aware `POST /api/v1/bets`.

**Verify**
- `pnpm exec vitest run apps/api/src/services/discipline-service.test.ts apps/api/src/routes/discipline.test.ts apps/api/src/routes/bets.test.ts`

## Slice 4 — Settlement, correction, bankroll summary and transfer

**Files**
- Create settlement service/route and tests.
- Extend bankroll service/route, persistence adapter, and tests.

**Red tests**
- Atomic standard/manual settlement, required plan adherence, preview equivalence, duplicate retry, rollback, correction delta/effective time, missing account, linked transfer, and realized/exposure/available calculations.

**Implementation**
- Add `POST /api/v1/bets/:id/settlements`, `GET /api/v1/bankroll/summary`, and `POST /api/v1/bankroll/transfers` backed by adapter transactions.

**Verify**
- `pnpm exec vitest run apps/api/src/services/bet-settlement-service.test.ts apps/api/src/routes/bet-settlements.test.ts apps/api/src/routes/bankroll.test.ts`

## Slice 5 — Weekly/monthly reports

**Files**
- Create API report service/route and tests; extend adapter range queries.

**Red tests**
- Week/month/previous-month/all-time windows, timezone and year/month boundaries, empty periods, correction restatement, win-rate denominator, market/psychology/adherence/override breakdown, account filter, and absence of forbidden metrics.

**Implementation**
- Add `GET /api/v1/bet-reports` with factual aggregation only.

**Verify**
- `pnpm exec vitest run apps/api/src/services/bet-report-service.test.ts apps/api/src/routes/bet-reports.test.ts`

## Slice 6 — Typed EN/VI runtime

**Files**
- Replace the web i18n stub with typed catalogs/translator and tests.
- Extend settings tests and shell initialization.

**Red tests**
- Catalog parity, missing-key failure, named placeholders, locale persistence, English default, Vietnamese switch, number/date formatting, and localized API error mapping.

**Implementation**
- Route all new and touched UI copy through the translator; keep locale in local shell settings.

**Verify**
- `pnpm exec vitest run apps/web/src/services/i18n-service.test.ts apps/web/src/production-shell.test.ts`

## Slice 7 — Bets screen

**Files**
- Create Bets feature renderer/controller tests; reduce app-shell/shell-entry responsibility; extend CSS only through existing tokens.

**Red tests**
- Real segmented filtering; manual and match-prefilled form; draft vs ongoing actions; psychology requirements; discipline countdown/acknowledgement; settlement preview/confirm; correction timeline; all async states and keyboard dialog behavior.

**Verify**
- Focused web tests, then `pnpm --filter web test`.

## Slice 8 — Bankroll screen

**Red tests**
- Secondary views, three balance figures, account/all filters, report periods, chart empty/negative/positive states, nullable discipline form, linked transfers, read-only system ledger entries, responsive form, and EN/VI settings sheet.

**Verify**
- Focused web tests, then `pnpm --filter web test`.

## Slice 9 — Today screen

**Red tests**
- Daily P&L/rule/exposure/ongoing projection, inactive config, breach states, manual Quick Add with unavailable feed, and absence of composure/prediction/recommendation claims.

**Verify**
- Focused web tests, then `pnpm --filter web test`.

## Slice 10 — Matches integration

**Red tests**
- Existing factual snapshot states and filters remain intact; match-prefilled Add Bet works; Manual Add Bet works in unavailable/empty states; no new provider or live-context behavior.

**Verify**
- Focused shell/match tests, `pnpm run verify:product-boundary`.

## Slice 11 — Large-boundary verification

- Add integration tests for challenge-to-bet, settlement transaction, correction, backup compatibility, reports, and feed-independent manual entry.
- Visual QA at 320x568, 390x844, and desktop in English and Vietnamese.
- Run `pnpm run verify:local` and `pnpm run test:integration`.
- Stop before staging or production promotion.
