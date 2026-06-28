# Phase 7 Partial ADR Acceptance Summary

* **Status**: Partial Acceptance - Remaining Owner Review Required
* **Date**: 2026-06-28
* **Review Target**: ADR-0035 through ADR-0040
* **Owner Decision**: Accept ADR-0036, ADR-0037, ADR-0038, and ADR-0039. Keep ADR-0035 and ADR-0040 in draft for another review round.

---

## 1. Accepted ADRs

The project owner accepted the following ADRs on 2026-06-28:

| ADR | File | Accepted Scope | Not Approved |
| --- | --- | --- | --- |
| ADR-0036 | [ADR-0036-world-cup-fixture-coverage-competition-agnostic-adapter.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0036-world-cup-fixture-coverage-competition-agnostic-adapter.md) | World Cup as first use case through competition-agnostic adapter boundaries. | World Cup-specific code, production registry schema, provider integration, prediction logic. |
| ADR-0037 | [ADR-0037-dataset-boundaries-and-schema-for-prediction.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0037-dataset-boundaries-and-schema-for-prediction.md) | Offline, static, versioned dataset boundaries and reproducibility metadata. | Feature formulas, model training code, cloud storage, production database schema. |
| ADR-0038 | [ADR-0038-prediction-evaluation-criteria-and-metrics.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0038-prediction-evaluation-criteria-and-metrics.md) | Evaluation metric categories: Brier Score, Expected Calibration Error, and bookmaker-implied baseline comparison. | Thresholds, model promotion gates, betting ROI, CLV, stake sizing, prediction algorithms. |
| ADR-0039 | [ADR-0039-provider-adapter-contract-and-data-validation-schema.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0039-provider-adapter-contract-and-data-validation-schema.md) | Parser-boundary validation, critical vs optional field handling, and dead-letter evidence planning. | Package installation, live adapter code, production database schema, logging vendors. |

These acceptances are planning and architecture boundaries only. They do not authorize live provider integration, model training, betting recommendations, production rollout, or Phase 8 execution.

## 2. ADRs Still Draft

| ADR | File | Current Status | Reason |
| --- | --- | --- | --- |
| ADR-0035 | [ADR-0035-real-data-provider-selection-and-integration-strategy-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0035-real-data-provider-selection-and-integration-strategy-draft.md) | Draft - Owner Review Required | Provider pricing, quota, endpoint coverage, terms, and free-tier fit must be rechecked before acceptance. |
| ADR-0040 | [ADR-0040-model-readiness-gates-and-deployment-governance-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0040-model-readiness-gates-and-deployment-governance-draft.md) | Draft - Owner Review Required | Gate thresholds need Phase 8 empirical evidence before they can become accepted governance. |

## 3. Remaining Review: ADR-0035 Provider Recommendation

### Facts

* Football-Data.org's official pricing page currently shows a free plan with 12 competitions, fixtures, delayed scores/schedules, league tables, and 10 calls/minute.
* The Odds API official homepage currently shows a free Starter plan with 500 credits/month, all sports, most bookmakers, all betting markets, and no historical odds.
* API-Football pricing and coverage must be rechecked by the owner on the acceptance date because provider pages, plan names, quota, and terms can change.

### Inference

API-Football is still the best first candidate if the owner confirms the current free tier is usable, because one broad provider is simpler than joining fixtures from one vendor and odds from another. Cross-provider ID reconciliation is not theoretical risk; it directly creates duplicate teams, wrong match joins, and corrupted evaluation datasets.

### Recommendation

Use **API-Football as the primary owner-only free-tier pilot candidate**, with these limits:

* one project owner user only;
* free tier only;
* no public or multi-user usage;
* no paid plan without separate owner approval;
* local raw response cache required;
* hard daily/monthly quota guard required;
* low-frequency manual or scheduled pulls only;
* no live prediction recommendation surface.

If API-Football's free tier is not acceptable after owner recheck, use **Football-Data.org for fixtures/results only** and **The Odds API for odds only**. That fallback is acceptable for exploration, but it is weaker because it introduces provider matching work.

## 4. Remaining Review: ADR-0040 Model Gates

### Facts

ADR-0038 is now accepted only for metric categories. It does not approve any threshold.

### Inference

The draft thresholds in ADR-0040 are plausible as R&D review gates, but they are not proven against Miraichi data. Accepting them as production governance now would be fake certainty.

### Recommendation

Keep ADR-0040 as draft. For the first owner-only phase, allow experimental evaluation reports only:

* no production-ready label;
* no public predictions;
* no betting recommendation;
* no stake sizing, bankroll, ROI, CLV, or Kelly Criterion logic;
* no automated model promotion;
* owner remains the final authority after seeing Phase 8 evidence.

## 5. Open Questions

| Question | Recommended Answer |
| --- | --- |
| Can Phase 7 be marked complete now? | No. Four ADRs are accepted, but provider selection and model governance are still draft. |
| Can an implementation plan start for accepted ADRs only? | Yes, but only for planning boundaries that do not require provider selection or model gates. A live provider implementation plan should wait for ADR-0035 acceptance. |
| Which provider should be used first if the owner wants free and one user only? | API-Football, if the owner confirms current free-tier quota, endpoint coverage, and terms. Otherwise split fixtures/results to Football-Data.org and odds to The Odds API as a weaker fallback. |
| Can Phase 8 model R&D start now? | Not yet. ADR-0040 remains draft, and Phase 8 should wait for the model gate authority question to be settled. |

## 6. Next Recommended Step

Review ADR-0035 first, confirm current provider facts directly from official source pages, and decide whether API-Football is acceptable as an owner-only free-tier pilot. Review ADR-0040 after that as owner-only R&D governance, not production governance.
