# Phase 8 Owner-Only Model R&D Plan

> **For agentic workers:** REQUIRED PROJECT SKILLS: read `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` and `.agent/skills/miraichi-project-guardrails/SKILL.md` before any planning or code work. If implementation begins, use `superpowers:test-driven-development` for each code slice. This document is a Phase 8 R&D roadmap, not authorization for production inference, betting recommendations, stake sizing, paid providers, public traffic, or model promotion.

**Goal:** Build a free, owner-only, evidence-first model research path that starts with World Cup and national-team competition datasets, then expands to club competitions only after the national-team path is reviewed.

**Architecture:** Phase 8 uses offline local data preparation and report generation first. Candidate models compete only after dataset provenance, leakage checks, chronological evaluation, and bookmaker/baseline comparisons exist. Runtime integration such as ONNX or `/ai/v1/predict` real inference is deferred until an owner-approved model-selection ADR proves a model is worth activating.

**Tech Stack:** TypeScript-first repository tooling, Python only for local offline data preparation and experiments, `soccerdata` for historical data snapshots, JSONL/CSV artifacts for R&D, Vitest/TypeScript verification for repo-owned logic. LightGBM, CatBoost, logistic regression, Elo/Poisson/Dixon-Coles, and XGBoost are candidate research options only, not preselected production choices.

---

## 1. Current Verdict

The previous ONNX-first plan is rejected as the default path.

Reasons:

1. It selected LightGBM before dataset quality and baselines existed.
2. It used random train/test splitting, which is unsafe for chronological football data.
3. It proposed a realtime production-style route before owner-only evaluation reports.
4. It risked hard-coding a league-specific training path instead of preserving competition-agnostic design.
5. It treated model packaging as urgent even though the real uncertainty is whether any candidate model beats simple and bookmaker-derived baselines.

Phase 8 must proceed as R&D, not as production inference work.

---

## 2. Phase 8 Subphases

### Phase 8.0: R&D Boundary Reset

**Lifecycle command:** `phase:plan Phase 8 Owner-Only Model R&D Boundary`

**Purpose:** Lock the scope before any training implementation starts.

**Allowed work:**

- Replace unsafe ONNX-first implementation assumptions with an owner-only R&D roadmap.
- Confirm that public prediction surfaces, production hosting, betting recommendations, stake advice, paid provider usage, and model promotion remain blocked.
- Record model candidates and selection gates.

**Exit gate:**

- Owner accepts this Phase 8 split.
- No code training begins in this subphase.

### Phase 8.1: Dataset Snapshot and Provenance

**Lifecycle command:** `phase:implementation-plan Phase 8.1 Dataset Snapshot and Provenance`

**Purpose:** Build reproducible offline historical datasets before model work.

**Allowed work:**

- Create local-only data snapshot scripts or adapters for `soccerdata`, starting with World Cup and related national-team competitions.
- Store raw snapshot metadata outside committed model artifacts unless a small sample fixture is needed for tests.
- Emit dataset metadata: `datasetId`, `schemaVersion`, `featureSpecVersion`, `sourceProviderId`, `sourceSnapshotHash`, `builtAt`, and chronological split metadata.
- Keep competitions configurable. World Cup and national-team metadata is allowed in registry/config/data; core logic must not branch on one tournament or club league.
- Do not start with EPL or another club league. Club competitions are expansion scope after national-team datasets, quality reports, leakage checks, and baseline evaluation exist.

**Exit gate:**

- Reproducible sample dataset exists.
- Data quality report lists source count, rejected records, missing critical fields, and warnings.
- Dataset build can run locally for the owner without paid APIs.

### Phase 8.2: Feature Spec and Leakage Audit

**Lifecycle command:** `phase:implementation-plan Phase 8.2 Feature Spec and Leakage Audit`

**Purpose:** Define features that can be calculated only from information available before prediction time.

**Allowed feature families:**

- Rolling form from prior matches only.
- Home/away split stats from prior matches only.
- Rest days and schedule density when source data supports it.
- Elo/Glicko-style rating features if versioned and test-covered.
- Pre-match odds-derived market baseline where odds are available before kickoff.
- Optional xG or shot-quality inputs only when source coverage and timestamp rules are explicit.

