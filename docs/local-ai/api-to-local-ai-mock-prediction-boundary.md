# API to Local AI Mock Prediction Boundary

* **Status**: Draft
* **Date**: June 23, 2026

---

## 1. Boundary Objectives
The API gateway (`apps/api`) functions strictly as a presentational and mediational channel. It proxies requests between the client and downstream services, validating JSON structures and protecting database integrity. It is prohibited from executing analytical business logic, team scoring, or risk validations.

---

## 2. API Proxy Rules
* **Proxying predictions**:
  * The API gateway exposes `GET /api/v1/predictions?matchId=<ID>`.
  * It maps this query, extracts the inputCandidate from the worker cache, and forwards it to `apps/local-ai` via `POST /ai/v1/mock/predict`.
  * It returns the prediction output envelope directly to the client.
* **Proxying explanations**:
  * The API gateway exposes `POST /api/v1/chat` (explanation queries).
  * It calls `POST /ai/v1/mock/explain` with the prediction envelope payload.
  * It forwards the refusal/explanation response to the client.

---

## 3. Strict Exclusions
To comply with [OWNER-DECISION-GATES.md](file:///c:/CODE/miraichi/docs/governance/OWNER-DECISION-GATES.md):
* **No Calculations**: The API gateway code must not perform math checks, likelihood evaluations, or team scoring comparisons.
* **No Added Fields**: The gateway must not enrich payloads with probability fields (e.g. `drawProbability`) or confidence percentages.
* **No Advice**: The gateway must not generate betting picks or advise wagers.
