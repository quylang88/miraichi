# ADR-0050: Single-Bankroll Usable Owner Flow

* **Status**: Accepted
* **Date**: 2026-09-01
* **Owner approval**: Explicitly approved in the instruction to execute `phase:plan Single-bankroll usable owner flow`, fix every reviewed gap, and commit each TDD slice locally before continuing.
* **Supersedes**: The visible multi-account and per-bet account-selection UX of ADR-0046. ADR-0046 settlement, ledger, discipline, reporting, and product guardrails otherwise remain active.

## Context

Miraichi is an owner-only journal using one point bankroll in normal operation. The existing schema
models multiple accounts and the web requires an account selection for each ongoing bet, although
the UI cannot create a second account after setup and still exposes an unusable transfer action with
one account. The reviewed flow also permits a legacy PATCH to change settlement state without an
atomic ledger event, couples reports to threshold configuration, renders unavailable daily P&L as
zero, and records risky motivation without applying intentional friction.

## Decision

1. V1 exposes one bankroll. First-run setup asks only for a positive opening point balance and
   creates the internal primary account.
2. Keep internal account IDs in persistence, settlement events, ledger entries, and backups. Do not
   delete or silently merge existing accounts. Existing multi-account data remains readable through
   compatibility behavior, but the normal UI cannot create or transfer to secondary accounts.
3. New ongoing bets resolve the primary account server-side. Browser-supplied account identity is a
   compatibility input only and may not select an arbitrary secondary account in the normal flow.
4. Settlement state changes only through the append-only settlement endpoint. Generic bet PATCH may
   edit notes/tags but cannot change status, result, or settlement projection.
5. Opening capital must be positive. Deposit is positive, withdrawal is negative, and correction is
   signed non-zero. Withdrawal/transfer cannot make realized balance negative.
6. A candidate stake that exceeds available balance is warning-only and requires the same persistent
   acknowledgement boundary as other discipline warnings. It is not a stake recommendation.
7. `chasing_loss`, `fomo`, and `impulse` motivations require intentional cooldown and acknowledgement.
   Emotion labels remain self-reported context and do not infer mental state.
8. Plan adherence is captured before an ongoing bet to reduce outcome bias. Settlement retains the
   factual result and optional lesson note; legacy post-settlement adherence remains readable.
9. Drafts must be editable and convertible to the ongoing form. Ongoing placement facts remain
   immutable after recording; corrections use explicit append-only settlement behavior.
10. Factual reports work without numeric discipline thresholds. Unavailable state is never rendered
    as a numeric zero. Psychology breakdowns always show sample count and do not claim causation.
11. Historical-season hydration and lazy match detail are pending separate phases.

## Consequences

The normal workflow becomes opening balance → ongoing bet → settlement → factual review without a
wallet selector. Internal account identity remains an accounting boundary, avoiding a destructive
migration. Existing multi-account datasets require explicit owner-led consolidation if the owner
later wants one physical balance; this phase does not guess or destroy that history.

## Non-Goals

- Multi-account creation, transfer, consolidation, currencies, public authentication, or multi-tenancy.
- Stake sizing, Kelly, ROI, CLV, drawdown, profit forecasts, automated picks, or hard gambling control.
- Historical-season hydration, lazy match detail, provider calls, staging, or production promotion.
