# Architectural Decision Record Candidates: Phase 5 Betting Journal and Business Logic

This document compiles the candidate Architectural Decision Records (ADRs) proposed for Phase 5. Under `docs/governance/OWNER-DECISION-GATES.md`, all candidates require explicit owner approval before implementation begins.

The owner responses from `docs/betting/PHASE-5-OWNER-DECISION-SUMMARY.md` have been applied to candidate wording. This file still does not accept ADRs, mark ADRs ready, create final ADR files, or authorize implementation.

Update: Phase 5.2 Wave A foundation ADRs ADR-0023, ADR-0024, ADR-0025, ADR-0026, ADR-0031, ADR-0033, and technical ADR-0034 were owner-approved and accepted on 2026-06-24 as architecture and planning boundaries only. Implementation remains not started and requires a later owner-approved implementation plan.

---

## ADR-0023: User-Entered Real Bet Record Boundary (Accepted)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Users need a structured format to log wagers they have placed or want to track. Loose JSON files make validation, reporting, export/import, and traceability unreliable.

### 2. Owner-Applied Requirement
Use a structured `BetRecordEnvelope` for v1.

Core fields:
- `betId`
- `matchGroupId`
- `createdAt`
- `betTimeType`
- `homeTeamName`
- `awayTeamName`
- `marketType`
- `selectionLabel`
- `oddsFormat`
- `oddsValue`
- `stakePoints`
- `status`

Optional fields:
- `matchId`
- `competitionLabel`
- `seasonLabel`
- `marketSubtype`
- `lineValue`
- `lineDisplay`
- `liveScoreHome`
- `liveScoreAway`
- `liveMinute`
- `settlement`
- `profitLossPoints`
- `notes`
- `tags`
- `source`
- `trace`
- `predictionTraceId`
- `recommendationId`

### 3. Candidate Direction
Define `BetRecordEnvelope` as the documentation-level boundary for manual bet records. `notes` and `tags` are approved for v1 as metadata only. They must not drive prediction, bankroll, risk, settlement, or AI recommendation logic in v1.

`profitLossPoints` must be signed and nullable while the bet is pending.

### 4. Trade-offs
This gives enough structure for filtering, reporting, trace linking, and backup while avoiding production storage implementation. It still requires later implementation planning for validation and UI entry behavior.

### 5. What It Must NOT Decide Yet
- Production database schemas or object mapper packages.
- Final persistence implementation.
- Profit/loss formulas.
- Prediction, bankroll, risk, settlement, or AI recommendation logic driven by metadata.

### 6. What Implementation It May Unlock Later
- Manual betting journal entry planning.
- Export/import planning.
- Trace links to prediction and recommendation records after the relevant ADRs are approved.

---

## ADR-0024: Match-Centric Betting History Grouping (Accepted)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Users frequently place multiple distinct wagers on the same match. Listing wagers as a flat chronological feed without match context makes records difficult to review.

### 2. Owner-Applied Requirement
Use `MatchBettingGroup` as the grouping boundary. `matchGroupId` is the source of truth. `matchId` from feed data is optional. Manual grouping fallback is required.

Optional group fields:
- `kickoffTime`
- `competitionLabel`
- `seasonLabel`
- `groupStatus`

Multiple bets from the same match must appear under the same match group.

### 3. Candidate Direction
Model match grouping through `matchGroupId`, not through normalized team names. Team-name normalization may support suggestions or autocomplete only, and must not become final grouping logic.

### 4. Trade-offs
Using `matchGroupId` avoids accidental merges caused by spelling changes, duplicate names, or manual entry variation. It requires explicit group creation or selection behavior later.

### 5. What It Must NOT Decide Yet
- Database foreign-key constraints.
- Feed matching implementation.
- Automatic regrouping logic.

### 6. What Implementation It May Unlock Later
- Match-level history views.
- Expandable match group UI.
- Feed-assisted suggestions without making feed data mandatory.

---

## ADR-0025: Market Catalog and Line Preset Registry (Accepted)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Adding markets or validating manual line inputs can bloat the journal if market behavior is hardcoded into entry, reporting, or settlement code.

### 2. Owner-Applied Requirement
V1 built-in market baseline:
- 1X2
- Over/Under
- Handicap
- Corners
- Custom Market

Deferred markets:
- Cards
- Team Totals
- First Half
- BTTS
- Player props
- Exact score
- Other detailed market families

### 3. Candidate Direction
`MarketCatalog` and `MarketTypeRegistry` are approved as architecture boundaries. Line presets should be configurable. Manual line entry must always be allowed.

