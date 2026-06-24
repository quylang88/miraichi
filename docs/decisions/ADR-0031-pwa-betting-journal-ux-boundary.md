# ADR-0031: PWA Betting Journal UX Boundary

* **Status**: Draft
* **Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Users require a highly responsive interface on mobile devices to research matches, execute wagers, check risk metrics, and interact with the AI assistant. 

Miraichi is an AI football prediction and bankroll management app. While initial implementations may focus on a single tournament (e.g. World Cup), the core UX architecture and navigation must remain tournament-agnostic and fully expandable to other leagues, strategy profiles, and markets. We must avoid feature-based or event-specific layout clutter, establishing a long-term bottom navigation backbone based on stable business domains.

## 2. Owner-Approved Business Decisions
* **Mobile-First PWA UX**: The interface must prioritize mobile screen sizes and follow Progressive Web App design guidelines.
* **Stable Domain Navigation**: The main bottom navigation bar will expose exactly five stable, business-domain-based tabs:
  - `Today`: The daily command center. Shows today’s key matches, recommended actions, pending bets, bankroll/risk alerts, upcoming kickoffs, and high-priority AI insights.
  - `Matches`: The match research area. Contains match schedules, filters by competition/date/team, match detail screens, team data, odds, AI predictions, confidence labels, explanations, and future football intelligence features.
  - `Bets`: The bet execution and tracking area. Contains AI-recommended picks, user-selected wagers, manual bet entry forms, bet status states (pending, settled), custom bet notes, and link associations back to match detail.
  - `Bankroll`: The capital, risk, and performance area. Contains current bankroll balance, staking units, net P&L, ROI metrics, maximum drawdown data, risk exposure, stop-loss rules, strategy performance tables, and financial transaction history.
  - `Miraichi`: The AI coach and chat area. Contains natural language LLM chat, conversational analysis, explanations, strategy review sessions, bankroll review, and contextual questions about matches, bets, and performance.
* **Cross-Cutting AI Integration**: AI prediction and coaching are cross-cutting capabilities. AI predictions and confidence values are surfaced contextually across `Today`, `Matches`, `Bets`, `Bankroll`, and `Miraichi`. The `Miraichi` tab is the conversational and chat interface, not a silo where all AI features are isolated.
* **Calendar-First UI Deferral**: A full calendar grid view is out-of-scope for v1.
* **Theme**: The default presentation theme will be a premium dark mode.

## 3. Alternatives Considered & Rejected
We explicitly reject the following weaker navigation structures:
* **Rejected Alternative A**: `Home / AI / Chat / History / Settings`
* **Rejected Alternative B**: `Dashboard / Predictions / Bets / History / Profile`

### Rationale for Rejection:
* **Feature-Based vs. Domain-Based**: The rejected alternatives organize tabs by technical features (Chat, Predictions, Profile) instead of business domains (Matches, Bets, Bankroll).
* **AI & Chat Overlap**: Treating AI and Chat as separate tabs splits the AI experience unnecessarily.
* **Misplaced History**: History is not a top-level tab; betting history belongs inside `Bets`, and financial history belongs inside `Bankroll`.
* **Cluttered Tab Real Estate**: Settings and Profile pages do not represent day-to-day betting tasks and should not consume core slots in the primary bottom navigation.
* **Isolated Predictions**: Predictions should be viewed contextually alongside match details and bets, not isolated in a separate destination page.

## 4. AI Technical Recommendations
* **Centralized Tab Metadata**: Declare and manage bottom navigation routes in a single configuration file in `apps/web/src/config/navigation.ts` to prevent scattered configurations:
  ```typescript
  const MAIN_TABS = [
    { id: 'today', path: '/today', label: 'Today' },
    { id: 'matches', path: '/matches', label: 'Matches' },
    { id: 'bets', path: '/bets', label: 'Bets' },
    { id: 'bankroll', path: '/bankroll', label: 'Bankroll' },
    { id: 'miraichi', path: '/miraichi', label: 'Miraichi' },
  ] as const;
  ```
* **Stable Route IDs**: Keep route/domain IDs (`today`, `matches`, etc.) stable to prevent database/state failures, even if the visible UI labels are renamed.
* **Nested Route Support**: Configure the router to support deep linking and sub-views within the five core tabs:
  - `/matches/:matchId` (Match details, statistics, and predictions)
  - `/bets/:betId` (Wager logs, edit status, and settlement history)
  - `/bankroll` (Main dashboard and transactions log)
  - `/miraichi` (Coach chat window)
* **Thumb-Zone Usability**: Place the primary tab bar at the bottom of the viewport for comfortable one-handed navigation on mobile screens.

## 5. Future Extension & Scalability Points
Future feature expansions must reside within the five-tab navigation backbone:
* **New Tournaments & Leagues**: Added under the `Matches` tab filters.
* **New Prediction Models**: Integrated directly into match detail sub-views, `Today` insights, or `Bets` recommendation cards.
* **New Odds Providers**: Integrated as data providers under `Matches` and `Bets`.
* **New Staking Strategies**: Configured inside the `Bankroll` tab or user preferences.
* **Staking & Risk Warnings**: Surface dynamically as banner alerts inside `Today` and `Bankroll`.
* **System Notifications**: Surface as an overlay panel on the `Today` screen, not as a standalone tab.
* **Settings & Accounts**: Accessible via secondary UI menus (e.g. gear icon in header) outside the bottom navigation.

## 6. Explicit Implementation Exclusions
* No final HTML, CSS, or framework router view code.
* No native Android or iOS wrapper setup configurations.
* No real AI recommendation card integrations.
* No betting calculations or financial formulas.
* No executable code implementation.
