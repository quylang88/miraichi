# Core Bet, Bankroll & Psychology Discipline Design

- **Date**: 2026-08-21
- **Status**: Owner approved
- **Decision**: ADR-0046
- **Visual baseline**: Existing Black Apple/OLED production shell

## Product Outcome

Miraichi becomes a complete owner-only journal for manually recorded bets, bankroll accounts, settlement history, discipline warnings, psychology check-ins, and weekly/monthly factual reporting. It does not place bets, recommend stakes, infer composure, or claim that discipline guarantees profit.

OpenFootball and manual live-context expansion are pending. A factual match snapshot may prefill a bet, but manual recording works without it.

## Domain Behavior

### Bet lifecycle

1. A partial valid form may be saved as a draft.
2. Recording an ongoing bet requires match labels, market, selection, HK odds, positive stake, bankroll account, emotion, and motivation.
3. The API evaluates configured discipline rules. A breach creates a one-time challenge bound to the bet payload and current rule version.
4. After 15 seconds and explicit acknowledgement, the API reevaluates the rule state and records the ongoing bet with an immutable discipline snapshot.
5. Settlement requires a plan-adherence review and a preview/confirmation step.
6. Standard outcomes calculate P&L server-side; manual adjustment requires signed P&L and a reason.
7. Corrections append a new event and ledger delta. Records are never hard-deleted.

### Discipline

`DisciplineConfig` stores nullable daily, weekly, and big-bet point thresholds plus a required IANA timezone. There are no numeric defaults. Big bet uses `stake >= threshold`; daily/weekly stop-loss uses net realized settlement P&L in the configured period. Weeks start Monday.

The challenge exists to create intentional friction and audit an override. It is not an adversarial security boundary and cannot stop activity outside the app.

### Bankroll

- `realizedBalance`: opening balance plus manual ledger entries and settlement/correction P&L.
- `openExposure`: sum of pending stake assigned to the account.
- `availableBalance`: realized balance minus open exposure.
- Settlement posts only net P&L. Transfers create linked out/in entries atomically.

### Reports

Weekly and monthly reports use settlement effective time and the configured timezone. They include net P&L, stake, average stake, outcome counts, win rate, daily buckets, market breakdown, psychology breakdown, plan adherence, and discipline overrides. They do not include ROI, yield, CLV, drawdown, Kelly, expected return, or recommendations.

## Screen Design

### Bets

Real segmented Ongoing/Drafts/Settled views; manual or match-prefilled Add Bet; Save Draft and Record Ongoing actions; psychology/warning chips; result selection, P&L preview, confirmation; review and correction timeline.

### Bankroll

Secondary Overview/Analytics/Discipline/Ledger views. Overview shows the three balance figures. Analytics supports week/month/previous month/all time. Discipline config has no seeded thresholds. Ledger separates manual and system settlement entries. A settings sheet owns EN/VI and display preferences.

### Today

Daily P&L, rule state, stop-loss utilization, open exposure, ongoing bets, and manual Quick Add. The screen uses `Discipline status`, never an inferred composure score.

### Matches

Preserve the existing factual date/search/filter flow. Match context is optional. Manual Add Bet remains available in ready, empty, stale, and unavailable feed states.

## Internationalization And Accessibility

English and Vietnamese catalogs share one typed key set and named placeholders. English is the default. Dates/numbers use `Intl`; API error codes map to localized copy. Sheets trap focus, restore focus on close, support Escape, expose correct dialog semantics, and respect reduced motion.

## Compatibility

Legacy records remain readable. Unassigned legacy bets are visibly marked and pending ones require account assignment before settlement. Backup V2 is canonical; V1 imports are mapped without inventing missing psychology, account, or settlement data.
