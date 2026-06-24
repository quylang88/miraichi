# ADR-0023: User-Entered Real Bet Record Boundary

* **Status**: Draft
* **Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Users need a consistent structure to manually record and track their betting history. Scattered or loose properties make aggregations, reports, and UI synchronization fragile. We need a standardized container interface for bet data.

## 2. Owner-Approved Business Decisions
* **Structured Envelope**: Use a standard `BetRecordEnvelope` to represent wagers in version 1 (v1).
* **Core Fields**:
  - `betId`: Stable, unique identifier string.
  - `matchGroupId`: Reference string linking to a match grouping.
  - `createdAt`: Immutable ISO timestamp when the record is created.
  - `betTimeType`: String classifying timing (e.g. `pre_match` or `live`).
  - `homeTeamName`: String (user text input).
  - `awayTeamName`: String (user text input).
  - `marketType`: String representing the market category.
  - `selectionLabel`: String representing the chosen outcome selection.
  - `oddsFormat`: Default display format (HK for v1).
  - `oddsValue`: Numeric value entered by the user.
  - `stakePoints`: Point value allocated by the user.
  - `status`: Segmented state string (e.g., `pending`, `settled`).
* **Optional Fields**:
  - `matchId`: Association ID if linked to an ingested feed match.
  - `competitionLabel`: Optional league name string.
  - `seasonLabel`: Optional season string.
  - `marketSubtype`: Secondary market subcategory.
  - `lineValue`: Numeric value of the line.
  - `lineDisplay`: Display label of the line.
  - `liveScoreHome`: Numeric home score at bet time.
  - `liveScoreAway`: Numeric away score at bet time.
  - `liveMinute`: Numeric minute of the match when bet was placed.
  - `settlement`: Detailed resolution state.
  - `profitLossPoints`: Signed point value calculated after settlement (nullable while pending).
  - `notes`: Personal text.
  - `tags`: Array of category tag strings.
  - `source`: Tracking source (`manual`, `ai_recommendation`).
  - `trace`: Metadata tracing object.
  - `predictionTraceId`: Reference linking the bet to an AI prediction run.
  - `recommendationId`: Reference linking the bet to an AI recommendation card.
* **Metadata Restrictions**: Notes and tags are for display metadata only. Under no circumstances may they drive prediction, bankroll, risk, settlement, or AI recommendation logic in v1.
* **Profit/Loss Points**: Must be signed and nullable while the status is pending.

## 3. AI Technical Recommendations
* **Object Boundary**: Treat the `BetRecordEnvelope` as a plain JSON object contract.
* **Decoupled Validation**: Maintain data validation libraries entirely separate from storage files and UI page controls.
* **No Database Mapping**: Do not convert this object contract into Sequelize attributes, Mongoose schemas, or SQL table columns in Wave A.
* **Immutability**: Enforce immutable `createdAt` timestamps and stable UUIDs at the client creation hook.

## 4. Deferred Business Decisions
* The final validation strictness (e.g., maximum string lengths, special character restrictions).
* The mathematical formulas used to compute net profit/loss.
* The persistence backend selection (IndexedDB, local storage, SQLite).
* The behavior of recommendation trace linkages when predictions are re-run.

## 5. Future Extension Points
* Native backup export and import formats.
* Advanced text search and filter categories.
* Audits matching user bets to AI predictions.

## 6. Explicit Implementation Exclusions
* No database tables, schemas, or migrations.
* No ORM models or database client integrations.
* No mathematical profit/loss or ROI equations.
* No AI prediction algorithms or risk checking code.
* No executable code implementation.

## 7. Open Questions for Owner Review
1. **Should the `source` field allow an `imported` value in addition to `manual` and `ai_recommendation`?**
   - *Why it matters*: Users importing spreadsheets of historical wagers will have records originating outside the app.
   - *Recommended default*: Yes, allow `"imported"` as a valid source.
2. **Should tags be free-text only or selected from pre-saved user tags?**
   - *Why it matters*: Free text is simpler to build but leads to duplicate tags (e.g. `"live"`, `"Live"`).
   - *Recommended default*: Free-text tags in v1, with autocomplete helper suggestions based on existing records.
3. **Should `liveMinute` be optional or required for live wagers?**
   - *Why it matters*: Enforcing it ensures better live stats, but might make entry tedious.
   - *Recommended default*: Keep it optional in v1.
