# Phase 8.6B Sofascore National-Team Source Discovery and Odds Baseline Discovery Design Spec

* **Status**: Proposed
* **Date**: 2026-06-29
* **Phase**: 8.6B Sofascore National-Team Source Discovery and Odds Baseline Discovery
* **Audience**: Owner, Planner Agent, AI/Data Agent, QA Agent

---

## 1. Context

Phase 8.6 selected **no model** for activation because the evidence was still too weak: the test set was small, bookmaker odds were unavailable, and model margins were not reliable enough for selection.

Phase 8.6A improved the aggregate national-team dataset from the earlier World Cup + Euro evidence to a scored test sample count of **214**, but it still has two hard gaps:

1. It only expanded World Cup and Euro.
2. It still has **no bookmaker-implied baseline**; all 214 test fixtures are missing bookmaker probabilities.

The owner correctly challenged the Phase 8.6A provider conclusion. Saying AFCON, Copa America, AFC Asian Cup, and CONCACAF Gold Cup are unavailable based only on the current FBref path is too narrow. `soccerdata` includes a Sofascore scraper, and Sofascore exposes direct tournament ids that are not surfaced by `soccerdata.Sofascore.available_leagues()`.

Phase 8.6B is a **discovery and evidence phase**, not a main dataset ingestion phase yet.

---

## 2. Current Source Facts

### 2.1 Local `soccerdata` Capability

Local environment:

* `soccerdata` version: `1.9.0`
* `soccerdata.Sofascore.available_leagues()` default national-team coverage found locally:
  * `INT-European Championship`
  * no default `INT-World Cup`
  * no default `INT-Copa America`
  * no default AFCON
  * no default AFC Asian Cup
  * no default CONCACAF Gold Cup

This means a naive `soccerdata.Sofascore(leagues=...)` path is not enough.

### 2.2 Direct Sofascore Tournament Evidence

Direct Sofascore API probing through the `soccerdata` TLS client found working `unique-tournament/{id}/seasons` endpoints for national-team competitions that matter:

| Competition | Sofascore uniqueTournamentId | Evidence Found |
| --- | ---: | --- |
| FIFA World Cup | `16` | Historical seasons from 1982 through 2026 surfaced. |
| UEFA European Championship | `1` | Historical seasons from 1980 through 2024 surfaced. |
| Africa Cup of Nations | `270` | Seasons from 2010 through 2025 surfaced. |
| Copa America | `133` | Seasons from 2007 through 2024 surfaced. |
| AFC Asian Cup | `246` | Seasons from 2011 through 2027 surfaced. |
| CONCACAF Gold Cup | `140` | Seasons from 2009 through 2025 surfaced. |
| UEFA Nations League | `10783` | Seasons from 2018/19 through 2026/27 surfaced. |

Sample event probes also returned round and event data for:

* AFCON 2023
* Copa America 2024
* CONCACAF Gold Cup 2025

AFC Asian Cup probing initially selected the latest 2027 season, which is future-dated. Implementation must select completed seasons only.

### 2.3 `soccerdata.Sofascore` Limitation

The installed `soccerdata` Sofascore reader uses `config/default-unique-tournaments/EN/football` in `read_leagues()`. That default list is narrower than the direct tournament endpoints. Therefore:

* Adding a custom `league_dict.json` may not be sufficient by itself.
* The implementation plan should prefer a small direct tournament-id discovery adapter or script for Phase 8.6B.
* Any later integration into the main dataset must remain registry-driven and competition-agnostic.

### 2.4 Bookmaker/Odds Baseline Facts

Sofascore schedule data in the installed package returns fixture and score fields, not bookmaker odds. It can help with more fixtures, but it does not solve the bookmaker baseline gap.

Current odds discovery constraints:

* The Odds API documents a historical odds endpoint, but historical odds are paid-plan only and only cover snapshots from 2020 onward.
* Football-Data.co.uk provides historical results and odds CSVs, but the current `soccerdata.MatchHistory` league list in this repo is club-league only.
* API-Football odds and coverage must be checked against current docs before any owner decision; no API key, paid plan, or secret is approved by this phase.

