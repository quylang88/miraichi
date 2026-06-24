# Phase 5 Overview: Business Logic Discovery and Extensible Betting Journal Design

## 1. Purpose
The purpose of Phase 5 is to establish the architectural boundaries, schema structures, and extensible extension points for the manual betting journal, bankroll tracking, reporting, and AI recommendation features of the Miraichi application. 

This phase is strictly a **discovery and design phase**. Under no circumstances may AI development agents unilaterally decide, configure, or hardcode final business logic calculations or database structures. The goal is to collect requirements, generate open questions, suggest architectural boundaries, and obtain owner approvals via candidate ADRs before any executable logic is implemented.

## 2. Owner-Provided Requirements
The project owner has specified the following initial parameters for the betting journal:
1. **Manual Bet Logging**: The application must allow users to manually log bets they have placed or want to track.
2. **No Bookmaker Placement**: In version 1 (v1), the application will not place any bets with bookmakers.
3. **Match-Centric History Grouping**: Storing and listing betting histories must be organized by match. Multiple bets on the same match should be grouped under the same match.
4. **Manual Team Entry**: Home and away team names must support manual text input.
5. **Flexible Market Support**: Support common football betting markets such as 1X2, Over / Under, Handicap, Corners, and allow adding more markets later.
6. **Manual & Preset Line Entry**: Users can manually enter market lines (e.g., 2.5, 2.25, 1.75, 3.0), and common presets should be easily selectable.
7. **Live Betting Support**: The system must support recording if a bet is placed live, along with the current score at the time the bet was made.
8. **Odds Formats**: Default format is Hong Kong (HK) odds. Switching to other formats (e.g., Decimal, Malay, Indonesian, American) must be supported later.
9. **Points-Based Staking**: In v1, stakes and profit/loss calculations must be represented as points, not real currencies.
10. **Time-Based Reporting**: Reports must support daily, weekly, and monthly summaries.
11. **AI Recommendations**: Design a future boundary for AI to suggest bets to the user.

## 3. What is Fixed (Owner-Approved Decisions)
- All user wagers must be represented in point values (points) for stakes and profit/loss in v1.
- No direct integrations with sports betting operators or bookmaker bet placement endpoints in v1.
- All matches, teams, and leagues must be treated as configurable data. The architecture must remain tournament-agnostic.
- Downstream AI recommendations must follow a strict refusal protocol if prediction statistics or confidence values fall below thresholds.

## 4. What Remains Open (Requires Owner ADR Selection)
- The exact algorithms and formulas for converting between HK odds and other systems.
- The mathematical logic for calculating half-win, half-loss, and push states on quarter-line handicaps and over/unders.
- The aggregation queries and storage engines for reporting (SQL views vs. raw memory maps).
- The bankroll rules, risk-limit thresholds, and Kelly Criterion parameters (to be defined in a later phase).
- The storage solution (localStorage, SQLite, PostgreSQL, etc.) for persisting user betting history.

## 5. What Must Be Extensible
- **Market Types**: The market parser and catalog must follow a registry pattern so developers can add new markets (e.g., player props, cards, team totals) without changing core record logic.
- **Odds Formats**: The system must use an adapter pattern to translate different odds formats to a common internal multiplier representation.
- **Settlement Logic**: Settlement strategies must support custom triggers (manual status updates, automated worker score checks).
- **AI recommendation formats**: Allow adding new recommendation structures (cards, chat inserts, notifications).

## 6. What Must NOT Be Implemented (Strict Exclusions)
- Do not implement any mathematical formulas for profit/loss or ROI.
- Do not implement odds format conversions.
- Do not implement Kelly Criterion or stake-sizing recommendation logic.
- Do not implement production database tables, migrations, or ORM models.
- Do not make any calls to bookmakers or sports data feeds for settlement.
- Do not hardcode specific leagues or tournament schedules.
