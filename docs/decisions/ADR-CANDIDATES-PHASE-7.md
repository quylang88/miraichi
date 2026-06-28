# Phase 7 Candidate ADRs

This document compiles the candidate Architectural Decision Records (ADRs) for Phase 7 (Real Data Provider, Dataset, and Evaluation Planning). These candidates must be reviewed, finalized, and approved before implementing live data feed pollers, dataset generation pipelines, or evaluation frameworks.

Standalone draft files have been created for owner review:
* [ADR-0035-real-data-provider-selection-and-integration-strategy-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0035-real-data-provider-selection-and-integration-strategy-draft.md)
* [ADR-0036-world-cup-fixture-coverage-competition-agnostic-adapter-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0036-world-cup-fixture-coverage-competition-agnostic-adapter-draft.md)
* [ADR-0037-dataset-boundaries-and-schema-for-prediction-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0037-dataset-boundaries-and-schema-for-prediction-draft.md)
* [ADR-0038-prediction-evaluation-criteria-and-metrics-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0038-prediction-evaluation-criteria-and-metrics-draft.md)
* [ADR-0039-provider-adapter-contract-and-data-validation-schema-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0039-provider-adapter-contract-and-data-validation-schema-draft.md)
* [ADR-0040-model-readiness-gates-and-deployment-governance-draft.md](file:///c:/CODE/miraichi/docs/decisions/ADR-0040-model-readiness-gates-and-deployment-governance-draft.md)

---

## ADR-0035: Real Data Provider Selection and Integration Strategy

* **Status**: Candidate
* **Date**: 2026-06-28

### Problem
Miraichi requires a reliable sports data provider to ingest real fixtures, historical results, live lineups, match statistics, and historical/live odds feeds. We need a source that balances tournament coverage, API stability, and developer-tier accessibility.

### Options
* **Option A**: Direct scraping/parsing of bookmaker sites and sports directories.
* **Option B**: Integrate with API-Football (RapidAPI) as the main feed provider.
* **Option C**: Integrate with alternative APIs such as football-data.org (which has a narrower coverage) or TheOdds-API (which lacks detailed match statistics and lineups).

### Recommended Direction
**Option B**. API-Football is recommended as the candidate provider for owner review, not accepted as the production provider. Current planning assumes API-Football may provide broad football coverage, match statistics, lineups, and live/pre-match odds feeds, but quota and coverage claims must be rechecked against official provider pages before acceptance. If accepted for development, the adapter must implement local filesystem caching to reduce rate-limit pressure and allow repeatable mock testing without API calls.

### Risks
* API format updates or schema changes from the provider could break the parser.
* RapidAPI platform latency or downtime might delay odds updates.
* Dependency on a specific RapidAPI subscription plan if query volumes increase.

### Open Questions
* How to smoothly transition from the free tier to a paid production tier as traffic scales without rewriting integration code.
* What strategy we should use to handle concurrency limits when executing bulk historical data ingestion.
* Whether current official provider pricing, quota, and coverage pages still match the assumptions in [phase-7-planning.md](file:///c:/CODE/miraichi/docs/data/phase-7-planning.md).

### What It Must Not Decide Yet
* Production API keys and credentials.
* Paid billing levels or budget limits.
* Subscription contracts or vendor agreements.

---

## ADR-0036: FIFA World Cup Fixture Source Coverage & Competition-Agnostic Adapter Design

* **Status**: Candidate
* **Date**: 2026-06-28

### Problem
The immediate priority for Miraichi is to cover the FIFA World Cup fixtures, statistics, and odds. However, the system's design must remain competition-agnostic to support other leagues (e.g., Premier League, UEFA Champions League) in the future without duplicating parser code or routing logic.

### Options
* **Option A**: Write World Cup-specific parser scripts, database tables, and routes.
* **Option B**: Model a generic ingestion pipeline and map the World Cup using a dynamic registry configuration.

### Recommended Direction
**Option B**. Use API-Football's generic league and fixture endpoints via a unified parser adapter if the provider is later accepted. The parser should normalize incoming payloads into standard internal structures, specifically `NormalizedMatch` and `NormalizedMarket` shapes. The World Cup competition ID (e.g., league ID `1` for World Cup) and season identifier must not be hardcoded in TypeScript files; instead, they should be supplied via environment variables or dynamic registry configuration approved in a later implementation plan.

### Risks
* Differences in cup-specific tournament rules (such as extra time, penalty shootouts, and neutral venues) may require custom metadata fields in the normalized schemas.
* Unexpected variations in how the provider represents international tournaments vs domestic club leagues.

### Open Questions
* How should we handle team name variations (e.g., "Vietnam" vs "Viet Nam") across different sports data providers and bookmakers?
* Should the future registry configuration or store support multiple active seasons for the same tournament?

### What It Must Not Decide Yet
* Specific database schemas or table indexes for the registry.
* Exact environment variable key names and production configuration values.

---

## ADR-0037: Dataset Boundaries & Schema for Prediction

* **Status**: Candidate
* **Date**: 2026-06-28

### Problem
Constructing training datasets for the prediction engines requires compiling historical fixtures, match statistics, lineups, and odds. We need a standardized workflow to build and store these datasets that prevents data leakage and ensures training runs are reproducible.

### Options
* **Option A**: Train models by querying raw JSON database tables on the fly at runtime.
* **Option B**: Extract structured feature vectors and save them as static dataset files (e.g., CSV or JSON Lines) in partitioned local directories.

### Recommended Direction
**Option B**. Extract and compile feature vectors offline, then save them as static dataset files in chronological folders under `apps/local-ai/data/datasets/`. Perform feature engineering (rolling average stats, goal differentials, head-to-head records) ahead of model training. Evaluating and training models on static, versioned datasets ensures reproducibility and isolates model R&D from changes in the operational database.

### Risks
* Accumulating static datasets over many seasons may require substantial local or cloud storage.
* Feature definitions might drift if the schemas in `packages/shared` change without a dataset migration pipeline.

### Open Questions
* Should we adopt binary formats like Parquet or embedded databases like SQLite for larger datasets in the future?
* What versioning scheme should we use to tag datasets (e.g., semantic versioning vs date-based folders)?

### What It Must Not Decide Yet
* The final list of features or mathematical rolling calculation formulas.
* Storage providers or hosting services for historical datasets.

---

## ADR-0038: Prediction Evaluation Criteria & Metrics

* **Status**: Candidate
* **Date**: 2026-06-28

### Problem
To evaluate probabilistic predictions, traditional classification metrics like raw accuracy (win/draw/loss counts) are insufficient. They do not measure probability calibration or risk. We need an evaluation methodology that quantifies how well the model predicts actual probabilities compared to historical outcomes and bookmaker odds.

### Options
* **Option A**: Evaluate prediction models based solely on outcome prediction accuracy (win/draw/loss success rate).
* **Option B**: Evaluate prediction models using Brier Score and Expected Calibration Error (ECE) compared to the bookmaker odds baseline.

### Recommended Direction
**Option B**. Evaluate probabilistic forecasts using Brier Score (to measure overall mean squared error of probability forecasts) and Expected Calibration Error (to measure whether predicted probabilities match real-world frequencies). We will compare these metrics against a baseline derived from implied bookmaker odds, normalized to sum to 1.0 (with the bookmaker's overround margin removed via normalization techniques).

### Risks
* Tournaments with a small number of total matches, like the World Cup, have high statistical variance which can skew calibration evaluation.
* Normalizing bookmaker odds with simple proportional normalization may not perfectly represent the true market probabilities.

### Open Questions
* Do we need to weight recent matches higher when evaluating rolling calibration for club football?
* What minimum number of matches is required to establish statistical confidence in ECE?

### What It Must Not Decide Yet
* The exact threshold values for final model acceptance.
* Specific betting strategy criteria, bankroll allocation formulas, or Kelly Criterion coefficients.

---

## ADR-0039: Provider Adapter Contract & Data Validation Schema

* **Status**: Candidate
* **Date**: 2026-06-28

### Problem
API responses from third-party sports providers are external to our codebase and can change without warning or contain corrupt values (e.g., negative odds, zero scores, missing fields). Ingesting invalid data without strict validation leads to runtime failures and inaccurate predictions.

### Options
* **Option A**: Accept and store raw payloads directly in the database, deferring data validation to the prediction runtime.
* **Option B**: Enforce strict data validation schemas at the provider adapter parser boundary.

### Recommended Direction
**Option B**. Define and enforce Zod validation schemas in `packages/shared/src/contracts` at the parser boundary. The adapter must validate incoming payloads and filter out corrupt or anomalous records (e.g., decimal odds less than or equal to 1.0, negative match goals, or missing timestamps) before normalization. The parser should throw structured validation errors for corrupt payloads while logging issues.

### Risks
* Overly strict schemas might drop valid data during extreme market events or format updates.
* Running full validation checks on large historical batches might introduce CPU bottlenecks during initial ingestion.

### Open Questions
* How should we handle missing minor fields gracefully without failing or dropping the entire batch import?
* Should we store invalid raw payloads in a dead-letter cache for debugging?

### What It Must Not Decide Yet
* The specific logging system configuration or error alerting tools (e.g., Sentry integration details).
* The recovery workflow scripts for failed imports.

---

## ADR-0040: Model-Readiness Gates & Deployment Governance

* **Status**: Candidate
* **Date**: 2026-06-28

### Problem
To protect the integrity of recommendations, we must establish strict, objective gates to prevent uncalibrated, unprofitable, or overfitted models from being deployed to production.

### Options
* **Option A**: Rely on manual code reviews and developer verification to promote model files.
* **Option B**: Enforce automated model-readiness verification gates based on out-of-sample Test Set performance.

### Recommended Direction
**Option B**. A candidate model must pass owner-approved automated gates on an out-of-sample test set before it can be marked as ready for recommendation usage. Candidate thresholds for owner review:
1. **Accuracy/Error Gate**: The model's Brier score should be at least 1% lower than the bookmaker odds baseline.
2. **Data Sufficiency Gate**: The model should be tested and evaluated on at least 100 historical out-of-sample fixtures.
3. **Calibration Gate**: The model's Expected Calibration Error (ECE) should be strictly under 5%.

### Risks
* Strict gates might slow down the development lifecycle if initial model architectures struggle to beat the bookmaker baseline.
* The 100-match minimum might be difficult to satisfy for niche leagues or short tournaments without pooling historical datasets across seasons.

### Open Questions
* Who has the authority to approve promoting a model to production if it passes all automated gates?
* Should we track separate calibration gates for different market types (e.g., 1X2 vs Over/Under)?
* Should the proposed 1% Brier improvement, 100-match sample, and ECE < 5% thresholds be accepted, revised, or kept as draft-only R&D gates?

### What It Must Not Decide Yet
* The production model hosting platform (e.g., Hugging Face, local model registry).
* The specific deployment pipelines, container images, or CI/CD deployment jobs.
