# Betting Record Boundary Spec

This document details the boundary contracts and candidate fields for the `BetRecordEnvelope`. These fields represent a proposed data structure for logging bets manually and are subject to change.

> [!WARNING]
> This is a candidate definition. No production database tables, schemas, migrations, or active logic should be created based on these fields until an ADR is approved by the owner.

---

## 1. Candidate Fields

The following fields comprise the proposed structure of a manual bet record:

| Field Name | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `betId` | String | Unique identifier generated for the bet. | `"bet_1234567"` |
| `matchGroupId` | String | ID grouping multiple bets on the same match. | `"match_group_888"` |
| `matchId` | String (Optional) | Association ID if linked to an ingested feed match. | `"match_abcde987"` |
| `createdAt` | ISO String | Timestamp when the record was written locally. | `"2026-06-24T12:00:00Z"` |
| `betTimeType` | String | Classification of bet timing: `pre_match` or `live`. | `"live"` |
| `liveScoreAtBetTime`| String (Optional) | The current score at the time the live bet was logged. | `"2-1"` |
| `homeTeamName` | String | Manually entered or feed-provided home team. | `"Team A"` |
| `awayTeamName` | String | Manually entered or feed-provided away team. | `"Team B"` |
| `competitionLabel`| String | Name of the league or tournament. | `"National League"` |
| `seasonLabel` | String | Identification of the season. | `"2025/2026"` |
| `marketType` | String | Primary market category. | `"over_under"` |
| `marketSubtype` | String (Optional) | Secondary market subcategory. | `"corners_over_under"` |
| `lineValue` | Number | Normalized numeric value of the line. | `2.5` |
| `lineDisplay` | String | Display label of the line. | `"O/U 2.5"` |
| `selectionLabel` | String | The chosen outcome selection. | `"over"` |
| `oddsFormat` | String | Selected odds format display type. | `"HK"` |
| `oddsValue` | Number | User-entered raw odds value. | `0.85` |
| `stakePoints` | Number | Points-based stake value. | `10.0` |
| `status` | String | Current wager state: `pending`, `settled`. | `"pending"` |
| `settlement` | String (Optional) | Specific outcome status: `won`, `lost`, `push`, `void`, `half_won`, `half_lost`. | `"won"` |
| `profitLossPoints`| Number (Optional) | Net change in points after settlement. | `8.5` |
| `notes` | String (Optional) | Personal user notes on the bet. | `"strong home stats"` |
| `source` | String | Origin of the record: `manual`, `ai_recommendation`. | `"manual"` |
| `trace` | Object (Optional) | Contextual metadata object linking to other features. | `{ "predictionTraceId": "pred_777" }` |
| `tags` | Array<String> | Custom categorizations. | `["risk-high", "corners"]` |

---

## 2. Structural Isolation Guidelines
To comply with `docs/governance/OWNER-DECISION-GATES.md`:
* **No Database Models**: No ORM annotations, Sequelize attributes, or MongoDB schemas are to be written. The data remains a simple JSON object contract.
* **Separation from UI**: The web UI must interact with this record purely as a plain object using setter/getter mediation hooks.
* **Calculations Deferred**: Formulas to compute `profitLossPoints` from `oddsValue` and `stakePoints` must be placed in a dedicated, swappable strategy module, not embedded directly inside the model object.
