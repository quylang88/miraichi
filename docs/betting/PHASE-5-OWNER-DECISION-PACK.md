# Phase 5 Owner Decision Pack

This pack is a questionnaire for the project owner. It is not an ADR draft, not an ADR approval, and not a signal that any ADR candidate is ready for adoption.

All recommendations below are AI proposals only. The owner must explicitly approve, modify, or reject each topic before any ADR status, final ADR text, implementation plan, or business logic can change.

---

## Decision Topic 1: User-Entered Bet Record Boundary

1. **Decision ID**: P5-ODP-0023
2. **Related ADR candidate**: ADR-0023, User-Entered Real Bet Record Boundary (candidate only)
3. **Current owner requirement**: Users must be able to manually record real bets they have placed or want to track.
4. **Why this decision matters**: The bet record boundary determines what information can be tracked, filtered, audited, and connected to future prediction traces. If the record is too loose, reports and AI audit links become unreliable. If it is too rigid, manual entry becomes annoying.
5. **Recommended option**: Use a strict candidate bet record envelope with required core fields, optional notes, optional tags, and optional trace metadata. Treat names like `BetRecordEnvelope` as documentation-level boundary names only until the owner approves an ADR.
6. **Alternative options**:
   - Free-text-only journal entries.
   - Strict required fields with no notes or tags.
   - Rich structured metadata with custom fields, ratings, and external references in v1.
7. **Trade-offs**: The recommended option gives enough structure for reporting and auditability without forcing a heavy metadata model. It still requires validation rules later, but those rules remain unimplemented until approved.
8. **Future extensibility impact**: Optional notes, tags, and trace metadata make it easier to add search, filters, prediction trace links, and export/import flows later.
9. **What happens if owner chooses recommended option**: A future ADR can define the approved record envelope and allow implementation planning for manual entry and validation boundaries.
10. **What remains changeable later**: Field names, optional metadata shape, trace keys, validation strictness, and future storage backend remain changeable.
11. **Exact question for owner**: Do you approve using a strict candidate bet record envelope with optional notes, tags, and trace metadata as the Phase 5 direction for manual bet records?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 2: Match-Centric Betting History Grouping

1. **Decision ID**: P5-ODP-0024
2. **Related ADR candidate**: ADR-0024, Match-Centric Betting History Grouping (candidate only)
3. **Current owner requirement**: Betting history must be grouped by match, and multiple bets for the same match should be shown under the same match context.
4. **Why this decision matters**: Match grouping affects how users review history, how reports aggregate match-level performance, and how manual records can later connect to ingested match data.
5. **Recommended option**: Use a match-level grouping boundary that can reference an ingested match ID when available and can also support manual match grouping when no feed match exists.
6. **Alternative options**:
   - Keep all bets as a flat chronological feed.
   - Group only in the frontend while keeping all domain records flat.
   - Require every bet to link to an ingested match ID.
7. **Trade-offs**: The recommended option preserves user workflow when feed data is absent, but it requires clear rules for duplicate manual names and postponed or cancelled matches.
8. **Future extensibility impact**: This keeps the door open for match-level summaries, audit trails, and later feed-assisted grouping without forcing a production database relationship now.
9. **What happens if owner chooses recommended option**: A future ADR can define match group identity rules, manual grouping behavior, and lifecycle states without adding database foreign keys yet.
10. **What remains changeable later**: Name normalization, duplicate handling, postponed match behavior, replay behavior, feed-link priority, and grouping UI remain changeable.
11. **Exact question for owner**: Do you approve a match-level grouping boundary that supports multiple bets per match, optional feed match links, and manual grouping fallback?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 3: Market Catalog and Line Preset Registry

1. **Decision ID**: P5-ODP-0025
2. **Related ADR candidate**: ADR-0025, Market Catalog and Line Preset Registry (candidate only)
3. **Current owner requirement**: Users must be able to select markets such as 1X2, Over/Under, Handicap, and Corners, with presets and manual line entry.
4. **Why this decision matters**: Market support determines the first useful scope of the betting journal. It also controls how much validation, UI complexity, and future settlement complexity the project takes on.
5. **Recommended option**: Use a configurable market catalog boundary with a moderate v1 market set: 1X2, Over/Under, Handicap, and Corners. Allow manual line entry while keeping preset lists configurable.
6. **Alternative options**:
   - Minimal v1: only 1X2 and Over/Under.
   - Broad v1: add cards, player props, custom markets, and other detailed market families immediately.
   - Manual-only markets with no presets.
