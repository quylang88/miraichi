# ADR-0024: Match-Centric Betting History Grouping

* **Status**: Accepted
* **Date**: 2026-06-24
* **Accepted Date**: 2026-06-24
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved
* **Implementation Status**: Not started

---

## 1. Context
Users place multiple wagers on the same match (e.g., placing a pre-match handicap bet and then a live corner bet). Presenting these wagers in a flat list causes disjointed journals and makes match-level evaluation impossible.

## 2. Owner-Approved Business Decisions
* **Grouping Boundary**: Use a `MatchBettingGroup` object to collect and coordinate wagers placed on the same match.
* **Source of Truth**: The `matchGroupId` is the primary identifier for grouping.
* **Feed Linking**: The `matchId` reference to an ingested feed is optional.
* **Manual Grouping Fallback**: A manual entry flow is mandatory. Users must be able to group wagers together by selecting an existing manual match group or creating a new one.
* **Team-Name Autocomplete Only**: Normalization of team names (e.g., converting to lowercase, stripping punctuation) may only be used to generate suggestions or autocomplete helper dropdowns in UI forms. It must **not** serve as the automated final grouping logic (which could lead to false-positive merges).
* **Core Group Fields**:
  - `matchGroupId`: Unique identifier string.
  - `homeTeamName`: String.
  - `awayTeamName`: String.
  - `bets`: Array of associated `betId` strings.
* **Optional Group Fields**:
  - `kickoffTime`: ISO string representing match start.
  - `competitionLabel`: String designating the league.
  - `seasonLabel`: String representing the season.
  - `groupStatus`: String representing resolution (`active`, `settled`).
* **Multi-Bet Display**: All wagers placed on the same match must appear grouped under the same parent match card in the user's dashboard view.

## 3. AI Technical Recommendations
* **Selection UI**: When adding a bet, provide the user with a searchable selector list of recent active matches/groups, with a fallback option "Create New Match Group".
* **Duplicate Warnings**: If a user creates a new match group containing team names identical to an existing group, display a warning indicator in the UI but do **not** trigger automated merging.
* **Feed Abstraction**: Keep feed-based match linking entirely decoupled from the manual group entity. The association is a simple nullable string field `matchId`, allowing feed parser replacements.

## 4. Deferred Business Decisions
* The detailed merge rules if a user decides to join two match groups.
* The handling of bets on matches that are postponed, cancelled, or replayed.
* The automated matching heuristics to link manual groups to live feed matches.

## 5. Future Extension Points
* Feed-assisted selection where users pick from a list of live matches.
* Match-level performance reports (e.g., yield per match).
* Live timeline views mapping bets to key goals/events.

## 6. Explicit Implementation Exclusions
* No database foreign key constraints.
* No automated matching heuristics or grouping algorithms.
* No direct dependencies on data ingestion feeds for grouping.
* No executable code implementation.

## Acceptance Notes

This ADR is accepted as an architecture and planning boundary.

This ADR accepts the `MatchBettingGroup` boundary only. It does not authorize implementation by itself, and it does not authorize automatic grouping, auto-merge behavior, feed matching logic, database constraints, storage implementation, integrations, formulas, or algorithms.

Implementation requires a later owner-approved implementation plan. Business logic, formulas, algorithms, storage implementation, and integrations remain blocked unless explicitly approved by later ADRs or implementation plans.