If a line is not a standard 0.25 increment, the UI should show a warning but must not block save.

### 4. Trade-offs
This gives v1 enough useful market coverage while avoiding a wide market surface that would force unapproved settlement complexity. Custom Market preserves manual flexibility.

### 5. What It Must NOT Decide Yet
- Settlement formulas for market types.
- Detailed market-family support beyond the v1 baseline.
- Hard-blocking line validation.

### 6. What Implementation It May Unlock Later
- Market picker planning.
- Configurable preset planning.
- Non-blocking validation warning planning.

---

## ADR-0026: Odds Format Strategy Boundary (Accepted)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Odds formats introduce conversion risk. Incorrect conversion rules can corrupt settlement and reporting results.

### 2. Owner-Applied Requirement
HK odds is the default format for v1.

Store:
- `oddsFormat`
- Raw odds as `rawOddsValue` / `oddsValue`

`normalizedOddsValue` can exist as an optional target/internal field and may remain null until conversion formulas are owner-approved.

Visible odds formats in the first implementation:
- HK only

Deferred:
- Decimal display/conversion
- Malay display/conversion
- Indonesian display/conversion
- American display/conversion

### 3. Candidate Direction
Use an odds-format boundary for future conversion behavior, but do not implement conversion formulas until a later owner-approved ADR explicitly approves them.

### 4. Trade-offs
HK-only visible entry reduces first implementation risk. Preserving a future normalized field keeps the architecture ready for later multi-format support.

### 5. What It Must NOT Decide Yet
- Any conversion formula.
- Any rounding tolerance.
- Any non-HK visible display in the first implementation.

### 6. What Implementation It May Unlock Later
- HK-only odds input planning.
- Optional internal field planning for later conversion.
- Future odds adapter ADR drafting.

---

## ADR-0027: Stake Points and Profit/Loss Boundary (Candidate)

### 1. Problem
Real currency tracking adds compliance, money movement, and security risk. Points-based tracking gives the owner a safer v1 journal boundary.

### 2. Owner-Applied Requirement
V1 uses points only. No real currency.

`stakePoints`:
- Positive number
- Decimal allowed
- Up to 2 decimal places
- Must be greater than 0

`profitLossPoints`:
- Signed number
- Can be positive, zero, or negative
- Nullable while the bet is pending

### 3. Candidate Direction
Use points-only stake and profit/loss fields. Future P/L direction is hybrid: auto-calculate profit/loss only after settlement formulas are owner-approved, and allow manual override/manual adjustment for edge cases.

### 4. Trade-offs
Points keep v1 away from money handling. Manual adjustment gives a practical escape hatch, but formulas remain blocked until explicitly approved.

### 5. What It Must NOT Decide Yet
- ROI formulas.
- Yield formulas.
- Stake-sizing formulas.
- Kelly Criterion.
- Bankroll adjustment formulas.
- Risk formulas.
- Settlement payout formulas.

### 6. What Implementation It May Unlock Later
- Points-only entry validation planning.
- Nullable pending P/L planning.
- Manual adjustment planning after lifecycle boundaries are drafted.

---

## ADR-0028: Bet Lifecycle and Settlement Boundary (Candidate)

### 1. Problem
Settlement status drives reports, history filtering, and future automation hooks. Unclear states would make reporting and later formulas unreliable.

### 2. Owner-Applied Requirement
Use a manual-first settlement lifecycle.

Approved v1 statuses:
- `pending`
- `won`
- `lost`
- `push`
- `void`
- `half_won`
- `half_lost`
- `manual_adjustment`

### 3. Candidate Direction
Auto-settlement from feed data is deferred. Settlement formulas are deferred until explicit owner approval. Users must be able to edit/correct settlement status.

`manual_adjustment` is required for cashout, operator-specific settlement, unusual cases, and manual correction.

### 4. Trade-offs
Manual-first settlement keeps user control and avoids incorrect feed-based automation. It requires careful UX to prevent accidental edits and to explain manual adjustment.

### 5. What It Must NOT Decide Yet
- Settlement formulas.
- Auto-settlement implementation.
- Feed-based settlement rules.
- Formula-based recalculation behavior.

### 6. What Implementation It May Unlock Later
- Manual settlement UI planning.
- Editable/correctable status planning.
- Manual adjustment flow planning.

---

## ADR-0029: Reporting Aggregation Boundary (Candidate)

### 1. Problem
Reports are core to betting history value, but aggregation logic can become tangled with UI rendering, storage choices, and unapproved formulas.

### 2. Owner-Applied Requirement
V1 reports:
- Daily
- Weekly
- Monthly

