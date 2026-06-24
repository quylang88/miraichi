# Phase 5 Overview: Business Logic Discovery and Extensible Betting Journal Design

## 1. Purpose
The purpose of Phase 5 is to establish the architectural boundaries, candidate data contracts, and extensible extension points for the manual betting journal, bankroll tracking, reporting, and AI recommendation features of the Miraichi application.

This phase is strictly a **discovery and design phase**. Under no circumstances may AI development agents unilaterally decide, configure, or hardcode final business logic calculations or database structures. The goal is to collect requirements, generate open questions, suggest architectural boundaries, and obtain owner approvals via candidate ADRs before any executable logic is implemented.

## 2. Owner-Provided Requirements
The project owner has specified the following initial parameters for the betting journal:
1. **Manual Bet Logging**: The application must allow users to manually log bets they have placed or want to track.
2. **No Bookmaker Placement**: In version 1 (v1), the application will not place any bets with bookmakers.
3. **Match-Centric History Grouping**: Storing and listing betting histories must be organized by match. Multiple bets on the same match should be grouped under the same match.
4. **Manual Participant Entry**: Home and away participant labels must support manual text input.
5. **Flexible Market Support**: Support common football betting markets such as 1X2, Over / Under, Handicap, Corners, and allow adding more markets later.
6. **Manual & Preset Line Entry**: Users can manually enter market lines (e.g., 2.5, 2.25, 1.75, 3.0), and common presets should be easily selectable.
7. **Live Betting Support**: The system must support recording if a bet is placed live, along with the current score at the time the bet was made.
8. **Odds Formats**: Default format is Hong Kong (HK) odds. Switching to other formats (e.g., Decimal, Malay, Indonesian, American) must be supported later.
9. **Points-Based Staking**: In v1, stakes and profit/loss calculations must be represented as points, not real currencies.
10. **Time-Based Reporting**: Reports must support daily, weekly, and monthly summaries.
11. **AI Recommendations**: Design a future read-only recommendation card boundary. AI must not auto-create bet records, suggest stake in v1, rank bets, or claim real confidence until the prediction algorithm is approved.
12. **Local-First Backup**: Add a local-first persistence and backup boundary with required Export/Import JSON planning and deferred cloud/account/production database decisions.

## 3. What is Fixed (Owner-Approved Decisions)
- All user wagers must be represented in point values (points) for stakes and profit/loss in v1.
- No direct integrations with sports betting operators or bookmaker bet placement endpoints in v1.
- All matches, participant labels, and competition labels must be treated as configurable data. The architecture must remain competition-agnostic.
- Downstream AI recommendation cards must support no-bet/refusal state and must not invent picks when `predictionAvailable` is false.

## 4. What Remains Open (Requires Owner ADR Selection)
- The exact algorithms and formulas for converting between HK odds and other systems.
- The mathematical logic for calculating half-win, half-loss, and push states on quarter-line handicaps and over/unders.
- The aggregation implementation for reporting.
- The bankroll rules and risk-limit thresholds.
- The production storage solution for long-term betting history.

## 5. What Must Be Extensible
- **Market Types**: The market parser and catalog must follow a registry pattern so developers can add new markets (e.g., player props, cards, team totals) without changing core record logic.
- **Odds Formats**: HK is visible in the first implementation. Other formats and conversion formulas are deferred behind an adapter boundary.
- **Settlement Logic**: Settlement strategies must support manual-first status updates. Auto-settlement and formulas are deferred.
- **AI Recommendation Formats**: Read-only cards are the planned boundary. Auto-save, auto-bet, ranking, real confidence claims, stake suggestions, and bankroll-based recommendations are not approved in v1.
- **Local-First Persistence**: Export/Import JSON backup is required for planning. IndexedDB is preferred for future implementation planning. `localStorage` is limited to tiny mock/demo state.

## 6. What Must NOT Be Implemented (Strict Exclusions)
- Do not implement any mathematical formulas for profit/loss or ROI.
- Do not implement odds format conversions.
- Do not implement Kelly Criterion or stake-sizing recommendation logic.
- Do not implement production database tables, migrations, or ORM models.
- Do not make any calls to bookmakers or sports data feeds for settlement.
- Do not implement AI betting recommendation logic.
- Do not implement cloud sync, auth, account system, or production persistence.
- Do not hardcode specific teams, leagues, real tournaments, or tournament schedules.