---

## 3. Goals

1. Produce a provider discovery report for these national-team competitions:
   * FIFA World Cup
   * UEFA European Championship
   * Africa Cup of Nations
   * Copa America
   * AFC Asian Cup
   * CONCACAF Gold Cup
   * UEFA Nations League
2. Prototype direct Sofascore tournament-id schedule discovery without relying on `available_leagues()`.
3. Prove whether each target competition can produce completed fixtures with:
   * stable competition id
   * stable season id
   * match id
   * kickoff timestamp
   * home team
   * away team
   * final score
   * finished status
4. Produce a quality-gate report that separates:
   * discovered competitions
   * usable completed seasons
   * unusable/future/incomplete seasons
   * rejected matches with reason
5. Produce an odds-baseline discovery report that clearly states whether a real bookmaker-implied baseline is available under current owner-approved constraints.

---

## 4. Non-Goals

* Do not merge Sofascore fixtures into the main training dataset during Phase 8.6B.
* Do not select a model.
* Do not create runtime prediction endpoints.
* Do not create ONNX/model artifacts.
* Do not add betting recommendations, stake sizing, ROI, CLV, Kelly, bankroll logic, or wagering integrations.
* Do not add club competitions.
* Do not add API keys, secrets, paid subscriptions, or production provider clients.
* Do not fake bookmaker odds with simple frequency, Elo, or model probabilities.

---

## 5. Proposed Design

### 5.1 Sofascore Discovery Layer

Create a discovery-only path that reads an explicit registry of candidate Sofascore national-team tournaments. The registry must contain local project competition ids and Sofascore tournament ids, not hard-coded provider ids scattered through scripts.

The first implementation plan should use a focused script that:

1. Loads the candidate registry.
2. Fetches seasons from `unique-tournament/{id}/seasons`.
3. Filters to completed or past seasons only.
4. Fetches rounds and round events for a small proof set.
5. Emits a JSON report under `apps/local-ai/reports/`.

This should not mutate the existing processed World Cup/Euro dataset.

### 5.2 Quality Gate

A competition is **usable for future ingestion planning** only if the discovery report proves:

* at least two completed seasons are available, except World Cup/Euro where historical coverage is already known through FBref;
* at least one completed season has event rows;
* completed event rows have non-empty home/away team names;
* completed event rows have full-time scores;
* future seasons are detected and excluded;
* the report counts rejected events by reason;
* no club competition is included.

If a competition fails any gate, it remains a discovery candidate and must not be enabled in the main dataset registry.

### 5.3 Chronological Split Readiness

Phase 8.6B should not finalize train/validation/test splits, but it must report whether each competition has enough completed seasons for a future chronological split.

Recommended readiness categories:

| Category | Meaning |
| --- | --- |
| `ready_for_ingestion_plan` | Enough completed seasons and completed events exist for a future Phase 8.6C ingestion plan. |
| `needs_manual_mapping_review` | Fixtures exist, but team naming or ids need review before ingestion. |
| `insufficient_completed_history` | Not enough completed seasons or events. |
| `blocked_by_provider_error` | Endpoint errors, schema changes, or rate limits block reliable discovery. |
| `blocked_by_scope` | Not national-team scope or not owner-approved. |

### 5.4 Odds Baseline Discovery

Odds discovery must be separated from fixture discovery.

Phase 8.6B should produce an odds source matrix:

| Source | Discovery Question | Accept/Reject Rule |
| --- | --- | --- |
| The Odds API | Does it cover historical match odds for target competitions under an owner-approved free or trial path? | Reject for current implementation if paid-only, key-required, or unavailable for target competitions. |
| API-Football | Does it expose historical 1X2 pre-match odds for target national-team competitions within free-tier constraints? | Reject if coverage cannot be verified without keys or if quota/cost is incompatible with owner-only free-tier scope. |
| Football-Data.co.uk / `MatchHistory` | Are national-team tournament odds available in CSV form? | Reject for national-team Phase 8 if only club divisions are available. |
| Sofascore | Does the current accessible path include bookmaker odds? | Reject unless direct evidence shows odds fields suitable for pre-match 1X2 implied probability. |

