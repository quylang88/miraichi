# Phase 8.1 Dataset Snapshot and Provenance Review

## Status
- **Status**: Corrected after owner review
- **Date**: 2026-06-28
- **Reviewed Scope**: `apps/local-ai` dataset snapshot/provenance implementation, Phase 8.1 implementation plan, guardrails, and current roadmap.

## Direct Conclusion
The previously completed Phase 8.1 direction was wrong because it used Premier League (`comp-eng-pl`, `ENG-Premier League`) as the default dataset target.

Phase 8.1 must start with World Cup and related national-team competitions. Premier League and other club competitions are later expansion scope only.

## Facts
- The accepted Phase 7 direction names full World Cup fixture coverage as the first provider target.
- The owner clarified on 2026-06-28 that the first data/training path must be World Cup, national teams, and national-team-related competitions.
- The prior Phase 8.1 implementation plan and local-ai sample data used `comp-eng-pl`, `ENG-Premier League`, Manchester United, and Arsenal examples.
- `soccerdata` exposes the `INT-World Cup` league key in the local environment.
- The corrected Phase 8.1 path now uses:
  - `comp-int-world-cup`
  - `INT-World Cup`
  - seasons `2014`, `2018`, `2022`
  - national-team mapping IDs such as `team-deu-national`, `team-fra-national`, and `team-arg-national`

## Corrected Boundary
World Cup is not banned from the project.

World Cup and national-team competition metadata is allowed and required in registry/config/data artifacts for the initial Phase 8 path. What remains blocked is burying one-tournament assumptions in core parser logic, routes, model logic, business logic, or folder structure.

## Corrected Files
- `.agent/skills/miraichi-project-guardrails/SKILL.md`
- `.agent/skills/miraichi-competition-agnostic-review/SKILL.md`
- `README.md`
- `CONTRIBUTING.md`
- `PROJECT_PLAN.md`
- `ROADMAP.md`
- `docs/superpowers/plans/2026-06-28-phase-8-model-rd-plan.md`
- `docs/superpowers/plans/2026-06-28-phase-8-1-dataset-snapshot-provenance.md`
- `apps/local-ai/config/competition-registry.json`
- `apps/local-ai/scripts/config.py`
- `apps/local-ai/scripts/download_snapshot.py`
- `apps/local-ai/scripts/build_dataset.py`
- `apps/local-ai/tests/*`
- `apps/local-ai/data/raw/comp-int-world-cup_schedule.csv`
- `apps/local-ai/data/processed/comp-int-world-cup/*`
- `packages/shared/src/data/team-mappings.json`
- `packages/config/src/competition-registry.mock.ts`
- `packages/config/src/competition-registry.mock.test.ts`
- `scripts/phase2-verify.ts`
- `scripts/audit-rules.ts`

## Risks
- The corrected sample dataset has only one train, one validation, and one test record. It proves reproducibility and contract shape only; it is not statistically useful for model training.
- World Cup-only evaluation will have high variance. Future Phase 8.3 metrics must say this explicitly.
- National-team competitions beyond the World Cup still need an owner-approved source list before broader training data is built.
- Club competition support must not start until the national-team-first path has dataset provenance, quality reporting, leakage audit, and baseline evaluation.

## Recommendation
Do not move to club datasets yet.

The earliest safe next step is:

```bash
phase:implementation-plan Phase 8.2 Feature Spec and Leakage Audit
```

Phase 8.2 must assume the first feature/leakage tests are built around World Cup and related national-team competition data, while keeping features generic enough to support clubs later.
