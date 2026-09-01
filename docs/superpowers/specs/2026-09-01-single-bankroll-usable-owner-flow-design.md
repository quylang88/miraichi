# Single-Bankroll Usable Owner Flow Design

- **Date**: 2026-09-01
- **Status**: Owner approved
- **Decision**: ADR-0050

## Outcome

Miraichi becomes immediately usable as a one-owner, one-bankroll point journal. The data model keeps
an internal account key for atomic accounting and backup compatibility, while the normal interface
asks only for opening capital and never asks which account a bet belongs to.

## Primary Flow

1. If no bankroll exists, Today/Bets/Bankroll show one actionable opening-capital setup.
2. Setup creates the internal primary account and timezone-bearing owner discipline preferences with
   nullable numeric thresholds.
3. Add Bet records match/market/selection/HK odds/stake, one-tap emotion, motivation, pre-bet plan
   adherence, and an optional note. The server binds the primary account.
4. Big stake, reached stop-loss, overexposure, or chasing/FOMO/impulse creates a payload-bound
   15-second challenge. The owner can cancel or acknowledge; overrides remain auditable.
5. Pending stake contributes to open exposure. It is not a ledger debit.
6. Settlement calculates standard HK P&L server-side and atomically appends event + ledger delta +
   balance projection. Manual adjustment still requires signed P&L and a reason.
7. Reports present factual counts/P&L and sample sizes. Missing data stays unavailable, never zero.

## Compatibility

- Existing account IDs, legacy unassigned bets, post-bet adherence, backups, and settlement events
  remain readable.
- If multiple active accounts already exist, the server fails closed for implicit placement until a
  deterministic primary is established; it never guesses or merges balances.
- The owner-only V1 UI does not expose new account, archive, or transfer controls.

## Integrity Rules

- Bet status/result projections are settlement-service owned.
- Manual ledger entry signs must match their entry type.
- Opening balance and any withdrawal/transfer result must be non-negative.
- Report timezone is a factual preference; numeric thresholds may all remain null.
- Psychology data is descriptive. No causation, composure score, or recommendation is emitted.

## Deferred Scope

Historical seasons and lazy match detail remain pending independent phases. The active work performs
no FotMob, SportScore, OpenFootball, or other provider request.
