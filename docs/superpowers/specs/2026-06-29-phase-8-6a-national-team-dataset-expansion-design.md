# Phase 8.6A National-Team Dataset Expansion Design Spec

* **Status**: Proposed
* **Date**: 2026-06-29
* **Phase**: 8.6A National-Team Dataset Expansion for Model Selection Evidence
* **Audience**: Owner, Planner Agent

---

## 1. Context & Motivation

In Phase 8.6, the owner approved `ADR-0041`, selecting **no model** for activation due to:
1. **Low Test Sample Size**: Only 107 scored fixtures in the aggregate World Cup + Euro test set.
2. **Missing Bookmaker Odds Baseline**: Market-implied probabilities were not available, making it impossible to evaluate candidates against the market.
3. **High Variance**: Large confidence intervals and small candidate margins.

**Phase 8.6A** aims to resolve these evidence gaps before reconsidering model selection by:
- **Expanding historical coverage** of provider-supported national-team competitions.
- **Investigating and clarifying the availability** of a bookmaker/implied odds baseline.
- **Increasing the out-of-sample test count** to achieve a more stable model bake-off.

---

## 2. Provider Analysis & Findings

### 2.1 League Support
We queried the local virtual environment and `soccerdata` (FBref) to check league availability:
- **Supported national-team leagues**: `INT-World Cup`, `INT-European Championship`, and `INT-Women's World Cup`.
- **Unsupported/Blocked leagues**:
  - `INT-Copa America` is **not supported** by the FBref provider.
  - `AFCON`, `Asian Cup`, and `CONCACAF Gold Cup` are **not supported** by the FBref provider.
  - Club leagues (e.g., `ENG-Premier League`) are **explicitly blocked** by guardrails and must not be touched.

### 2.2 Bookmaker Odds Baseline
We evaluated FBref's schedule structure and confirmed:
- FBref's scraped schedule data **contains no odds columns** (`league, season, game, round, week, date, time, teams, venue, game_id`).
- While `soccerdata.MatchHistory` contains historical odds, it is sourced from football-data.co.uk which is **club-only** and does not cover international tournaments.
- Therefore, a **real bookmaker baseline is not natively available** for historical national-team matches via our provider. We will explicitly document this limitation and keep the bookmaker baseline field as `null` (unavailable) for this offline R&D dataset.

---

## 3. Proposed Dataset Expansion & Splitting

To increase both the training history and the out-of-sample test count, we propose expanding historical seasons and updating splits chronologically.

### 3.1 World Cup (INT-World Cup)
- **Seasons to load**: `[2002, 2006, 2010, 2014, 2018, 2022]` (previously `[2014, 2018, 2022]`).
- **Proposed splits**:
  - **Train**: `[2002, 2006, 2010]` (192 matches)
  - **Validation**: `[2014]` (64 matches)
  - **Test**: `[2018, 2022]` (128 matches)

### 3.2 Euro (INT-European Championship)
- **Seasons to load**: `[2000, 2004, 2008, 2012, 2016, 2021, 2024]` (previously `[2016, 2021, 2024]`).
- **Proposed splits**:
  - **Train**: `[2000, 2004, 2008]` (93 matches)
  - **Validation**: `[2012, 2016]` (82 matches)
  - **Test**: `[2021, 2024]` (102 matches)

### 3.3 Aggregate Sample Counts
- **Total Train**: ~285 matches
- **Total Validation**: ~146 matches
- **Total Test**: **~230 matches** (more than double the previous 107 matches!)

---

## 4. Execution Workflow

Once this design is approved, the implementation plan will execute the following steps:

1. **Modify Configuration**:
   - Update `apps/local-ai/config/competition-registry.json` with the expanded seasons and updated splits.
2. **Download Snapshots**:
   - Run the download script to fetch historical seasons:
     ```bash
     apps\local-ai\.venv\Scripts\python apps/local-ai/scripts/download_snapshot.py comp-int-world-cup
     apps\local-ai\.venv\Scripts\python apps/local-ai/scripts/download_snapshot.py comp-int-euro
     ```
3. **Build Processed Datasets**:
   - Run the rebuild script to regenerate processed JSONL files and metadata:
     ```bash
     apps\local-ai\.venv\Scripts\python apps/local-ai/scripts/build_national_team_datasets.py
     ```
4. **Rerun Phase 8 Verification Pipeline**:
   - **Leakage Audit**: `pnpm run phase8:feature-audit`
   - **Dataset Expansion Report**: `pnpm run phase8:national-team-expansion` (re-verifies that test count $\ge 100$)
   - **Evaluation Harness**: `pnpm run phase8:evaluation-harness` (recomputes metrics and baselines)
   - **Candidate Bake-Off**: `pnpm run phase8:candidate-bakeoff` (scores models on the new 230 test matches)
   - **Experimental Report Surface**: `pnpm run phase8:experimental-report-surface` (regenerates the owner-only markdown report)

---

## 5. Next Steps

- Obtain owner approval for this Design Spec.
- Generate `implementation_plan.md` and `task.md` for Phase 8.6A execution.
- Proceed to execution.