7. **Trade-offs**: The recommended option is useful without making v1 too wide. It still requires owner approval for exact market labels, preset ranges, and validation strictness before implementation.
8. **Future extensibility impact**: A catalog boundary lets later market families be added by configuration or strategy registration instead of rewriting the bet record boundary.
9. **What happens if owner chooses recommended option**: A future ADR can define approved v1 market categories and authorize UI planning for selectable market groups and preset entry.
10. **What remains changeable later**: Market names, market IDs, preset lists, custom market support, line validation strictness, and future market modules remain changeable.
11. **Exact question for owner**: Do you approve starting Phase 5 market planning with 1X2, Over/Under, Handicap, and Corners as the proposed v1 market set, while preserving manual line entry and future market expansion?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 4: Odds Format Strategy Boundary

1. **Decision ID**: P5-ODP-0026
2. **Related ADR candidate**: ADR-0026, Odds Format Strategy Boundary (candidate only)
3. **Current owner requirement**: HK odds should be the default, with support for other odds formats later.
4. **Why this decision matters**: Odds format handling is a high-risk source of calculation errors. The project needs a single boundary for conversion rules before any payout or reporting logic is implemented.
5. **Recommended option**: Keep HK as the default display/input format and use a future odds-format adapter boundary to normalize other formats only after the owner approves exact conversion and rounding rules.
6. **Alternative options**:
   - Store and display only HK odds in v1.
   - Store only one normalized odds value and discard the original user-entered format.
   - Convert directly inside UI or report code.
7. **Trade-offs**: The recommended option protects user preference and future format support, but it delays actual conversion implementation until formulas and tolerances are explicitly approved.
8. **Future extensibility impact**: A separate odds boundary makes Decimal, Malay, Indonesian, American, or other formats replaceable later without changing journal screens or report layouts.
9. **What happens if owner chooses recommended option**: A future ADR can define approved format list, display behavior, internal representation, precision policy, and conversion approval gates.
10. **What remains changeable later**: Supported formats, precision, rounding, display labels, raw input preservation, and conversion formulas remain changeable.
11. **Exact question for owner**: Do you approve keeping HK odds as the default while planning a separate odds-format boundary for future owner-approved conversions?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 5: Stake Points and Profit/Loss Boundary

1. **Decision ID**: P5-ODP-0027
2. **Related ADR candidate**: ADR-0027, Stake Points and Profit/Loss Boundary (candidate only)
3. **Current owner requirement**: Stakes and profit/loss in v1 must use points, not real currency.
4. **Why this decision matters**: This boundary keeps Miraichi away from money-transfer handling, cash ledger behavior, and compliance-heavy money tracking while still allowing users to analyze performance.
5. **Recommended option**: Use points-only stake and profit/loss fields in documentation-level contracts, with positive decimal stake values allowed as a proposal. Do not define payout, ROI, yield, stake-sizing, or bankroll formulas yet.
6. **Alternative options**:
   - Integer-only points.
   - Manual profit/loss entry only, with no computed values in v1.
   - Real currency tracking in v1.
7. **Trade-offs**: The recommended option supports practical unit tracking without handling money. It still leaves the actual settlement and reporting calculations unresolved until owner-approved ADRs define them.
8. **Future extensibility impact**: Points-only records can later support bankroll charts, export/import, and optional currency mapping if the owner explicitly approves that expansion.
9. **What happens if owner chooses recommended option**: A future ADR can define the point unit policy and authorize validation planning, while calculation formulas remain blocked until separately approved.
10. **What remains changeable later**: Decimal precision, minimum stake, maximum warning behavior, manual adjustment rules, point naming, and future currency support remain changeable.
11. **Exact question for owner**: Do you approve points-only staking and profit/loss tracking for v1, with positive decimal stake values proposed and all formulas deferred?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 6: Bet Lifecycle and Settlement Boundary

