# Phase 5: Owner Decision Questions Catalog

This catalog documents open product and business logic questions for the Miraichi owner. Each recommendation is an AI proposal only and requires explicit owner approval before any ADR update or implementation.

---

## 1. Betting Record Structure

### Question: Should the manual bet record support custom, user-defined labels/metadata (tags, notes) in version 1?
* **Why it matters**: Users often track notes about bets (e.g., "followed tipster X", "weather was rainy"). Standardizing metadata fields early helps design search and filter capabilities.
* **AI Recommended Proposal**: Allow a single optional `notes` text field and a simple `tags` array of strings.
* **Alternative Options**:
  * *Option A*: Strict fields only (no custom notes/tags).
  * *Option B*: Multi-field structured metadata (e.g., custom confidence rating 1-5, tipster ID).
* **Impact of Options**: Option A is easiest but limits user utility. Option B adds complexity and UI weight. Recommending a simple notes/tags system provides flexibility.
* **Blocks Implementation?**: No.

---

## 2. Match Grouping

### Question: How should the system handle match groups for matches that are cancelled, postponed, or replayed?
* **Why it matters**: If a match is postponed, bets placed on it may remain pending, get voided by rules, or move to the new date.
* **AI Recommended Proposal**: Link betting groups to a stable match grouping identity. If a match is cancelled or postponed, preserve the group and require owner-approved lifecycle rules before any automatic voiding behavior is implemented.
* **Alternative Options**:
  * *Option A*: Delete the group and all bets if a match is cancelled.
  * *Option B*: Allow manual detach/attach of bets to any other match.
* **Impact of Options**: Option A causes data loss. Option B adds significant UI complexity. The default preserves records while keeping relationships simple.
* **Blocks Implementation?**: No.

---

## 3. Market Catalog

### Question: Which exact markets are required for the v1 MVP release?
* **Why it matters**: Although the catalog is extensible, we need a baseline of built-in markets for validation and quick-select presets.
* **AI Recommended Proposal**: 1X2, Over / Under (Total Goals), Handicap (Spread), and Corners.
* **Alternative Options**:
  * *Option A*: Only 1X2 and Over/Under.
  * *Option B*: Include cards, goalscorers, half-time/full-time, and player props.
* **Impact of Options**: Option A is too narrow for typical journal tracking. Option B introduces high data parsing overhead for stats. Recommending a moderate set balances utility and scope.
* **Blocks Implementation?**: Yes (need baseline agreement to construct the preset registers).

---

## 4. Market Line Input

### Question: Should line validation enforce standard sports increments, or allow arbitrary decimal inputs?
* **Why it matters**: Handicap and Over/Under lines are typically increments of `0.25` (e.g., `2.0`, `2.25`, `2.5`, `2.75`). If users can type `2.34`, settlement logic will fail or require complex math.
* **AI Recommended Proposal**: Allow arbitrary manual text input for compatibility with custom lines, but plan a future warning boundary for values outside owner-approved line conventions.
* **Alternative Options**:
  * *Option A*: Hard restrict input to strict quarter-line increments (`*.0`, `*.25`, `*.5`, `*.75`).
  * *Option B*: Free text without warnings.
* **Impact of Options**: Option A prevents invalid data but might block users tracking exotic markets. Option B allows invalid data to pass silently. Recommending warnings balances flexibility and safety.
* **Blocks Implementation?**: Yes (affects form validator logic).

---

## 5. Live Bet Handling

### Question: What fields should be recorded for a live bet compared to a pre-match bet?
* **Why it matters**: Tracking live bet performance requires knowing the state of the game when the wager was logged (e.g. score, elapsed time).
* **AI Recommended Proposal**: Record a `betTimeType` (`pre_match` | `live`), and if `live`, capture score-at-entry fields at the time of entry.
* **Alternative Options**:
  * *Option A*: Treat pre-match and live bets exactly the same (no score tracking at bet time).
  * *Option B*: Capture detailed match event context (minute, card count, possession).
