# Normalized Match Contract

* **Status**: Draft
* **Date**: 2026-06-23

---

## 1. Purpose
Defines the logical schema contract representing a single football match fixture.

## 2. Scope
Applies to normalized fixtures stored in transient memory buffers and served by `apps/api` to frontend widgets.

## 3. Object Shape
Contains match identifier metadata, competing team references, current event status, schedules, and scores.

## 4. Required Fields
* `id`: Unique string identifier (e.g. `match-alpha-001`).
* `competitionId`: Generic tournament ID (e.g. `competition-alpha`).
* `seasonId`: Generic season ID (e.g. `season-alpha-2026`).
* `homeTeamId`: Generic home team ID (e.g. `team-alpha`).
* `awayTeamId`: Generic away team ID (e.g. `team-beta`).
* `status`: Current stage of the match (e.g. `scheduled`, `in_play`, `completed`).
* `kickoffTime`: ISO-8601 UTC timestamp.

## 5. Optional Fields
* `scores`: Object hosting home and away scores (required once status is `completed`).
  * `homeScore`: Non-negative integer.
  * `awayScore`: Non-negative integer.
* `venueName`: Stadium or city description (e.g. `Stadium Alpha`).

## 6. Example Mock Payload
```json
{
  "id": "match-alpha-001",
  "competitionId": "competition-alpha",
  "seasonId": "season-alpha-2026",
  "homeTeamId": "team-alpha",
  "awayTeamId": "team-beta",
  "status": "completed",
  "kickoffTime": "2026-06-23T20:00:00Z",
  "scores": {
    "homeScore": 2,
    "awayScore": 1
  },
  "venueName": "Stadium Alpha"
}
```

## 7. Validation Notes
* If status is `completed`, `scores` object must not be null.
* Score values must be non-negative integers (`>= 0`).
* Home and away team IDs must not be identical.

## 8. What It Must Not Decide Yet
* Production DB table mapping, column type sizes, indices, or constraints.
* TypeScript compiler files.
