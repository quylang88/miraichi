# Phase 5 Owner Decision Summary

**Date**: 2026-06-24

This summary records owner responses to the Phase 5 Owner Decision Pack. It is not an ADR approval record, does not change ADR candidate status, and does not authorize implementation.

---

## 1. Scope

This summary applies owner responses for:

- Betting record structure
- Match-centric betting history grouping
- Market catalog and line preset boundaries
- Odds format boundaries
- Stake points and profit/loss boundaries
- Settlement lifecycle boundaries
- Reporting aggregation boundaries
- AI recommendation boundaries
- PWA betting journal UX boundaries
- Bankroll and risk warning boundaries
- Local-first betting data persistence and backup as a new ADR candidate topic

---

## 2. Owner Decisions D1-D10

### D1 / P5-ODP-0023: User-Entered Bet Record Boundary

**Owner response**: Approved with changes.

Use a structured `BetRecordEnvelope` for v1. Core fields are `betId`, `matchGroupId`, `createdAt`, `betTimeType`, `homeTeamName`, `awayTeamName`, `marketType`, `selectionLabel`, `oddsFormat`, `oddsValue`, `stakePoints`, and `status`.

Optional fields are `matchId`, `competitionLabel`, `seasonLabel`, `marketSubtype`, `lineValue`, `lineDisplay`, `liveScoreHome`, `liveScoreAway`, `liveMinute`, `settlement`, `profitLossPoints`, `notes`, `tags`, `source`, `trace`, `predictionTraceId`, and `recommendationId`.

`notes` and `tags` are approved for v1 as metadata only. They must not drive prediction, bankroll, risk, settlement, or AI recommendation logic in v1. `profitLossPoints` must be signed and nullable while the bet is pending.

### D2 / P5-ODP-0024: Match-Centric Betting History Grouping

**Owner response**: Approved with changes.

Use `MatchBettingGroup` as the grouping boundary. `matchGroupId` is the source of truth. `matchId` from feed data is optional. Manual grouping fallback is required.

Team-name normalization can be used only for suggestions or autocomplete, not final grouping logic. Optional group fields are `kickoffTime`, `competitionLabel`, `seasonLabel`, and `groupStatus`. Multiple bets from the same match must appear under the same match group.

### D3 / P5-ODP-0025: Market Catalog and Line Preset Registry

**Owner response**: Approved with changes.

V1 built-in market baseline is 1X2, Over/Under, Handicap, Corners, and Custom Market. `MarketCatalog` and `MarketTypeRegistry` are approved as architecture boundaries.

Cards, Team Totals, First Half, BTTS, player props, exact score, and other detailed market families are deferred. Line presets should be configurable. Manual line entry must always be allowed. Non-standard line increments should warn but not block save.

### D4 / P5-ODP-0026: Odds Format Strategy Boundary

**Owner response**: Approved with changes.

HK odds is the default format for v1. Store `oddsFormat` and raw odds as `rawOddsValue` / `oddsValue`. `normalizedOddsValue` may exist as an optional target/internal field and may remain null until formulas are owner-approved.

Visible odds formats in the first implementation are HK only. Decimal, Malay, Indonesian, and American display/conversion are deferred. No conversion formulas may be implemented without a later owner-approved ADR.

### D5 / P5-ODP-0027: Stake Points and Profit/Loss Boundary

**Owner response**: Approved with changes.

V1 uses points only, with no real currency. `stakePoints` must be a positive number, may use decimals up to 2 decimal places, and must be greater than 0.

`profitLossPoints` must be a signed number that can be positive, zero, or negative, and must remain nullable while the bet is pending.

ROI, yield, stake-sizing, Kelly Criterion, bankroll adjustment, and risk formulas remain unimplemented and deferred. Future P/L direction is hybrid: auto-calculate only after settlement formulas are owner-approved, while allowing manual override/manual adjustment for edge cases.

### D6 / P5-ODP-0028: Bet Lifecycle and Settlement Boundary

**Owner response**: Approved with changes.

Use a manual-first settlement lifecycle. Approved v1 statuses are `pending`, `won`, `lost`, `push`, `void`, `half_won`, `half_lost`, and `manual_adjustment`.

Auto-settlement from feed data is deferred. Settlement formulas are deferred until explicit owner approval. Users must be able to edit/correct settlement status. `manual_adjustment` is required for cashout, operator-specific settlement, unusual cases, and manual correction.

### D7 / P5-ODP-0029: Reporting Aggregation Boundary

**Owner response**: Approved with changes.

V1 reports include daily, weekly, and monthly reports. Report periods use the browser local timezone, while stored timestamps remain UTC.