1. **Decision ID**: P5-ODP-0028
2. **Related ADR candidate**: ADR-0028, Bet Lifecycle and Settlement Boundary (candidate only)
3. **Current owner requirement**: Users must be able to track wagers, including live wagers and resolution status.
4. **Why this decision matters**: Settlement status drives reporting, history filtering, and future automation hooks. If lifecycle states are unclear, later formulas and UI behavior will conflict.
5. **Recommended option**: Use manual-first settlement states with future automation hooks behind a settlement boundary. Include pending, won, lost, push, void, half-won, and half-lost as proposed states, but do not define payout formulas yet.
6. **Alternative options**:
   - Strict manual-only settlement with no automation hooks.
   - Fully automated settlement from feed data.
   - Manual profit/loss override without structured settlement states.
7. **Trade-offs**: The recommended option keeps the user in control while preserving a path to feed-assisted settlement later. It adds lifecycle vocabulary that must be approved before implementation.
8. **Future extensibility impact**: A settlement boundary allows future market-specific strategies and feed-assisted status suggestions without putting logic in UI or API handlers.
9. **What happens if owner chooses recommended option**: A future ADR can define approved lifecycle states, edit rules, and automation boundaries, while payout formulas remain a separate owner decision.
10. **What remains changeable later**: Status names, editable states, manual override policy, feed-assisted behavior, split-outcome support, and formula ownership remain changeable.
11. **Exact question for owner**: Do you approve a manual-first bet lifecycle with structured settlement states and future automation hooks, while deferring all payout formulas?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 7: Reporting Aggregation Boundary

1. **Decision ID**: P5-ODP-0029
2. **Related ADR candidate**: ADR-0029, Reporting Aggregation Boundary (candidate only)
3. **Current owner requirement**: The product should provide daily, weekly, and monthly reports.
4. **Why this decision matters**: Reporting makes the journal useful, but aggregation logic can easily become tangled with UI rendering, storage choices, and unapproved formulas.
5. **Recommended option**: Plan a separate report aggregation boundary that can produce daily, weekly, and monthly views from approved bet records, using user-local reporting periods as the proposed default. Do not implement aggregation formulas or storage queries yet.
6. **Alternative options**:
   - UI-only reports computed directly in screens.
   - UTC-only reporting periods.
   - User-configurable reporting timezone in v1.
   - Precomputed report records in a database.
7. **Trade-offs**: The recommended option matches user expectations for local dates and keeps aggregation isolated. It postpones advanced timezone settings and storage optimization.
8. **Future extensibility impact**: A report boundary supports later charting, caching, backend aggregation, and custom metrics without rewriting the journal UI.
9. **What happens if owner chooses recommended option**: A future ADR can define report periods, candidate report fields, timezone behavior, and implementation boundaries.
10. **What remains changeable later**: Timezone policy, week start day, report fields, chart types, cache strategy, and backend aggregation strategy remain changeable.
11. **Exact question for owner**: Do you approve daily, weekly, and monthly reporting through a separate aggregation boundary, with user-local reporting periods proposed for v1?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 8: AI Betting Recommendation Boundary

1. **Decision ID**: P5-ODP-0030
2. **Related ADR candidate**: ADR-0030, AI Betting Recommendation Boundary (candidate only)
3. **Current owner requirement**: The app should eventually allow AI to suggest bets.
4. **Why this decision matters**: AI recommendations are risky if they look like automatic betting instructions, cannot be audited, or write into the user's journal without consent.
5. **Recommended option**: Keep AI recommendations as read-only candidate cards with trace references and explicit user action required before any journal record is created. Do not implement prediction algorithms, ranking logic, or stake suggestions.
6. **Alternative options**:
   - Pure text recommendations with no structured card.
   - Directly inject AI drafts into the journal.
   - Disable recommendation UX until prediction models are fully approved.