**Blocked feature families:**

- Full-time goals from the target match.
- Result labels leaking into features.
- Post-match odds movement when predicting pre-match.
- Hard-coded team, league, or tournament shortcuts.
- Betting ROI, stake sizing, Kelly, bankroll, or CLV logic.

**Exit gate:**

- Feature spec is versioned.
- Leakage tests fail on intentionally leaked fields and pass on approved fields.
- Feature generation is independent from model choice.

### Phase 8.3: Evaluation Harness and Baselines

**Lifecycle command:** `phase:implementation-plan Phase 8.3 Evaluation Harness and Baselines`

**Purpose:** Build the scoreboard before training candidate models.

**Required evaluation rules:**

- Use chronological split or rolling walk-forward evaluation.
- Report Brier Score, Expected Calibration Error, log loss, class accuracy, sample count, and calibration bin counts.
- Implement Brier Score, Expected Calibration Error, and log loss as pure TypeScript functions in `apps/local-ai`; do not add an external metrics library for these basic formulas.
- Make ECE binning, multiclass Brier definition, and log-loss epsilon clipping explicit and test-covered.
- Compare against a bookmaker-implied probability baseline when odds exist.
- When odds are missing, report missing bookmaker-baseline counts instead of treating missing odds as model evidence.
- Include non-market baselines: home/draw/away frequency, home-advantage prior, Elo/Poisson-style simple baseline.
- Treat ADR-0040 gates as non-blocking report indicators, not build blockers.
- Do not block harness construction on adding more competitions before Phase 8.3 starts. The current World Cup snapshot is enough to verify harness formulas and report plumbing.
- Do not treat World Cup-only metrics as reliable calibration evidence. Add related national-team competitions before Phase 8.4 candidate model bake-off or any serious model-selection claim.

**Exit gate:**

- A report can be generated without LightGBM or any advanced model.
- The report clearly shows whether a candidate beats simple baselines and bookmaker baseline.
- At least 100 out-of-sample fixtures are reported as a weak minimum for candidate review; more is required before trusting calibration.
- If the World Cup-only snapshot is below that minimum, the report must say so plainly and remain audit/plumbing evidence only.

### Phase 8.4: Candidate Model Bake-Off

**Lifecycle command:** `phase:implementation-plan Phase 8.4 Candidate Model Bake-Off`

**Purpose:** Choose a real model only after the evaluation harness exists.

**Candidate order:**

1. **Multinomial logistic regression with calibration**: first ML candidate because it is transparent, cheap, and hard to overfit compared with boosted trees.
2. **Elo or Glicko + logistic calibration**: strong football-specific baseline for team strength and form.
3. **Poisson or Dixon-Coles score model**: useful for football because it models goals and can derive 1X2 probabilities.
4. **LightGBM**: strong tabular candidate after baselines exist; fast and lightweight, but not automatically better.
5. **CatBoost**: candidate if team, competition, venue, and provider categorical features matter and preprocessing starts getting messy.
6. **XGBoost**: fallback boosted-tree candidate if LightGBM packaging or behavior is worse in local tests.

**Not recommended for v1 owner-only R&D:**

- Deep neural networks: too data-hungry and too easy to overfit.
- LLM-based prediction: wrong tool for calibrated probabilities.
- Reinforcement learning or bankroll agents: outside scope and unsafe.
- AutoML-first workflow: hides leakage and produces false confidence.

**Exit gate:**

- Candidate comparison report exists.
- No model is selected unless it is compared on the same chronological split.
- If no candidate beats the bookmaker baseline, the correct decision is "no real model selected yet."

### Phase 8.5: Owner-Only Experimental Report Surface

**Lifecycle command:** `phase:implementation-plan Phase 8.5 Owner-Only Experimental Report Surface`

**Purpose:** Make model evidence inspectable without exposing predictions as product recommendations.

**Allowed work:**

- Generate local Markdown/JSON reports.
- Optionally show an owner-only diagnostics view later, clearly marked as experimental.
- Display model version, dataset version, feature spec version, metrics, calibration bins, and known weaknesses.

