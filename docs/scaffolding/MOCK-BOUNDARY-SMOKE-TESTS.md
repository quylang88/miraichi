# Mock Boundary Smoke Tests

This guide outlines manual command verification steps for verifying monorepo boundary APIs and response envelopes using `curl`.

---

## 1. API Mediation Gateway (`apps/api` - Port 3001)

### A. Health Check
```bash
curl http://localhost:3001/api/v1/health
```
**Expected Response**:
```json
{
  "status": "ok",
  "service": "api-mediation-gateway",
  "timestamp": "..."
}
```

### B. Matches Fixtures Feed
```bash
curl http://localhost:3001/api/v1/matches
```
**Expected Response**: A JSON array of generic match structures featuring `homeTeam` and `awayTeam` (no tournament hardcoding).

### C. Predictions & AI Traces (proxied from Local AI)
```bash
curl http://localhost:3001/api/v1/predictions?matchId=match_2026_001
```
**Expected Response**:
```json
{
  "matchId": "match_2026_001",
  "predictionId": "pred_2026_9999",
  "predictionOutcome": "home_win",
  "confidenceScore": 0.68,
  "confidenceLevel": "medium",
  "status": "completed",
  "prediction_available": true,
  "trace": {
    "engine": "local-statistical-stub",
    ...
  }
}
```

### D. Chat explanations (Refusal Safety Check - ADR-0007)

* **Valid sports-related analytics query**:
  ```bash
  curl -X POST -H "Content-Type: application/json" -d "{\"predictionId\":\"pred_2026_9999\",\"message\":\"Explain the head to head scoring averages ratio.\"}" http://localhost:3001/api/v1/chat
  ```
  **Expected Response**: Returns assistant explanation with `refusalCheck.passed: true`.

* **Out-of-scope/Off-topic query**:
  ```bash
  curl -X POST -H "Content-Type: application/json" -d "{\"predictionId\":\"pred_2026_9999\",\"message\":\"What is the recipe for cheese pizza?\"}" http://localhost:3001/api/v1/chat
  ```
  **Expected Response**: Returns refusal reply stating it is a statistical sports assistant with `refusalCheck.passed: false`.

### E. Bets History Log (Read-only Option B boundary)
```bash
curl http://localhost:3001/api/v1/bets
```
**Expected Response**: Array containing placing logs (no risk assessment or bankroll variables).

---

## 2. Local AI Statistics Server (`apps/local-ai` - Port 3002)

### A. Stats Generation
```bash
curl -X POST -H "Content-Type: application/json" -d "{\"matchId\":\"match_2026_001\"}" http://localhost:3002/ai/v1/predict
```
**Expected Response**: Returns completed prediction candidate payload.

### B. Chatbot Explanation
```bash
curl -X POST -H "Content-Type: application/json" -d "{\"predictionId\":\"pred_2026_9999\",\"message\":\"Why Team A?\"}" http://localhost:3002/ai/v1/explain
```
**Expected Response**: Returns chatbot reply envelope.