The report must distinguish:

* `bookmaker_baseline_available_now`
* `bookmaker_baseline_possible_with_paid_or_keyed_provider`
* `bookmaker_baseline_unavailable_under_current_constraints`

---

## 6. Expected Outputs

Phase 8.6B implementation should produce:

1. `apps/local-ai/config/sofascore-national-team-discovery.json`
2. `apps/local-ai/src/data/sofascore-national-team-discovery.ts`
3. `apps/local-ai/src/data/sofascore-national-team-discovery.test.ts`
4. `scripts/phase8-sofascore-national-team-discovery-verify.ts`
5. `scripts/phase8-sofascore-national-team-discovery-verify.test.ts`
6. `apps/local-ai/reports/phase-8-6b-sofascore-national-team-source-discovery.json`
7. `apps/local-ai/reports/phase-8-6b-odds-baseline-source-discovery.json`
8. `docs/data/PHASE-8-6B-SOFASCORE-NATIONAL-TEAM-SOURCE-DISCOVERY.md`

Exact files may change in the implementation plan if the existing codebase offers a better local pattern, but the outputs above define the expected evidence surface.

---

## 7. Verification Requirements

The implementation plan must include TDD slices and run:

```bash
pnpm exec vitest run apps/local-ai/src/data scripts/phase8-sofascore-national-team-discovery-verify.test.ts
pnpm run verify:lifecycle
pnpm run phase8:sofascore-national-team-discovery
git diff --check
```

If the implementation touches shared evaluation or candidate model code, it must also run:

```bash
pnpm run phase8:evaluation-harness
pnpm run phase8:candidate-bakeoff
```

This phase does not require `pnpm run test:integration` because it is discovery/reporting, not a full runtime boundary.

---

## 8. Exit Criteria

Phase 8.6B can close only when:

1. Every target competition has a discovery status.
2. AFCON, Copa America, AFC Asian Cup, CONCACAF Gold Cup, and UEFA Nations League are explicitly reported as usable or rejected with evidence.
3. The report identifies future seasons and excludes them from usable completed-history counts.
4. The odds-baseline report clearly states whether bookmaker baseline is available under current owner-approved constraints.
5. The project plan states whether Phase 8.6C should be dataset ingestion, odds-provider decision, or no further model-selection work.

---

## 9. Owner Decisions Needed After Phase 8.6B

| Decision | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| If Sofascore discovery succeeds, should Phase 8.6C ingest AFCON/Copa/Asian Cup/Gold Cup into the offline dataset? | Yes, but only for completed men's senior national-team tournaments that pass the quality gate. | This expands national-team evidence without jumping to club competitions. | Moving to club data too early breaks the national-team-first path and changes the model domain. |
| Should UEFA Nations League be included? | Include only if the quality report shows enough completed seasons and stable team coverage; otherwise keep it as secondary. | It is national-team data, but format and incentives differ from major tournament finals. | Mixing it blindly can distort model behavior and evaluation. |
| Should Women's World Cup be mixed into the same aggregate dataset? | No; keep it as a separate future dataset unless the owner explicitly approves a women's competition track. | It is valid national-team football, but it is a different competitive domain. | Mixing domains can inflate sample count while reducing model interpretability. |
| Should paid/keyed odds providers be used for historical bookmaker baselines? | No for Phase 8.6B; produce evidence first and require a separate owner decision if paid/keyed access is the only viable path. | Current guardrails do not approve secrets, paid plans, or live provider integration. | Adding keys or paid access inside discovery creates governance and cost drift. |

---

## 10. Recommended Next Phase

After owner approval of this spec, the next lifecycle command should be:

```text
phase:implementation-plan Phase 8.6B Sofascore National-Team Source Discovery and Odds Baseline Discovery
```

Do not return to model selection until Phase 8.6B evidence is complete and ADR-0041 is updated or superseded.