**Blocked work:**

- No public prediction surface.
- No `engineMode: production`.
- No recommendation labels such as "best bet".
- No stake, bankroll, or ROI advice.

**Exit gate:**

- Owner can inspect model evidence.
- Report labels are experimental and cannot be confused with production readiness.

### Phase 8.6: Model Selection ADR

**Lifecycle command:** `phase:plan Phase 8.6 Model Selection ADR`

**Purpose:** Decide whether a model deserves activation.

**When this phase may start:**

- Phase 8.1 dataset provenance passes.
- Phase 8.2 leakage audit passes.
- Phase 8.3 baseline report exists.
- Phase 8.4 candidate report exists.
- The candidate model is compared against simple and bookmaker baselines on chronological out-of-sample data.

**Decision outcomes:**

- Select no model and continue R&D.
- Select a simple calibrated model for owner-only reporting.
- Select LightGBM/CatBoost/XGBoost only if it beats simpler candidates enough to justify complexity.
- Defer runtime packaging if batch reports are enough for one owner.

**Exit gate:**

- Owner approves the model-selection ADR.
- The ADR states whether the selected model is report-only, owner-only inference, or still blocked.

### Phase 8.7: Runtime Packaging, Optional

**Lifecycle command:** `phase:implementation-plan Phase 8.7 Optional Runtime Packaging`

**Purpose:** Package the chosen model only after selection evidence exists.

**Default for one owner/free usage:**

- Prefer offline batch report generation first.
- Do not add ONNX Runtime unless realtime TypeScript inference is actually needed.
- Do not commit large model artifacts unless the ADR explicitly approves artifact versioning rules.

**When ONNX becomes reasonable:**

- A selected model exists.
- The model must run in the TypeScript local-ai server.
- Python runtime at inference time is proven inconvenient.
- Model artifact size and dependency cost are acceptable.

**Exit gate:**

- Runtime packaging is verified by tests.
- Endpoint behavior remains owner-only/experimental unless a later production phase approves more.

---

## 3. When Real Model Training Starts

Real model training does not start at Phase 8.0.

The earliest safe point is Phase 8.4, after:

1. Dataset snapshots are reproducible.
2. Feature leakage is tested.
3. Chronological evaluation exists.
4. Simple and bookmaker baselines are reported.
5. Owner accepts the candidate model bake-off plan.

Before that point, any "training" should be treated as exploratory notebook/script work only, not as a selected Miraichi model.

---

## 4. Model Recommendation for Owner-Only Free v1

**Recommended default path:**

1. Start with bookmaker baseline and simple home/draw/away frequency.
2. Add Elo or Poisson/Dixon-Coles.
3. Add calibrated logistic regression.
4. Try LightGBM only after the above baselines exist.
5. Try CatBoost if categorical feature handling becomes a real pain.

**Current best practical bet:** not LightGBM first. Use calibrated logistic regression plus Elo/Poisson baselines first, then compare LightGBM.

**Why:** For one owner and free local usage, trust, leakage control, and calibration matter more than raw model complexity. A simple model that is traceable and calibrated is more useful than a boosted tree that looks impressive but fails against the market baseline.

---

## 5. Forbidden Shortcuts

- Do not replace `/ai/v1/predict` mock behavior with real predictions in Phase 8.0-8.5.
- Do not call any model `production`.
- Do not commit `.onnx`, `.pkl`, `.bin`, or large dataset files without an accepted artifact policy.
- Do not choose LightGBM, CatBoost, XGBoost, or ONNX before baseline reports exist.
- Do not use random train/test split for time-ordered football evaluation.
- Do not treat World Cup-only evaluation as statistically strong.
- Do not expand to club competitions before the World Cup/national-team dataset path has explicit owner review.
- Do not add betting recommendation, stake sizing, bankroll, ROI, CLV, or Kelly logic.

---

## 6. Recommended Next Command

Run:

```bash
phase:plan Phase 8 Owner-Only Model R&D Boundary
```

After owner accepts this split, the earliest implementation-planning command is:

```bash
phase:implementation-plan Phase 8.1 Dataset Snapshot and Provenance
```
