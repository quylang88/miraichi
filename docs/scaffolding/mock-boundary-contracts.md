# Mock Boundary Contracts

This document specifies the exact JSON schemas and mock data payloads for API boundaries in Phase 2. All endpoints in the scaffolded apps must return these structures.

---

## 1. Web to API Interface (`apps/web` <-> `apps/api`)

### `GET /api/v1/matches`
Returns a list of upcoming matches.

**Response Payloads**:
```json
[
  {
    "id": "match_2026_001",
    "competitionId": "comp_international_cup_2026",
    "seasonId": "season_2026",
    "status": "scheduled",
    "homeTeam": {
      "id": "team_generic_a",
      "name": "Team A"
    },
    "awayTeam": {
      "id": "team_generic_b",
      "name": "Team B"
    },
    "scheduledTime": "2026-06-25T18:00:00Z"
  }
]
```

### `GET /api/v1/predictions?matchId={matchId}`
Returns AI predictions and trace metadata for a match.

**Response Payloads**:
```json
{
  "matchId": "match_2026_001",
  "predictionId": "pred_2026_9999",
  "generatedAt": "2026-06-23T12:00:00Z",
  "predictionOutcome": "home_win",
  "confidenceScore": 0.68,
  "confidenceLevel": "medium",
  "trace": {
    "engine": "local-statistical-stub",
    "version": "1.0.0-mock",
    "runTimeMs": 142,
    "inputVariables": {
      "homeScoringAverage": 2.1,
      "awayScoringAverage": 1.2,
      "headToHeadRatio": 0.6
    }
  }
}
```

### `POST /api/v1/chat`
Sends a conversational query to explain a prediction.

**Request Payload**:
```json
{
  "predictionId": "pred_2026_9999",
  "message": "Why does the model predict a home win for Team A?"
}
```

**Response Payload**:
```json
{
  "predictionId": "pred_2026_9999",
  "reply": "Based on the mock historical trace, the model favors Team A due to their higher average home scoring rate (2.1 vs 1.2) and a strong head-to-head record.",
  "trace": {
    "llmProvider": "mock-local-llm",
    "modelName": "mock-instruct-v1",
    "tokensUsed": {
      "prompt": 45,
      "completion": 30
    },
    "refusalCheck": {
      "passed": true,
      "action": "reply"
    }
  }
}
```

### `GET /api/v1/bets`
Returns mock bet history logs (Option B Product Boundary).

**Response Payloads**:
```json
[
  {
    "betId": "bet_2026_1001",
    "matchId": "match_2026_001",
    "predictionId": "pred_2026_9999",
    "amount": 100.0,
    "selectedMarket": "home_win",
    "placedOdds": 1.95,
    "status": "placed",
    "placedAt": "2026-06-23T14:30:00Z"
  }
]
```

---

## 2. API to Local AI Interface (`apps/api` <-> `apps/local-ai`)

### `POST /ai/v1/predict`
Calculates prediction variables (stub only).

**Request Payload**:
```json
{
  "matchId": "match_2026_001"
}
```

**Response Payload**: Same schema as `GET /api/v1/predictions`.

---

## 3. Worker to Ingestion Feeds (`apps/worker` <-> Data Source)

### Stub Fixtures feed
Local mock JSON file representing sports provider feeds (e.g. `apps/worker/src/mock-feed.json`).

```json
{
  "feedTimestamp": "2026-06-23T18:00:00Z",
  "data": [
    {
      "provider_fixture_id": "prov_9812",
      "league_generic_name": "International Tournament",
      "utc_kickoff": "2026-06-25T18:00:00Z",
      "competitor_1": "Team A",
      "competitor_2": "Team B"
    }
  ]
}
```
