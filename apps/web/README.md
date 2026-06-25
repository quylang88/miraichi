# Web App (Frontend Client)

User interface and web experience for Miraichi.

## Purpose
Provides the mobile-first PWA betting journal experience for manual bet entry, daily review, match-grouped history, reports, and safe AI recommendation presentation.

## Status
- **Status**: Draft
- **Current UX direction**: `docs/decisions/ADR-0031-pwa-betting-journal-ux-boundary.md`; earlier wording that listed `Add`, `Reports`, or `AI` as primary navigation is superseded.

## Scope
Targets client-side features, styling system integration, page layout structure, and state management. This README summarizes the intended web scaffold direction only; it does not authorize betting formulas, storage drivers, prediction algorithms, or UI implementation by itself.

## V1 Product Shape
- Navigation: `Today`, `Matches`, `Bets`, `Bankroll`, `Miraichi`.
- Default experience: `Today`, a list-based dashboard grouped by date.
- Match history: expandable match groups under date sections.
- Filters: pills for `Pending`, `Settled`, `Live`, and `Market`.
- Primary action: `Add Bet` as the fastest manual entry path, not a navigation tab.
- Theme: dark mode by default.

## Deferred
- Calendar-first UI is not part of v1.
- Native app wrappers are deferred; the client remains PWA-first.
- Bankroll formulas, risk thresholds, ROI/yield/CLV, advanced charts, and AI recommendation ranking/confidence are deferred until later owner-approved decisions.

## Guidelines
- Follow the architectural guidelines in `apps/web/docs/frontend-architecture.md`.
- Follow the page boundaries in `apps/web/docs/page-map.md`.
- Follow the v1 interaction and layout rules in `apps/web/docs/ui-guidelines.md`.
- Ensure strict responsiveness across standard mobile, tablet, and desktop screen widths.

## TODO / Next Steps
- [ ] Initialize Next.js / Vite framework setup after framework selection.
- [ ] Connect shared design tokens from `packages/ui`.
- [ ] Scaffold only the approved v1 navigation and deferred boundaries described above.
