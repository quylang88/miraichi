# Web Page Map

Sitemap and view boundaries for the Miraichi web client.

## Purpose
Keep the first scaffold aligned with the owner-approved Phase 5 mobile-first PWA betting journal UX.

## Status
- **Status**: Active
- **Source of truth**: `docs/decisions/ADR-0031-pwa-betting-journal-ux-boundary.md`. Earlier wording that listed `Add`, `Reports`, or `AI` as primary navigation is superseded.

## Scope
Defines v1 navigation, page responsibilities, and explicitly deferred surfaces for `apps/web`. This document does not authorize UI implementation by itself.

## V1 Navigation
The v1 navigation order and labels are fixed:

1. `Today`
2. `Matches`
3. `Bets`
4. `Bankroll`
5. `Miraichi`

`Add Bet` is the primary action, not a navigation tab. `Reports` and `AI` are not primary navigation labels.

## Page Structure
- `/` - Default entry. In v1, route users to the `Today` experience, not to a marketing landing page.
- `/today` - Read-first daily dashboard grouped by date. It shows points, match, and market snapshots with filter pills for `Pending`, `Settled`, `Live`, and `Market`; it must not expose direct Add Bet entry.
- `/matches` - Match-centric history and review surface. It groups bets by `matchGroupId`, supports expandable match groups, opens match detail sub-views, and must not rely on feed `matchId` as the only grouping key.
- `/match/:matchGroupId` - Conceptual sub-view, not a primary navigation destination. It shows selected match context, local `Bets` and `Info` sections, and the scoped Add Bet action.
- `/bets` - Bet journal surface for ongoing, draft, settled, and editable wager records. `Add Bet` remains fast from this surface, but it must open a match selection/detail path before the bet form.
- `/bankroll` - Bankroll and reporting surface. It may include daily, weekly, and monthly report views using owner-approved candidate report fields only, but must not introduce formulas or risk thresholds without later owner approval.
- `/miraichi` - Miraichi assistant and AI recommendation surface. Recommendation cards are read-only unless the user manually chooses an add-to-journal flow.

## Today Dashboard Requirements
- The dashboard is list-first, not calendar-first.
- The primary grouping is by date in the browser local timezone.
- Each date section contains match groups.
- Match groups are expandable and collapse to a compact match summary.
- Expanded match groups show individual bet cards or rows for that match.
- Opening a match group can show a match detail sub-view where Add Bet is scoped to that `matchGroupId`.
- Filter pills are visible or quickly reachable on the dashboard: `Pending`, `Settled`, `Live`, and `Market`.
- Empty states on `Today` should point users toward match review, not direct Add Bet or prediction browsing.

## Deferred Surfaces
- Calendar-first UI is deferred and must not be the v1 information architecture.
- Native app wrappers are deferred; keep this as a PWA-first web client.
- Advanced bankroll dashboards, advanced charts, ROI/yield/CLV views, and calendar analytics are deferred until later owner approval.
- Public marketing pages are not a v1 requirement for the app scaffold.

## TODO / Next Steps
- [ ] Map these page boundaries to the selected framework's route files after framework selection.
- [ ] Keep this file synchronized with the Phase 5 ADR status if ADR-0031 is promoted or revised.