* **Impact of Options**: Option A loses valuable performance analysis (e.g., live betting ROI). Option B is overly complex for a manual journal. The default captures essential context.
* **Blocks Implementation?**: No.

---

## 6. Odds Format

### Question: How should other odds formats (Decimal, Malay, Indo, American) be translated internally?
* **Why it matters**: To compute profit/loss consistently, all odds formats must convert to a single internal decimal representation (European decimal odds or pure multiplier).
* **AI Recommended Proposal**: Preserve the user's input format and raw text, and plan a separate odds-format boundary for future owner-approved normalization rules.
* **Alternative Options**:
  * *Option A*: Perform direct formulas per format type at calculation time.
  * *Option B*: Store only Decimal odds and discard the original input format type.
* **Impact of Options**: Option A increases bug surface area. Option B degrades user experience if they want to view records in their preferred format. Recommending normalized internal decimals is standard practice.
* **Blocks Implementation?**: Yes (affects record schema and validator contracts).

---

## 7. Stake Unit

### Question: Can stakes be recorded as decimal points, or must they be positive integers?
* **Why it matters**: Points-based staking might use units of `1` point, but fractional sizing (e.g., `0.5` points, `1.5` points) is common for risk adjustment.
* **AI Recommended Proposal**: Support positive decimal stake values with an owner-approved precision limit. Negative stakes remain out of scope unless the owner approves lay-style tracking later.
* **Alternative Options**:
  * *Option A*: Integer-only stakes (e.g., `1`, `2`, `5` points).
  * *Option B*: Negative stakes allowed (representing lay positions).
* **Impact of Options**: Option A limits strategy granularity. Option B is out-of-scope for simple journal tracking. Recommending positive decimals provides correct utility.
* **Blocks Implementation?**: Yes (affects schema validations).

---

## 8. Profit/Loss Calculation

### Question: How should "half-win" and "half-loss" payouts be calculated for quarter-lines?
* **Why it matters**: A handicap of `+0.25` or `-0.25` results in partial payouts (half win, half refund, or half loss, half refund) depending on the margin.
* **AI Recommended Proposal**: Treat half-win and half-loss as explicit settlement states, but defer the exact payout mapping and formulas to a later owner-approved ADR.
* **Alternative Options**:
  * *Option A*: Force binary win/loss states (no half payouts supported).
  * *Option B*: Allow users to override and manually enter the profit/loss points directly.
* **Impact of Options**: Option A can misrepresent split outcomes. Option B is highly flexible but prone to manual entry errors. A structured settlement mapping is likely needed later, but the owner must approve the exact formula before implementation.
* **Blocks Implementation?**: Yes (affects settlement calculations).

---

## 9. Bet Settlement

### Question: Should bets be settled automatically when a match ends, or require manual user settlement?
* **Why it matters**: Auto-settlement requires coupling the betting journal with ingestion feeds and resolving matches. Manual settlement puts control in the user's hands.
* **AI Recommended Proposal**: Provide a manual status selector in v1, with any auto-fill helper deferred until match-score ingestion and settlement rules are separately approved.
* **Alternative Options**:
  * *Option A*: Strict manual-only settlement.
  * *Option B*: Fully automated background settlement script (no manual override).
* **Impact of Options**: Option A is safe but tedious. Option B can cause frustration if the feed is incorrect or delayed. The default hybrid path ensures reliability.
* **Blocks Implementation?**: No.

---

## 10. Reports

### Question: How should reporting dates be aligned (UTC vs. User Local Timezone)?
* **Why it matters**: A bet placed on a Saturday night in one timezone might show up as Sunday in UTC, affecting weekly and monthly aggregations.
* **AI Recommended Proposal**: Aggregate reports using the user's local browser timezone while preserving UTC timestamps for stored event times.
* **Alternative Options**:
  * *Option A*: Perform all reporting calculations strictly in UTC.
  * *Option B*: Let the user choose their reporting timezone in settings.
