# ADR-0031: PWA Betting Journal UX Boundary

* **Status**: Draft
* **Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context

Users require a highly responsive mobile-first interface to research generic football matches, record and track user-entered wagers, review journal state, and interact with Miraichi assistant surfaces.

Miraichi must remain competition-agnostic. The UX architecture and navigation must support future competitions, strategy profiles, markets, reports, and assistant surfaces without hard-coding real tournaments, real teams, real leagues, or event-specific assumptions.

This ADR defines the PWA UX and navigation boundary only. It does not choose TypeScript, a frontend framework, route implementation files, AI providers, prediction algorithms, betting formulas, or storage implementation.

---

## 2. Owner-Approved Business Decisions

* **Mobile-First PWA UX**: The interface must prioritize mobile screen sizes and follow Progressive Web App design guidelines.
* **Stable Domain Navigation**: The main bottom navigation bar will expose exactly five stable, business-domain-based tabs:
  - `Today`: The daily command center. Shows date-grouped journal activity, relevant match groups, pending user-entered bets, approved warning surfaces, and high-priority user actions.
  - `Matches`: The match research and review area. Contains generic match schedules, filters by competition/date/team, match detail screens, and future match intelligence surfaces after their ADRs are approved.
  - `Bets`: The user-entered wager execution and tracking area. Contains manual bet entry, pending and settled bet records, custom notes, tags, and associations back to match groups.
  - `Bankroll`: The capital, risk, and reporting surface. It may display approved points-based summaries, warning-only risk surfaces, and daily/weekly/monthly report views, but it must not imply that ROI, drawdown, stop-loss, transaction history, or formulas are approved.
  - `Miraichi`: The assistant and coaching surface. It may contain conversational UX, explanations, review sessions, and contextual questions, but real LLM integration, prediction generation, betting recommendation logic, and stake advice require separate owner-approved ADRs.
* **Primary Action**: `Add Bet` is the fastest primary action for manual wager entry. It is not a primary navigation tab.
* **Cross-Cutting AI Surfaces**: AI-related surfaces may appear contextually across the five tabs only where allowed by approved ADRs. This ADR does not activate real predictions, confidence claims, recommendation ranking, stake suggestions, or AI-generated wagers.
* **Calendar-First UI Deferral**: A full calendar grid view is out of scope for v1.
* **Theme**: The default presentation theme is dark mode.
* **Navigation Change Control**: The five primary tabs are the v1 and long-term default backbone. Adding, removing, replacing, or renaming a primary tab requires a future owner-approved ADR.

---

## 3. Alternatives Considered and Rejected

We explicitly reject the following weaker navigation structures:

* **Rejected Alternative A**: `Home / AI / Chat / History / Settings`
* **Rejected Alternative B**: `Dashboard / Predictions / Bets / History / Profile`
* **Rejected Alternative C**: `Today / Add / Matches / Reports / AI`

### Rationale for Rejection

* **Feature-Based vs. Domain-Based**: The rejected alternatives organize tabs by technical features or single actions instead of stable business domains.
* **AI and Chat Overlap**: Treating AI and chat as separate primary tabs splits the assistant experience unnecessarily.
* **Misplaced History**: Betting history belongs inside `Bets`, while financial and reporting history belongs inside `Bankroll`.
* **Primary Action Is Not Navigation**: `Add Bet` must remain fast and prominent, but using `Add` as a primary tab weakens the stable five-domain backbone.
* **Isolated Predictions**: Predictions and explanations, if later approved, should appear contextually alongside matches, bets, reports, or assistant conversations rather than as a separate primary destination.

---

## 4. AI Technical Recommendations

* **Centralized Navigation Metadata**: Declare and manage bottom navigation routes in a centralized navigation configuration module using the project-approved language/runtime.
* **TypeScript Boundary**: If ADR-0034 is accepted later, this module may be implemented in TypeScript. ADR-0031 itself does not decide TypeScript.
* **Stable Route IDs**: Keep route/domain IDs stable (`today`, `matches`, `bets`, `bankroll`, `miraichi`) even if visible labels are later revised through owner-approved ADRs.
* **Nested Route Support**: Support deep linking and sub-views within the five core tabs after framework and router choices are approved.
* **Thumb-Zone Usability**: Place the primary tab bar at the bottom of the viewport for comfortable one-handed navigation on mobile screens.
* **Expandable Match Groups**: The Today and Bets surfaces should support list-based, date-grouped layouts with expandable match groups.
* **Filter Pills**: The primary journal views should support filter pills for `Pending`, `Settled`, `Live`, and `Market`.

These are UX and architecture recommendations only. They do not create files, select a framework, or authorize implementation.

---

## 5. Deferred Business Decisions

The following remain deferred to separate owner-approved ADRs:

* Real AI prediction generation.
* Real confidence claims or confidence percentages.
* AI recommendation logic or recommendation ranking.
* Stake advice or stake suggestions.
* Profit/loss formulas.
* Settlement formulas.
* Odds conversion formulas.
* ROI, yield, CLV, drawdown, or bankroll curve formulas.
* Risk thresholds, hard blocks, stop-loss behavior, or stake-sizing rules.
* Production database, ORM, cloud sync, auth, or account system.
* Real payment, bookmaker, or wagering integrations.

---

## 6. Future Extension and Scalability Points

Future feature expansions must fit within the five-tab navigation backbone unless a later owner-approved ADR changes the backbone:

* New competitions and leagues are added under `Matches` filters and configuration, not as new primary tabs.
* New prediction models, if approved, surface inside match detail, Today insights, Bets cards, or Miraichi explanations.
* New odds providers, if approved, integrate under Matches and Bets surfaces.
* New staking or risk strategy surfaces, if approved, appear under Bankroll and contextual Today alerts.
* Settings and account surfaces should remain secondary UI, not primary bottom navigation tabs, unless a later ADR changes this.

---

## 7. Explicit Implementation Exclusions

This ADR does not authorize:

* No final HTML, CSS, component, or framework router code.
* No route configuration file creation.
* No TypeScript decision or TypeScript implementation.
* No package dependency changes.
* No native Android or iOS wrapper setup.
* No real LLM integration.
* No real AI recommendation card integrations.
* No prediction algorithms.
* No betting calculations or financial formulas.
* No database client, ORM, schema, or migration.
* No executable code implementation.
