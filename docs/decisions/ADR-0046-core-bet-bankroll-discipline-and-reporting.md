# ADR-0046: Core Bet, Bankroll, Discipline And Reporting Boundary

* **Status**: Accepted
* **Date**: 2026-08-21
* **Owner approval**: Explicitly approved by the owner in the instruction `PLEASE IMPLEMENT THIS PLAN` on 2026-08-21.
* **Depends on**: ADR-0023, ADR-0024, ADR-0026, ADR-0033, ADR-0034, ADR-0043, ADR-0044.

## Context

Miraichi currently stores owner-entered bet records and point-account ledger entries, but the web shell cannot complete an ongoing bet workflow, settle it atomically, reconcile it with bankroll, or report discipline history. The prior implementation plan in commit `598ba33` placed settlement and balance synchronization in the browser, introduced unapproved yield/risk fields, assumed schema fields that do not exist, and did not define migration or recovery behavior.

The product remains an owner-only journal. It does not place bets, recommend stakes, predict outcomes, or guarantee profit. Psychology fields describe owner-entered context and correlations only.

## Decision

1. Keep exactly four primary tabs: `Today`, `Matches`, `Bets`, `Bankroll`.
2. Pause new OpenFootball, crawler, and manual-live-context work. Existing factual match snapshots remain optional read-only context.
3. Use server-mediated Supabase persistence. The browser continues to call only `/api/v1/*`.
4. Use warning plus a persistent 15-second acknowledgement challenge for configured big-bet and stop-loss breaches. Recording remains possible after acknowledgement so history cannot be silently omitted.
5. Do not ship numeric risk defaults. Daily stop-loss, weekly stop-loss, and big-bet points are nullable until the owner configures them. Periods use a stored IANA timezone; weeks are ISO Monday-Sunday.
6. Require a compact pre-bet psychology check-in for ongoing bets and a plan-adherence review at settlement.
7. Auto-calculate standard Hong Kong-odds settlement outcomes. Cashout and operator-specific cases use a signed manual adjustment with a required reason.
8. Settlement and correction are append-only events. Bet projection, ledger delta, and bankroll balance change in one API-side transaction with idempotency.
9. Bankroll exposes realized balance, open exposure, and available balance. Pending stake affects exposure/availability but is not a ledger debit; settlement posts only net P&L.
10. Weekly/monthly reporting may aggregate factual owner records and settlement events. ROI, yield, CLV, Kelly, drawdown, stake sizing, recommendations, and profit forecasts remain forbidden.
11. Preserve the Black Apple/OLED design baseline. Provide complete typed English and Vietnamese catalogs, with English as the default and the language switch inside Bankroll settings.

## Contracts

- Standard settlement outcomes: `full_win`, `half_win`, `push`, `void`, `half_loss`, `full_loss`, `manual_adjustment`.
- Pre-bet emotions: `calm`, `excited`, `frustrated`, `anxious`, `tired`.
- Pre-bet motivations: `planned_analysis`, `familiar_market`, `chasing_loss`, `fomo`, `impulse`, `other`.
- Post-bet plan adherence: `yes`, `partly`, `no`.
- Big bet triggers at `stakePoints >= configured threshold`.
- Stop loss triggers when period net P&L is `<= -configured threshold`.
- Report win rate is `(full_win + half_win) / (full_win + half_win + half_loss + full_loss)`; push, void, and manual adjustment are excluded.

## Migration And Compatibility

- Add versioned schema for discipline configuration/challenges, settlement events, typed psychology fields, settlement projection, and settlement-linked ledger entries.
- Map legacy `manualResultPoints` to `profitLossPoints` and legacy `status=void` to a settled void projection.
- Do not guess a bankroll account for legacy records. New ongoing bets require an account; unassigned legacy data remains visible and auditable.
- Export backup V2 and accept V1 imports through an explicit compatibility mapper.
- Production schema application remains a later staging/production action with separate evidence and approval.

## Consequences

This boundary adds friction before risky records and makes settlement/balance history auditable. It cannot stop gambling outside Miraichi, verify that self-reported psychology is true, or guarantee profitability. Past reports can be restated when a correction is applied to the original settlement effective period; the correction audit timestamp remains immutable.

## Non-Goals

- Monthly stop-loss, percentage-of-bankroll limits, drawdown formulas, stake recommendations, automated picks, odds conversion, live feed work, public auth, multi-tenancy, staging, or production promotion.