Grouping:
- Use browser local timezone for report periods.
- Store timestamps in UTC.

Candidate report fields:
- `totalBets`
- `settledBets`
- `pendingBets`
- `winCount`
- `lossCount`
- `pushCount`
- `voidCount`
- `halfWinCount`
- `halfLossCount`
- `totalStakePoints`
- `profitLossPoints`
- `marketBreakdown`
- `liveVsPreMatchBreakdown`

Deferred:
- ROI
- Yield
- CLV
- Bankroll curve
- Advanced charts

### 3. Candidate Direction
Use a separate reporting aggregation boundary. The boundary may plan candidate report output fields, but must not implement formulas, queries, or persistent report views yet.

### 4. Trade-offs
Local report periods match user expectations. UTC timestamps preserve auditability. Advanced metrics remain deferred to avoid implementing unapproved formulas.

### 5. What It Must NOT Decide Yet
- ROI, yield, or CLV formulas.
- Bankroll curve calculations.
- SQL queries or database views.
- Advanced chart implementation.

### 6. What Implementation It May Unlock Later
- Daily/weekly/monthly report UI planning.
- Candidate aggregation contract planning.
- Future chart and metrics ADR drafting.

---

## ADR-0030: AI Betting Recommendation Boundary (Candidate)

### 1. Problem
AI recommendations are risky if they look like automatic betting instructions, write records without consent, claim unsupported confidence, or cannot be audited.

### 2. Owner-Applied Requirement
AI recommendations should appear as read-only recommendation cards.

Rules:
- AI must not auto-create bet records.
- User must manually press Add to Journal.
- AI recommendation must include trace references when available.
- AI must not suggest stake in v1.
- AI must not rank bets or claim real confidence until prediction algorithm is approved.
- AI must support no-bet/refusal state.
- AI must not invent picks when `predictionAvailable` is false.

Allowed future card content after prediction ADR approval:
- Suggested market
- Suggested line
- Suggested selection
- Explanation
- `predictionTraceId`
- `recommendationId`

Not allowed in v1:
- Stake suggestion
- Auto-save
- Auto-bet
- Bankroll-based recommendation

### 3. Candidate Direction
Plan a read-only recommendation card boundary with explicit user confirmation before journal creation. Keep recommendation logic, ranking, confidence claims, and prediction algorithms deferred.

### 4. Trade-offs
This provides a clear future UX without giving AI write authority. It also prevents fake confidence or untraceable picks before prediction rules are approved.

### 5. What It Must NOT Decide Yet
- AI prediction algorithms.
- AI recommendation algorithms.
- Ranking logic.
- Real confidence claims.
- Stake suggestions.
- Bankroll-based recommendations.

### 6. What Implementation It May Unlock Later
- Read-only card UX planning.
- Add-to-journal confirmation flow planning.
- Refusal/no-bet state planning.

---

## ADR-0031: PWA Betting Journal UX Boundary (Accepted)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Manual betting entry is likely mobile-heavy. Poor mobile UX will make entry slow, error-prone, and hard to review.

### 2. Owner-Applied Requirement
Use mobile-first PWA UX.

V1 navigation:
- Today
- Matches
- Bets
- Bankroll
- Miraichi

Main layout:
- List-based dashboard
- Grouped by date
- Match groups expandable
- Filter pills for Pending, Settled, Live, Market
- Add Bet as the fastest primary action, not a primary navigation tab

### 3. Candidate Direction
Do not build calendar-first in v1. Native app wrapper remains deferred. Dark mode is default. Reports live under the Bankroll surface. AI recommendation and assistant surfaces live under Miraichi.

### 4. Trade-offs
The selected layout prioritizes fast daily use and mobile entry. Calendar-first navigation and native wrapper work remain deferred to keep v1 focused.

### 5. What It Must NOT Decide Yet
- Native wrapper implementation.
- Calendar-first UX.
- Final route/component implementation.

### 6. What Implementation It May Unlock Later
- Mobile-first screen planning.
- Navigation planning.
- Dark-mode-first visual planning.

---

## ADR-0032: Bankroll and Risk Strategy Boundary (Candidate)

### 1. Problem
Bankroll and risk rules are business-sensitive. Hardcoded limits, stake-sizing methods, or blocking behavior without owner approval would violate governance.

### 2. Owner-Applied Requirement
Plan `RiskRuleStrategy` as a replaceable boundary.

V1 direction:
- Warning-only
- No hard block
- No default numeric threshold until owner approves
- No Kelly Criterion
- No stake-sizing helper
- No bankroll growth formula
- No max drawdown formula

Users should be able to override warnings.

