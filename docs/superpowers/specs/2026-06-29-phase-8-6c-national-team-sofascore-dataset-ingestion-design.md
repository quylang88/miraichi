# Phase 8.6C National-Team Sofascore Dataset Ingestion Design Spec

* **Status**: Proposed
* **Date**: 2026-06-29
* **Phase**: 8.6C National-Team Sofascore Dataset Ingestion
* **Audience**: Owner, Planner Agent, AI/Data Agent, QA Agent

---

## 1. Context

In Phase 8.6B, we completed the Sofascore tournament-id discovery and validation checks. The results verified that all 7 target national-team competitions are `ready_for_ingestion_plan`, and that a rich historical dataset of **800+ completed match events** is discoverable. 

However, the odds baseline check confirmed that pre-match 1X2 bookmaker odds are currently unavailable under the owner-approved constraints (no API keys, no secrets, no paid subscriptions).

The owner approved Option 1: **Ingest only fixture/score data for now**, keeping the odds baseline block active. 

Phase 8.6C is the **dataset ingestion phase** to pull these match schedules and scores from Sofascore, write them to the local raw directory, and integrate them into the offline training and validation dataset splits.

---

## 2. Current Source Facts

* **Discovered tournaments**: We have working unique tournament IDs for 7 competitions:
  * FIFA World Cup (`16`)
  * UEFA European Championship (`1`)
  * Africa Cup of Nations (`270`)
  * Copa America (`133`)
  * AFC Asian Cup (`246`)
  * CONCACAF Gold Cup (`140`)
  * UEFA Nations League (`10783`)
* **Logging pollution**: Python logger outputs (from `soccerdata` / `rich`) pollute `stdout`. Node scripts must filter out log messages and parse only the JSON block (e.g. splitting by newlines and taking the last line).
* **Missing rounds**: Knockout stages in some seasons fail to download with 404 client errors on specific round IDs. The crawler must handle round-specific errors gracefully, logging warnings but continuing so that successfully downloaded round events are preserved.
* **Database / Splitting pipeline**: `build_dataset.py` reads `apps/local-ai/data/raw/<competition_id>_schedule.csv`, maps team names using `TeamMapper`, and writes train/val/test chronological JSONL splits under `apps/local-ai/data/processed/<competition_id>/` according to the splits defined in `apps/local-ai/config/competition-registry.json`.

---

## 3. Goals

1. **Ingest Historical Matches**: Fetch completed seasons' match events from Sofascore for the 7 target national-team competitions.
2. **Format as Raw CSVs**: Save the fetched events into `apps/local-ai/data/raw/<competition_id>_schedule.csv` using the exact schema expected by `build_dataset.py`:
   - `game_id` (string, e.g. `match-11761871`)
   - `date` (string, `YYYY-MM-DD`)
   - `season` (integer, e.g. `2023`)
   - `time` (string, `HH:MM`)
   - `home_team` (string)
   - `away_team` (string)
   - `home_score` (integer)
   - `away_score` (integer)
   - `venue` (string or empty)
3. **Register New Competitions**: Update `apps/local-ai/config/competition-registry.json` to define chronological train/val/test splits for the 5 newly added national-team competitions:
   - Africa Cup of Nations (`comp-int-afcon`)
   - Copa America (`comp-int-copa-america`)
   - AFC Asian Cup (`comp-int-afc-asian-cup`)
   - CONCACAF Gold Cup (`comp-int-concacaf-gold-cup`)
   - UEFA Nations League (`comp-int-uefa-nations-league`)
4. **Orchestrate Dataset Building**: Update `build_national_team_datasets.py` or write an orchestrator to rebuild all 7 national-team splits using the new Sofascore-backed CSVs.
5. **No Odds/Secrets**: Ensure that no odds are requested, no keys are used, and no secrets are added.

---

## 4. Non-Goals

* Do not crawl or parse bookmaker odds. Implied probabilities/odds baseline remain blank/blocked.
* Do not add API keys, `.env` parameters, or paid provider clients.
* Do not select a model or runtime inference package.
* Do not ingest club competitions.
* Do not train models during Phase 8.6C.

---

## 5. Proposed Design

### 5.1 Ingestion Registry configuration
The registry at `apps/local-ai/config/sofascore-national-team-discovery.json` (created in Phase 8.6B) defines the tournament IDs. We will use this registry to drive the ingestion.

