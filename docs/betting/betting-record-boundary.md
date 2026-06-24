# Betting Record Boundary Spec

This document details the boundary contracts and owner-applied candidate fields for the `BetRecordEnvelope`. These fields remain documentation-level planning artifacts until a later ADR is drafted and approved.

> [!WARNING]
> This is a candidate definition. No production database tables, data models, migrations, or active logic should be created based on these fields until a later ADR is explicitly approved by the owner.

---

## 1. Owner-Applied Candidate Fields

The owner approved a structured `BetRecordEnvelope` for v1 with the following candidate fields.

### Core fields

| Field Name | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `betId` | String | Unique identifier generated for the bet. | `"bet_1234567"` |
| `matchGroupId` | String | ID grouping multiple bets on the same match. | `"match_group_888"` |
| `createdAt` | ISO String | Timestamp when the record was written locally. | `"2026-06-24T12:00:00Z"` |
| `betTimeType` | String | Classification of bet timing: `pre_match` or `live`. | `"live"` |
| `homeTeamName` | String | Manually entered or feed-provided home participant label. | `"Team Alpha"` |
| `awayTeamName` | String | Manually entered or feed-provided away participant label. | `"Team Beta"` |
| `marketType` | String | Primary market category. | `"over_under"` |
| `selectionLabel` | String | The chosen outcome selection. | `"over"` |
| `oddsFormat` | String | Selected odds format display type. | `"HK"` |
| `oddsValue` | Number | User-entered raw odds value. | `0.85` |
| `stakePoints` | Number | Points-based stake value. | `10.0` |
| `status` | String | Current wager state. Approved v1 values are documented in ADR-0028 candidate wording. | `"pending"` |

### Optional fields

| Field Name | Type | Description | Example Value |
| :--- | :--- | :--- | :--- |
| `matchId` | String | Association ID if linked to an ingested feed match. | `"match_abcde987"` |
| `competitionLabel` | String | Generic competition label, not a hardcoded real competition. | `"Competition Alpha"` |
| `seasonLabel` | String | Identification of the season. | `"Season 1"` |
| `marketSubtype` | String | Secondary market subcategory. | `"corners_over_under"` |
| `lineValue` | Number | Numeric line value when a market uses a line. | `2.5` |
| `lineDisplay` | String | Display label of the line. | `"O/U 2.5"` |
| `liveScoreHome` | Number | Home score at the time a live bet was logged. | `1` |
| `liveScoreAway` | Number | Away score at the time a live bet was logged. | `0` |
| `liveMinute` | Number | Match minute at the time a live bet was logged. | `62` |
| `settlement` | String | Specific settlement value when separated from `status`. | `"won"` |
| `profitLossPoints` | Number or null | Signed net points after settlement; nullable while pending. | `null` |
| `notes` | String (Optional) | Personal user notes on the bet. | `"strong home stats"` |
| `tags` | Array<String> | Custom metadata tags. | `["manual-review"]` |
| `source` | String | Origin of the record, such as manual or future recommendation conversion. | `"manual"` |
| `trace` | Object (Optional) | Contextual metadata object linking to other features. | `{ "predictionTraceId": "pred_777" }` |
| `predictionTraceId` | String | Optional direct reference to a prediction trace after prediction ADR approval. | `"pred_777"` |
| `recommendationId` | String | Optional reference to a recommendation card after recommendation ADR approval. | `"rec_777"` |

### Metadata-only rule

`notes` and `tags` are approved for v1 as metadata only. They must not drive prediction, bankroll, risk, settlement, or AI recommendation logic in v1.

---

## 2. Structural Isolation Guidelines
To comply with `docs/governance/OWNER-DECISION-GATES.md`:
* **No Database Models**: No ORM annotations, Sequelize attributes, or MongoDB schemas are to be written. The data remains a simple JSON object contract.
* **Separation from UI**: The web UI must interact with this record purely as a plain object using setter/getter mediation hooks.
* **Calculations Deferred**: Formulas to compute `profitLossPoints` from odds, stake, and settlement state remain deferred until explicit owner approval.
* **Pending Profit/Loss**: `profitLossPoints` must remain nullable while a bet is pending.