Candidate report fields are `totalBets`, `settledBets`, `pendingBets`, `winCount`, `lossCount`, `pushCount`, `voidCount`, `halfWinCount`, `halfLossCount`, `totalStakePoints`, `profitLossPoints`, `marketBreakdown`, and `liveVsPreMatchBreakdown`.

ROI, yield, CLV, bankroll curve, and advanced charts are deferred.

### D8 / P5-ODP-0030: AI Betting Recommendation Boundary

**Owner response**: Approved with changes.

AI recommendations should appear as read-only recommendation cards. AI must not auto-create bet records. The user must manually press Add to Journal.

AI recommendation cards must include trace references when available. AI must not suggest stake in v1, rank bets, or claim real confidence until a prediction algorithm is approved. AI must support a no-bet/refusal state and must not invent picks when `predictionAvailable` is false.

Allowed future card content after prediction ADR approval includes suggested market, suggested line, suggested selection, explanation, `predictionTraceId`, and `recommendationId`. Stake suggestion, auto-save, auto-bet, and bankroll-based recommendation are not allowed in v1.

### D9 / P5-ODP-0031: PWA Betting Journal UX Boundary

**Owner response**: Approved with changes.

Use mobile-first PWA UX. V1 navigation is Today, Add, Matches, Reports, and AI.

The main layout is a list-based dashboard grouped by date, with expandable match groups and filter pills for Pending, Settled, Live, and Market. Add Bet is the fastest primary action.

Calendar-first UI is not part of v1. Native app wrapper remains deferred. Dark mode is the default.

### D10 / P5-ODP-0032: Bankroll and Risk Strategy Boundary

**Owner response**: Approved with changes.

Plan `RiskRuleStrategy` as a replaceable boundary. V1 is warning-only: no hard block, no default numeric threshold until owner approval, no Kelly Criterion, no stake-sizing helper, no bankroll growth formula, and no max drawdown formula.

Users should be able to override warnings. Future risk warnings can be planned for high stake compared to bankroll, daily loss warning, weekly loss warning, and loss streak warning. Exact thresholds are deferred.

---

## 3. Additional Owner Decision: ADR-0033

Add `ADR-0033: Local-First Betting Data Persistence and Backup Boundary` as a new Phase 5 ADR candidate.

Owner direction:

- V1 should plan local-first storage.
- Export/Import JSON backup is required.
- IndexedDB is preferred for future implementation planning.
- `localStorage` can be used only for tiny mock/demo state, not long-term real betting history.
- Cloud sync is deferred.
- Auth is deferred.
- Production DB is deferred.
- Account system is deferred.
- No database client, object mapper, table definition, or migration may be created yet.

---

## 4. Approved With Changes Summary

All ten original decision topics were approved with changes. The owner confirmed the architectural direction but tightened the boundaries around field lists, status lists, market baseline, odds visibility, reporting fields, AI recommendation safety, PWA navigation, and risk warning behavior.

The most important correction is that Phase 5 may now document stronger candidate decisions, but still must not implement formulas, storage drivers, recommendation algorithms, or final ADRs.

---

## 5. Deferred Decisions

Deferred decisions include:

- Profit/loss settlement formulas
- ROI and yield formulas
- CLV calculations
- Stake-sizing and Kelly Criterion
- Bankroll adjustment formulas
- Risk warning thresholds
- Hard risk blocks
- Odds conversion formulas
- Decimal, Malay, Indonesian, and American odds display/conversion
- Auto-settlement from feed data
- AI prediction algorithms
- AI recommendation ranking or real confidence claims
- Stake suggestions
- Bankroll-based recommendations
- Cloud sync
- Auth and account system
- Production database selection
- Advanced charts and bankroll curve
- Native app wrapper

---

## 6. Implementation Impact

The owner responses allow future ADR drafting for ADR-0023 through ADR-0033. They also clarify future implementation planning boundaries for data contracts, UI planning, reporting fields, AI recommendation presentation, and local-first backup.

They do not authorize code implementation. They do not authorize final formulas, production storage, AI algorithms, cloud sync, or final ADR acceptance.

---

## 7. What Remains Blocked

The following remain blocked until later explicit owner approval:

- Final ADR creation and acceptance
- Betting calculations
- Profit/loss formulas
- ROI, yield, CLV, stake-sizing, Kelly, bankroll, and risk formulas
- Any production storage implementation
- Any database client, object mapper, table definition, or migration
- Any external wagering or money movement integration
- Any AI prediction or recommendation algorithm
- Any real confidence/ranking claim for AI betting suggestions

---

## 8. Governance Confirmation

- No ADR status changed.
- No final ADR files were created.
- No implementation started.
- No formulas were implemented.
- ADR drafting may be planned next only with explicit owner approval.
