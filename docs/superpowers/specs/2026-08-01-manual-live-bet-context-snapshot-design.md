# Manual Live Bet Context Snapshot Design

## Status

- **Status**: Owner approved; written-spec review pending
- **Date**: 2026-08-01
- **Related lifecycle command**: `phase:plan Website Source Selection And Crawler Boundary`
- **Owner decision**: A+ — external match data is non-live; the owner records the exact live context manually.

## Straight Conclusion

Miraichi does not need a live-score provider to record live bets correctly. It needs an immutable, owner-entered snapshot of the match and market state observed when the bet was placed.

The OpenFootball snapshot identifies the match and supplies periodic fixture/result data. It never edits, backfills, or overrides the historical live context stored with an owner bet.

## Existing Gap

`BetRecordEnvelope` already permits `betTimeType`, `liveScoreHome`, `liveScoreAway`, and `liveMinute`, and the market catalog already includes corners and custom markets. The current draft and cloud persistence contracts do not carry those fields, do not distinguish first-half and second-half markets, and cannot preserve corner counts at placement time.

Encoding live context in `notes` is rejected because it is not typed, validated, filterable, or safe for backup and restore.

## Domain Model

The implementation plan must introduce types equivalent to:

```ts
export type LiveMatchPeriod =
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'extra_time_first_half'
  | 'extra_time_break'
  | 'extra_time_second_half'
  | 'penalty_shootout'
  | 'unknown';

export type BetMarketPeriod =
  | 'full_match'
  | 'first_half'
  | 'second_half'
  | 'extra_time'
  | 'custom';

export interface ScoreAtPlacement {
  home: number;
  away: number;
}

export interface CornersAtPlacement {
  match: ScoreAtPlacement;
  currentPeriod?: ScoreAtPlacement;
}

export interface LiveBetContextSnapshot {
  capturedAt: string;
  period: LiveMatchPeriod;
  minute?: number;
  stoppageMinute?: number;
  matchScore: ScoreAtPlacement;
  corners?: CornersAtPlacement;
}
```

`BetRecordEnvelope`, `AddBetDraft`, and `CloudBetRecord` must share the same live-context type instead of defining parallel shapes.

## Record Invariants

- `betTimeType: 'pre_match'` forbids `liveContext`.
- `betTimeType: 'live'` requires `liveContext`.
- `capturedAt` is the time the owner observed the context; `createdAt` is the record creation time.
- scores and corner counts are non-negative integers.
- `minute`, when present, is an integer from 0 through 130.
- `stoppageMinute`, when present, is a non-negative integer and requires `minute`.
- `marketPeriod` is required for every bet, including pre-match bets.
- a first-half or second-half market is represented by `marketPeriod`, not by parsing free text.
- `selectionLabel`, `lineValue`, `oddsValue`, and `stakePoints` remain owner-entered factual record fields.
- no field calculates a recommendation, probability, expected return, stake size, or risk score.

## Manual Entry Flow

The Add Bet flow is:

1. Select an existing match or create a manual match group.
2. Choose `Pre-match` or `Live`.
3. For live bets, enter period, minute, score, and optional corner counts.
4. Choose market type and market period.
5. Enter selection, line when applicable, HK odds, stake points, and optional notes/tags.
6. Review one immutable summary showing both match context and market context.
7. Confirm and persist the bet.

The form should provide fast H1/H2 controls but must not auto-read a third-party live feed. Corner entry supports both total match corners and current-period corners because an H2 corner line may require the latter.

## Example Records

First-half running goal bet:

```json
{
  "betTimeType": "live",
  "marketType": "over_under",
  "marketPeriod": "first_half",
  "selectionLabel": "Over",
  "lineValue": 0.5,
  "oddsFormat": "HK",
  "oddsValue": -0.88,
  "stakePoints": 100,
  "liveContext": {
    "capturedAt": "2026-08-01T10:34:00Z",
    "period": "first_half",
    "minute": 34,
    "matchScore": { "home": 0, "away": 0 }
  }
}
```

Second-half corner bet:

```json
{
  "betTimeType": "live",
  "marketType": "corners",
  "marketPeriod": "second_half",
  "selectionLabel": "Over",
  "lineValue": 4.5,
  "oddsFormat": "HK",
  "oddsValue": 0.91,
  "stakePoints": 100,
  "liveContext": {
    "capturedAt": "2026-08-01T11:11:00Z",
    "period": "second_half",
    "minute": 71,
    "matchScore": { "home": 1, "away": 0 },
    "corners": {
      "match": { "home": 4, "away": 3 },
      "currentPeriod": { "home": 2, "away": 2 }
    }
  }
}
```

## Immutability And Corrections

Before confirmation, a draft may be edited normally. After creation, `liveContext`, `marketPeriod`, line, odds, selection, and stake are immutable.

If the owner entered the context incorrectly:

1. void the original record with a reason;
2. create a corrected record with `correctionOfBetId` referencing the original;
3. preserve both records in history and backup.

Existing settlement, settlement note, manual result points, notes, and tags remain patchable. A normal PATCH must reject changes to the placement snapshot.

## Persistence Boundary

The later implementation requires an owner-approved schema migration for persisted bet records. The implementation plan must carry the shared shape through:

- add-bet drafts;
- confirmed local/domain records;
- API validation;
- memory and Supabase adapters;
- database storage;
- backup export/import;
- list, detail, review, and history UI.

The preferred persistence shape is a typed JSON object for `liveContext` plus scalar `betTimeType`, `marketPeriod`, and optional `correctionOfBetId`. The migration must be additive and retain all existing bets as valid pre-match or legacy records without inventing live context.

No production migration is authorized by this design alone. Migration execution belongs to its implementation, integration, staging, and owner-approval gates.

## Source Independence

- A live bet may reference an OpenFootball-backed match ID or a manual match group.
- Later fixture/result updates never modify the placement snapshot.
- The app may display the eventual match result beside the historical snapshot, but must label them separately.
- Bet settlement remains manual; an external result does not auto-settle or calculate profit/loss.

## Validation And Testing Boundary

The later TDD plan must prove:

- live drafts require a valid live context;
- pre-match drafts reject live context;
- H1/H2 market period persists through API, cloud storage, and backup;
- score and corner counts reject negative or fractional values;
- review UI shows the exact context before confirmation;
- confirmed placement context cannot be patched;
- void-and-replace corrections preserve both records;
- old records and old backups remain readable;
- no network live-data dependency is introduced.

## Acceptance Criteria

The feature is acceptable only when the owner can record, review, persist, restore, and inspect:

- the match period and minute at placement;
- score at placement;
- total and period corner counts when relevant;
- market family and H1/H2/full-match scope;
- selection, line, HK odds, and stake;
- immutable correction history.