* **Impact of Options**: Option A is simplest to implement but counter-intuitive to users. Option B is ideal but adds settings complexity. The default browser-timezone translation is standard.
* **Blocks Implementation?**: No.

---

## 11. AI Recommendation

### Question: Should AI recommendations show up as notification cards, or directly inject drafts into the journal?
* **Why it matters**: Users should never have wagers automatically added without consent. Clear separation prevents legal/risk issues.
* **AI Recommended Proposal**: Display recommendations as separate, read-only "Recommendation Cards" that contain an "Add to Journal" action requiring explicit user confirmation.
* **Alternative Options**:
  * *Option A*: Direct injection as draft records in the main log.
  * *Option B*: Purely text-based chat replies without structured UX cards.
* **Impact of Options**: Option A risks user confusion. Option B makes it tedious to copy/paste the bet. Recommending the read-only card wrapper provides a clean, safe separation.
* **Blocks Implementation?**: No.

---

## 12. PWA UI/UX

### Question: Should the mobile UI focus on a calendar-based layout or a list-based dashboard for bet records?
* **Why it matters**: Screen space is limited. List views are easier to build, but calendar views make historical reports easier to navigate.
* **AI Recommended Proposal**: A list-based dashboard grouped chronologically by date headers, with filter controls for status and market.
* **Alternative Options**:
  * *Option A*: Full-screen calendar widget.
  * *Option B*: Infinite scroll feed.
* **Impact of Options**: Option A is complex to make responsive. Option B can degrade performance over thousands of wagers. The default list with grouping is clean and performant.
* **Blocks Implementation?**: No.

---

## 13. Future Database/Storage

### Question: What fallback mechanism should be used if the browser storage (localStorage/IndexedDB) is cleared?
* **Why it matters**: PWAs relying on local browser cache risk losing data if the OS clears local storage to free space.
* **AI Recommended Proposal**: Provide an easy "Export to JSON" and "Import JSON" backup flow in v1 settings if local-first storage is used.
* **Alternative Options**:
  * *Option A*: No recovery mechanism (data is lost).
  * *Option B*: Mandate cloud synchronization (requires database and auth).
* **Impact of Options**: Option A is a poor user experience. Option B is out-of-scope for v1. Recommending JSON import/export is a lightweight and robust safeguard.
* **Blocks Implementation?**: No.

---

## 14. Future Real Prediction Integration

### Question: How do we link a manual bet record back to an AI prediction trace for audit purposes?
* **Why it matters**: When auditing model performance, we must trace whether a user's bet matched the AI's predicted outcome.
* **AI Recommended Proposal**: Include an optional prediction trace reference in the bet record boundary, pending owner approval of the final trace contract.
* **Alternative Options**:
  * *Option A*: No linkage (betting and predictions are separate).
  * *Option B*: Enforce that bets can only be created from AI predictions.
* **Impact of Options**: Option A prevents ROI auditing. Option B prevents users from tracking custom wagers. The default optional link supports both use cases.
* **Blocks Implementation?**: No.

---

## 15. Future Bankroll/Risk Management

### Question: Should we plan bankroll warnings when a user stakes above an owner-defined share of their total bankroll?
* **Why it matters**: Responsible-use principles may require warnings if a stake exceeds owner-approved risk boundaries.
* **AI Recommended Proposal**: Design a replaceable risk-warning boundary that can receive candidate stake and bankroll context later, generating non-blocking UI warnings only after the owner approves the exact rule.
* **Alternative Options**:
  * *Option A*: No risk warnings.
  * *Option B*: Hard block transactions that violate risk rules.
* **Impact of Options**: Option A misses a key product differentiator. Option B frustrates users. The default strategy warning is helpful and non-intrusive.
* **Blocks Implementation?**: No.