### 5.2 TypeScript Ingestion Runner
Create a TS orchestrator `scripts/phase8-sofascore-national-team-ingestion-verify.ts` that:
1. Loads the Sofascore registry.
2. For each competition:
   - FetchesCompleted Seasons from Sofascore.
   - For each completed season, queries `fetchRounds`.
   - For each round, queries `fetchEventsForRound`.
   - Gracefully catches round-specific errors (404/ConnectionError) and logs them, preserving the events from successful rounds.
3. Groups the events by competition.
4. Formats and writes the aggregated matches to `apps/local-ai/data/raw/<competition_id>_schedule.csv`.

To satisfy TypeScript-first constraints, the script will be in TypeScript and invoke Python inline to reuse the TLS-backed `soccerdata` virtual environment, matching the successful pattern from Phase 8.6B.

### 5.3 Competition Registry Updates
We will add the new competitions to `apps/local-ai/config/competition-registry.json` with chronological split mappings:
- **AFCON**:
  - `seasons`: `[2010, 2012, 2013, 2015, 2017, 2019, 2021, 2023]`
  - `train_split`: `[2010, 2012, 2013, 2015, 2017]`
  - `val_split`: `[2019, 2021]`
  - `test_split`: `[2023]`
- **Copa America**:
  - `seasons`: `[2007, 2011, 2015, 2016, 2019, 2021, 2024]`
  - `train_split`: `[2007, 2011, 2015, 2016]`
  - `val_split`: `[2019]`
  - `test_split`: `[2021, 2024]`
- **AFC Asian Cup**:
  - `seasons`: `[2011, 2015, 2019, 2023]`
  - `train_split`: `[2011, 2015]`
  - `val_split`: `[2019]`
  - `test_split`: `[2023]`
- **CONCACAF Gold Cup**:
  - `seasons`: `[2009, 2011, 2013, 2015, 2017, 2019, 2021, 2023]`
  - `train_split`: `[2009, 2011, 2013, 2015, 2017]`
  - `val_split`: `[2019, 2021]`
  - `test_split`: `[2023]`
- **UEFA Nations League**:
  - `seasons`: `[2018, 2020, 2022, 2024]`
  - `train_split`: `[2018, 2020]`
  - `val_split`: `[2022]`
  - `test_split`: `[2024]`

### 5.4 Rebuilding Splits
Once raw CSVs are saved, run `build_national_team_datasets.py` to compile the final train/val/test splits for all 7 competitions.

---

## 6. Expected Outputs

* Modify: `apps/local-ai/config/competition-registry.json`
* Modify: `package.json` — add script `phase8:sofascore-national-team-ingestion`
* Create: `scripts/phase8-sofascore-national-team-ingestion-verify.ts`
* Create: `scripts/phase8-sofascore-national-team-ingestion-verify.test.ts`
* Generated Raw CSVs under `apps/local-ai/data/raw/`:
  - `comp-int-world-cup_schedule.csv` (Sofascore-sourced)
  - `comp-int-euro_schedule.csv` (Sofascore-sourced)
  - `comp-int-afcon_schedule.csv`
  - `comp-int-copa-america_schedule.csv`
  - `comp-int-afc-asian-cup_schedule.csv`
  - `comp-int-concacaf-gold-cup_schedule.csv`
  - `comp-int-uefa-nations-league_schedule.csv`
* Generated processed splits under `apps/local-ai/data/processed/` for all 7 competitions (metadata, quality report, JSONL splits).

---

## 7. Verification Requirements

The verification steps must execute:
```bash
pnpm exec vitest run scripts/phase8-sofascore-national-team-ingestion-verify.test.ts
pnpm run phase8:sofascore-national-team-ingestion
pnpm run verify:lifecycle
git diff --check
```

---

## 8. Exit Criteria

Phase 8.6C can close only when:
1. Raw CSV fixtures for all 7 tournaments are successfully saved to `apps/local-ai/data/raw/`.
2. Processed splits (train, val, test) for all 7 tournaments are compiled under `apps/local-ai/data/processed/`.
3. Ingestion quality reports show `processedCount > 0` and low rejection rates for all tournaments.
4. Total combined national-team training, validation, and test sample counts are logged and recorded in `PROJECT_PLAN.md`.
5. No club competitions are enabled or processed.
6. Bookmaker baseline remains marked as unavailable.
