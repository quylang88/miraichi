# Web Prediction Envelope Display Boundary

* **Status**: Draft
* **Date**: June 23, 2026

---

## 1. UI Boundary Context
The web interface (`apps/web`) is presentational and displays data provided by the API gateway. It must present status metrics clearly, without extrapolating wagers or formulating fake game results when predictions are unavailable or run in mock mode.

---

## 2. Displayable Payload Properties
The frontend client may parse and render only these fields from the prediction envelope:
* `predictionId`: Unique UUID string.
* `matchId`: Generic fixture ID.
* `engineMode`: Indicates runtime environment (e.g. `"mock"`).
* `predictionAvailable`: Rendered as status indicators (e.g. `"Unavailable"` / `"Mock Active"`).
* `confidenceLabel`: Rendered as categorical tags (`"not_available"`).
* `outputSummary`: Short plain-text rationale description.
* `warnings`: Rendered as warning banners or alert notes.
* `trace`: Rendered in debug logs for audit lineage verification.

---

## 3. Strict UI Exclusions
To comply with codebase guardrails:
* **No Betting Advice**: The UI must not display recommendation badges (e.g. "Value Pick", "Home Win Best Bet").
* **No Fake Outcomes**: The UI must not generate home/draw/away percentage gauges or likelihood sliders when predictionAvailable is false.
* **Mock Status Banner**: If `engineMode` is `"mock"` or `predictionAvailable` is `false`, the page must render a prominent banner:
  > **Mock Mode**: No prediction algorithm is currently active. Showing trace telemetry only.
