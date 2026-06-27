# Web UI Guidelines

Layout standards and responsiveness rules for the frontend client.

## Purpose
Prevent the first web scaffold from drifting away from the owner-approved Phase 5 UX direction.

## Status
- **Status**: Active
- **Source of truth**: `docs/decisions/ADR-0031-pwa-betting-journal-ux-boundary.md`. Earlier wording that listed `Add`, `Reports`, or `AI` as primary navigation is superseded.

## Scope
Client UI layout, spacing, accessibility, responsiveness, and v1 interaction rules. This is specification only; it does not implement UI.

## V1 UX Direction
- Build mobile-first PWA screens.
- Use dark mode as the default theme.
- Use the fixed v1 navigation labels: `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`.
- Make `Add Bet` the primary action for manual wager entry.
- Use a list-based dashboard grouped by date.
- Use expandable match groups inside date sections.
- Use filter pills for `Pending`, `Settled`, `Live`, and `Market`.

## Navigation Rules
- On mobile, navigation should behave like a persistent app navigation surface with the five v1 destinations.
- `Add Bet` is a primary action, not a navigation destination.
- The `Today` view is the default read-first daily snapshot surface for points, matches, and market context.
- Match detail is a sub-view under `Today`, `Matches`, or `Bets`, not a sixth primary tab.
- Do not introduce calendar-first navigation in v1.
- Do not introduce native wrapper assumptions, native-only gestures, or app-store packaging requirements in the web UI spec.

## Dashboard Layout Rules
- The dashboard starts with today's date section when relevant data exists.
- Date sections can include previous or upcoming dates, but the visual model remains a chronological list.
- Match groups must have a collapsed summary state and an expanded detail state.
- Collapsed match groups should expose enough context to identify the match and status without showing every bet.
- Expanded match groups show the related bet records for that match group.
- Filtering must narrow the list without changing the primary date and match-group hierarchy.

## Add Bet Rules
- `Add Bet` must remain fast, but it should not be exposed directly from the `Today` snapshot surface.
- The Add flow is manual-first. AI must not auto-create bet records.
- The primary save/submit action must remain disabled until required fields are valid.
- Market presets may use pills, but manual entry must remain available where the Phase 5 boundary requires it.
- Add Bet forms must be scoped to a selected match group before entry. Do not use a large global match dropdown inside the Add Bet form.
- Top-level `Bets` can expose a fast add action, but that action must open a match chooser/detail path before showing the Add Bet form.
- Ongoing and draft records may expose edit controls. Settled records should be review-only unless a later owner-approved correction/reopen flow exists.

## Visual and Accessibility Rules
- Style using Vanilla CSS; reference `packages/ui` design tokens when available.
- Follow WCAG 2.1 AA accessibility guidelines for contrast, keyboard navigation, labels, focus order, and touch targets.
- Default dark mode must not reduce readability. Text contrast, disabled states, borders, and focus rings need explicit dark-theme treatment.
- Buttons, pills, and expandable group headers should meet mobile touch target expectations.
- Keep dense journal data scannable; avoid marketing-style hero layouts for the app shell.

## Deferred UX
- Calendar-first UI is deferred.
- Native app wrapper work is deferred.
- Advanced reports, bankroll curves, ROI/yield/CLV charts, and risk-threshold UI are deferred until later owner approval.

## TODO / Next Steps
- [ ] Align precise colors, spacing, and type scale with `packages/ui/docs/design-system.md` when that design system is finalized.
- [ ] Convert these rules into component acceptance criteria during web scaffold planning.