7. **Trade-offs**: The recommended option gives a clear UX path while preserving user control. It still requires careful copy, traceability, refusal behavior, and owner-approved recommendation rules later.
8. **Future extensibility impact**: Read-only cards can later connect to prediction envelopes, audit reports, dismissal behavior, and conversion-to-journal flows without giving AI write authority.
9. **What happens if owner chooses recommended option**: A future ADR can define recommendation card behavior, trace fields, refusal rules, and conversion flow boundaries.
10. **What remains changeable later**: Card layout, persistence duration, ranking display, explanation fields, conversion behavior, and model integration remain changeable.
11. **Exact question for owner**: Do you approve read-only AI recommendation cards with traceability and explicit user confirmation before any bet record is created?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 9: PWA Betting Journal UX Boundary

1. **Decision ID**: P5-ODP-0031
2. **Related ADR candidate**: ADR-0031, PWA Betting Journal UX Boundary (candidate only)
3. **Current owner requirement**: Phase 5 should include UI/UX design for the PWA betting journal and reporting flow.
4. **Why this decision matters**: Betting journal entry is likely to be mobile-heavy. Poor mobile UX will make manual entry slow and error-prone.
5. **Recommended option**: Use a mobile-first PWA journal layout with list-based history, match grouping, touch-friendly controls, and report tabs. Keep design decisions separate from business formulas.
6. **Alternative options**:
   - Desktop-first dashboard.
   - Calendar-first history view.
   - Native app wrapper before PWA maturity.
7. **Trade-offs**: The recommended option supports fast mobile entry and lower implementation complexity than a calendar-first UI. It may need later enhancement for dense historical review.
8. **Future extensibility impact**: A mobile-first PWA can later add charts, offline backup flows, install prompts, native wrappers, or richer filters without changing core betting boundaries.
9. **What happens if owner chooses recommended option**: A future ADR can authorize responsive PWA planning for add-bet, match detail, report, and AI recommendation views.
10. **What remains changeable later**: Navigation style, theme, chart presence, calendar view, filters, offline backup UI, and native wrapper timing remain changeable.
11. **Exact question for owner**: Do you approve a mobile-first PWA betting journal UX with list-based history, match grouping, and touch-friendly controls as the Phase 5 direction?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Decision Topic 10: Bankroll and Risk Strategy Boundary

1. **Decision ID**: P5-ODP-0032
2. **Related ADR candidate**: ADR-0032, Bankroll and Risk Strategy Boundary (candidate only)
3. **Current owner requirement**: Bankroll boundaries should support future adjustments and rules without locking in v1.
4. **Why this decision matters**: Bankroll and risk rules are business-sensitive. Hardcoding limits, stake-sizing methods, or blocking behavior without owner approval would violate the project governance rules.
5. **Recommended option**: Plan a replaceable risk-warning boundary that can surface non-blocking warnings after the owner approves thresholds and rules. Do not define fixed thresholds, stake-sizing formulas, bankroll adjustment formulas, or blocking rules yet.
6. **Alternative options**:
   - No risk or bankroll warnings.
   - Hard blocking of risky entries after owner-approved thresholds exist.
   - Full stake-sizing helper in v1.
7. **Trade-offs**: The recommended option creates a safer architecture without pretending the project already knows the correct risk policy. It delays concrete warning behavior until the owner decides exact rules.
8. **Future extensibility impact**: A replaceable boundary can later support user-configured warnings, bankroll charts, drawdown alerts, cooling-off rules, or stricter enforcement if the owner approves them.
9. **What happens if owner chooses recommended option**: A future ADR can define the approved risk-warning scope and decide whether warnings are informational, blocking, configurable, or disabled.
10. **What remains changeable later**: Threshold values, warning copy, hard-block policy, user configuration, bankroll update rules, drawdown logic, and stake helper support remain changeable.
11. **Exact question for owner**: Do you approve planning a replaceable, non-blocking bankroll/risk warning boundary while deferring all thresholds, formulas, and enforcement rules?
12. **Owner response placeholder**:
   - Approved recommended option:
   - Approved with changes:
   - Rejected:
   - Notes:

---

## Owner Response Instructions

For each decision topic, fill in one of the response lines. If you approve with changes, write the exact changed requirement under "Notes" so the later ADR draft can reflect your decision without guessing.

Owner responses in this pack do not automatically change ADR status. ADR updates must happen in a later explicit owner-approved step.