Future risk warnings can be planned for:
- High stake compared to bankroll
- Daily loss warning
- Weekly loss warning
- Loss streak warning

Exact thresholds are deferred.

### 3. Candidate Direction
Use a replaceable, warning-only risk boundary in planning. Do not define numeric thresholds or formulas.

### 4. Trade-offs
This keeps responsible-use UX possible without pretending the correct risk policy has already been chosen. Warning-only behavior preserves user control.

### 5. What It Must NOT Decide Yet
- Default numeric thresholds.
- Hard blocks.
- Kelly Criterion.
- Stake-sizing helpers.
- Bankroll growth formulas.
- Max drawdown formulas.
- Risk formulas.

### 6. What Implementation It May Unlock Later
- Warning UX planning.
- Override flow planning.
- Future owner-approved threshold ADR drafting.

---

## ADR-0033: Local-First Betting Data Persistence and Backup Boundary (Accepted)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Betting history is user-entered data. If local data is cleared or storage behavior is unclear, users can lose their journal. At the same time, production storage, accounts, and cloud sync are not approved for v1.

### 2. Owner-Applied Requirement
V1 should plan local-first storage.

Required:
- Export/Import JSON backup
- IndexedDB preferred for future implementation planning

Constraints:
- `localStorage` can be used only for tiny mock/demo state, not long-term real betting history.
- Cloud sync is deferred.
- Auth is deferred.
- Production DB is deferred.
- Account system is deferred.
- No database client, object mapper, table definition, or migration may be created yet.

### 3. Candidate Direction
Add a local-first persistence and backup boundary to Phase 5 ADR candidates. The boundary should plan data ownership, backup/export behavior, and future storage implementation choices without creating storage code or schemas.

### 4. Trade-offs
Local-first planning keeps v1 simple and user-controlled. Required JSON backup reduces data-loss risk. Deferring cloud sync and accounts avoids production identity and backend complexity.

### 5. What It Must NOT Decide Yet
- Production database engine.
- Auth provider.
- Account system.
- Cloud sync strategy.
- Database client, object mapper, table definition, or migration.

### 6. What Implementation It May Unlock Later
- Local-first storage planning.
- Export/import UX planning.
- IndexedDB implementation ADR drafting after owner approval.

---

## ADR-0034: TypeScript Adoption and Typed Domain Contracts Boundary (Accepted Technical ADR)

**Acceptance status**: Accepted on 2026-06-24. Implementation status: Not started.

### 1. Problem
Phase 5 introduces increasingly complex cross-app domain boundaries such as `BetRecordEnvelope`, `MatchBettingGroup`, `MarketCatalog`, `OddsFormatAdapter`, `SettlementStrategy`, `ReportAggregator`, `AiRecommendationBoundary`, and `RiskRuleStrategy`.

Keeping these contracts as loose JavaScript objects for too long increases the risk of field drift and app-to-app contract mismatch across `apps/web`, `apps/api`, `apps/worker`, and `packages/shared`.

### 2. Owner-Applied Technical Direction
The owner agrees that Miraichi should adopt TypeScript as a technical architecture direction.

Constraints:
- Existing JavaScript should not be migrated all at once.
- New domain contracts and future implementation work should move TypeScript-first after approval.
- Technical architecture recommendations may be proposed by the AI agent.
- Business logic decisions remain owner-decided.
- TypeScript must not imply any frontend framework, backend framework, database, ORM, prediction model, betting formula, AI provider, or deployment target decision.

### 3. Candidate Direction
Create a dedicated technical ADR for TypeScript adoption and typed domain contracts. Keep TypeScript out of ADR-0031 so the PWA UX ADR stays focused on UX/navigation boundaries.

### 4. Trade-offs
TypeScript-first contracts reduce field drift and contract mismatch without requiring an immediate full-repo migration. A full migration now would be too disruptive, while staying JavaScript-only risks recurring domain-shape errors as the betting journal grows.

### 5. What It Must NOT Decide Yet
- TypeScript version.
- `tsconfig` structure.
- Typecheck/build toolchain.
- Frontend framework.
- Backend framework.
- Database or ORM.
- Runtime model or AI provider.
- Any prediction, betting, settlement, odds conversion, ROI/yield/CLV, stake-sizing, bankroll, or risk formula.

### 6. What Implementation It May Unlock Later
- TypeScript tooling implementation planning.
- Typed shared domain contracts in `packages/shared`.
- Typed config/registry modules after toolchain approval.
- App-by-app migration planning when needed.

This candidate does not authorize implementation, dependency changes, `tsconfig` files, JavaScript-to-TypeScript migration, or build pipeline changes.
