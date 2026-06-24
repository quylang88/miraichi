# PWA Betting Journal UX Discovery

This document maps out the mobile-first presentational layouts and user flows for the betting journal and reporting screens. These mockups and flows guide the frontend implementation in `apps/web` for future phases.

---

## 1. Add Bet Flow
* **User Goal**: Quickly enter and log a new manual wager.
* **Required Fields**: Home Team, Away Team, Market Type, Odds Value, Stake Points, Bet Time Type.
* **Optional Fields**: Competition Label, Season Label, Line Value, Selection Label, Notes, Tags.
* **Validation Questions**:
  * *Q*: How do we handle empty fields?
  * *A*: Highlight inputs in red and disable the "Save Bet" button until required values are provided.
* **Recommended v1 UX**: A clean, single-page form with vertical input groups. Presets for markets are displayed as clickable pills.
* **Future Extension**: Autocomplete team and competition names using previously saved entries.

---

## 2. Match Betting Group Detail
* **User Goal**: View all wagers placed on a single match in one dashboard.
* **Required Fields**: Match Group ID.
* **Optional Fields**: Overall group net profit/loss, status.
* **Validation Questions**:
  * *Q*: How do we display groups with no active bets?
  * *A*: Remove the empty group or redirect to the main journal feed.
* **Recommended v1 UX**: An accordion-style dropdown or sub-view. The header shows the match teams (e.g. "Alpha vs Beta") and the total net points. Clicking opens a list of individual bet cards.
* **Future Extension**: Add a timeline graph showing live match status changes alongside bet times.

---

## 3. Live Bet Entry Flow
* **User Goal**: Log a bet made while a match is in progress, capturing game state.
* **Required Fields**: Home Score at Bet Time, Away Score at Bet Time.
* **Optional Fields**: Current match minute.
* **Validation Questions**:
  * *Q*: Can scores at bet time be negative or blank?
  * *A*: Default to `0-0` if empty, and enforce non-negative integers.
* **Recommended v1 UX**: Toggling "Bet Type" to "Live" reveals two numeric fields for Home/Away score.
* **Future Extension**: Pull current live score automatically from the worker feed.

---

## 4. Market & Line Picker
* **User Goal**: Select the betting category and specify the line value.
* **Required Fields**: Market Type.
* **Optional Fields**: Line Preset, Custom Line.
* **Validation Questions**:
  * *Q*: What if a market type doesn't use lines (e.g., 1X2)?
  * *A*: Hide the Line Picker input entirely when 1X2 is active.
* **Recommended v1 UX**: Dynamic field toggle. When "Over / Under" is selected, a horizontal scroll menu of presets (`1.5`, `2.5`, etc.) appears next to a custom decimal text field.
* **Future Extension**: Allow users to configure their own favorite presets.

---

## 5. Odds Input & Format Picker
* **User Goal**: Input the odds in the user's preferred format.
* **Required Fields**: Odds Format, Raw Odds Value.
* **Optional Fields**: Equivalent normalized decimal value.
* **Validation Questions**:
  * *Q*: How do we prevent negative odd values in formats that do not support them?
  * *A*: Enforce validation check rules immediately on input focus loss.
* **Recommended v1 UX**: A simple dropdown to toggle between format labels next to a numeric text field. The default is HK.
* **Future Extension**: Auto-calculate and display equivalent values in other formats in small grey text under the input field.

---

## 6. Stake Points Input
* **User Goal**: Enter the points allocated to the wager.
* **Required Fields**: Stake Points.
* **Optional Fields**: None.
* **Validation Questions**:
  * *Q*: What if the user enters a stake greater than their current mock bankroll?
  * *A*: Display a warning toast but do not lock the transaction.
* **Recommended v1 UX**: Large numeric keyboard-triggering input field with rapid preset buttons (`+10`, `+50`, `+100` points).
* **Future Extension**: Integrate Kelly Criterion percentage helper buttons.

---

## 7. Bet Status / Settlement Flow
* **User Goal**: Update a bet's resolution state to calculate profit/loss.
* **Required Fields**: Settlement Status.
* **Optional Fields**: Final match score (for record keeping).
* **Validation Questions**:
  * *Q*: Can settled bets be modified?
  * *A*: Yes, allow changing settlement status back to pending or edit values.
* **Recommended v1 UX**: Edit dialog with a segmented button selector: `Pending`, `Won`, `Lost`, `Push`, `Void`, `Half Win`, `Half Loss`. Changing the selection computes and previews the resulting points impact.
* **Future Extension**: Automated score-based auto-fill helper.

---

## 8. Daily, Weekly, and Monthly Report Views
* **User Goal**: Review betting performance over selected calendar periods.
* **Required Fields**: Period selection.
* **Optional Fields**: Market filters, win-rate charts.
* **Validation Questions**:
  * *Q*: How do we handle periods with zero wagers?
  * *A*: Render an empty state graphic rather than a blank or broken screen.
* **Recommended v1 UX**: A dashboard tab with three sub-navigation views. Displays card tiles for total points profit/loss, win rate, and total bets.
* **Future Extension**: Visual charts (bar charts, line graphs) showing cumulative bankroll curves.

---

## 9. AI Recommendation Card Flow
* **User Goal**: View AI suggestions and understand why they are recommended.
* **Required Fields**: Prediction trace reference.
* **Optional Fields**: Statistical explanation snippet.
* **Validation Questions**:
  * *Q*: How does the user dismiss a card?
  * *A*: Provide a "Dismiss" icon that hides the card from the feed.
* **Recommended v1 UX**: A sliding card element showing the predicted value, odds, and a yellow warning tag designating it as a mock suggestion.
* **Future Extension**: A dedicated "AI Feed" page sorting candidates by expected value.

---

## 10. Convert AI Recommendation to Bet Flow
* **User Goal**: Easily track an AI-suggested bet in the journal.
* **Required Fields**: Copy action.
* **Optional Fields**: Stake overrides.
* **Validation Questions**:
  * *Q*: What happens to the recommendation card after conversion?
  * *A*: Mark the card as "Tracked" and disable the action button.
* **Recommended v1 UX**: Clicking "Track this Bet" on the AI card opens the "Add Bet Form" pre-filled with all match and market parameters. The user inputs their stake and saves.
* **Future Extension**: Link the saved bet ID to the recommendation card trace for audit stats.

---

## 11. Empty and Error States
* **Empty State**: Displays when the user has logged no wagers. Shows a card with: "No bets tracked yet. Add your first bet to get started!" and a floating plus button.
* **Error State**: Displays if local storage is corrupted. Shows: "Could not load betting history. Please try importing your backup JSON."

---

## 12. Mobile-First Considerations
* **Touch Targets**: All buttons, pills, and dropdowns are at least `48px` high to satisfy mobile tap guidelines.
* **Safe Areas**: Safe area padding is applied using CSS rules:
  ```css
  padding-bottom: env(safe-area-inset-bottom, 16px);
  ```
* **Swipe Gestures**: Match lists support swipe-to-edit and swipe-to-delete actions.
