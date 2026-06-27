# Phase 4.4 Integration Review Checklist

* **Status**: Completed

This checklist is used to evaluate the completeness of the Phase 4.4 integration planning package.

---

## 1. Boundary Design Checklist

- [ ] **API Gateway**: Does the plan ensure `apps/api` only proxies payloads and does not calculate predictions, odds edges, or wagers?
- [ ] **Web UI**: Does the plan list only allowed display properties (`predictionId`, `warnings`, etc.) and prohibit displaying wagers or picks?
- [ ] **Refusal UX**: Does the UX require displaying deterministic refusal messages and trace references when predictions are unavailable?
- [ ] **Failure Handling**: Does the plan define fallback responses when `apps/local-ai` is unreachable?
- [ ] **Traceability**: Is the lineage of IDs (`predictionId`, `inputCandidateId`, `workerRunId`) maintained across all communication blocks?
- [ ] **Future strategy**: Does the plan explicitly state that swapping mock strategies for active predictions requires owner-approved ADRs?

---

## 2. Guardrails Checklist

- [ ] **No Algorithms**: Are there zero machine learning formulas or heuristics in the plans?
- [ ] **No Betting Rules**: Are there zero bankroll wagers or Kelly Criterion models?
- [ ] **No DB/Provider/Secrets**: Are there zero database schemas or API key requirements?
- [ ] **Agnostic Placemarkers**: Do all examples use placeholders like `match-alpha-001` and `competition-alpha` instead of the World Cup or real teams?
