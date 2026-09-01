# Single-Bankroll Usable Owner Flow Implementation Plan

> Owner approved on 2026-09-01. Execute in order. Every production behavior starts with an observed
> failing test, reaches focused GREEN, and is committed locally before the next slice starts.

## Slice 1 — Accounting and settlement invariants

**Files**
- Modify `apps/api/src/routes/bets.ts`, `apps/api/src/routes/bets.test.ts`.
- Modify `apps/api/src/routes/bankroll.ts`, `apps/api/src/routes/bankroll.test.ts`.
- Modify memory/Supabase persistence adapters and focused tests only as required.

**RED**
- PATCH cannot set status/result/settlement note.
- Account opening balance must be positive.
- Deposit/withdrawal signs must match entry type; withdrawal/transfer cannot make balance negative.

**Implementation**
- Settlement projection remains owned by `/bets/:id/settlements`.
- Enforce semantic ledger signs and non-negative realized balances in both adapters.

**Verify**
- `pnpm exec vitest run apps/api/src/routes/bets.test.ts apps/api/src/routes/bankroll.test.ts apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts`
- `pnpm run typecheck`

## Slice 2 — Single-bankroll setup and primary resolution

**Files**
- Extend shared cloud/core contracts and tests.
- Modify bankroll/bet API routes, adapters, services, and focused tests.

**RED**
- One setup call creates the primary bankroll and nullable discipline preferences.
- Repeated setup is idempotent; existing multiple accounts fail closed without deletion/merge.
- New ongoing bets bind the only active primary account without a browser account ID.

**Implementation**
- Add explicit owner setup and deterministic single-account resolution.
- Preserve legacy explicit account behavior only where required for imported records.

**Verify**
- Focused shared/API/persistence tests and `pnpm run typecheck`.

## Slice 3 — First-run, Add Bet, and draft completion UX

**Files**
- Modify web bankroll/bet services, screens, shell controller, i18n, and focused tests.

**RED**
- No visible account selector/transfer/create-account label in normal V1.
- Add Bet without setup shows an actionable opening-capital route.
- Draft can reopen, edit, and convert to an ongoing bet.
- Existing multiple-account data renders an honest compatibility warning.

**Implementation**
- Replace account creation with opening-capital setup.
- Auto-bind the primary bankroll, remove normal multi-account controls, and complete draft editing.

**Verify**
- Focused web services/shell tests, `pnpm --filter web test`, and `pnpm run typecheck`.

## Slice 4 — Emotion discipline and overexposure acknowledgement

**Files**
- Extend shared discipline contracts, API discipline service/routes, settlement projection, web form,
  translations, and focused tests.

**RED**
- `chasing_loss`, `fomo`, and `impulse` trigger challenge.
- Candidate stake above available balance triggers challenge but remains overridable.
- Pre-bet plan adherence is required and immutable in the placement snapshot.
- Emotion labels alone do not infer or trigger a hard rule.

**Implementation**
- Add descriptive rule types and payload-bound acknowledgement without stake recommendation.

**Verify**
- Focused shared/API/web tests, product-boundary verification, and typecheck.

## Slice 5 — Truthful reports and psychology presentation

**Files**
- Modify report route/service, Today/Bankroll screens, web services/i18n, and tests.

**RED**
- Reports work with nullable/no numeric thresholds using validated owner timezone preferences.
- Report unavailable renders unavailable, never `0 pts`.
- Psychology rows expose factual sample counts and no causal/recommendation language.

**Implementation**
- Decouple factual reporting from threshold activation and preserve explicit unavailable states.

**Verify**
- Focused API/web report tests, product-boundary verification, and typecheck.

## Slice 6 — Large-boundary verification and closeout

**Files**
- Add/update `tests/integration/` owner-flow coverage.
- Update `PROJECT_PLAN.md` with per-slice evidence and phase closeout.

**RED**
- Integration initially lacks the complete setup → bet → acknowledgement → settlement → report proof.

**Implementation**
- Add only missing cross-module glue found by the integration test.

**Verify**
- Focused integration.
- `pnpm run verify:product-boundary`
- `pnpm run verify:local`
- `pnpm run test:integration`
- `pnpm run verify:release`
- Commit locally; do not push, stage, deploy, or promote.
