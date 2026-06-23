# Phase 3.4 Data Ingestion Integration Plan

* **Status**: Draft
* **Date**: 2026-06-23

---

## 1. Overview
Outlines the integration boundary plan mapping mock ingestion outputs to API exposure endpoints and future Local AI statistics inputs for Phase 4.

---

## 2. Ingestion Integration Boundaries

### Worker Mock Ingestion Output
* Processes raw local JSON mock files via provider-agnostic parser adapters.
* Normalizes data into `NORMALIZED_MATCH_CONTRACT` and `NORMALIZED_MARKET_CONTRACT` structures.
* Stores accepted records in a volatile memory-only repository singleton.
* Logs run metadata reports conforming to `INGESTION_RUN_CONTRACT`.

### API Exposure
* Exposes `/api/v1/matches`: A generic list of current active matches.
* Exposes `/api/v1/ingestion/status`: In-memory run reports containing job status metrics.
* Exposes no SQL tables, database connections, or cache invalidation events.

### Future Local AI Consumption (Phase 4 Input Candidates)
* The `apps/local-ai` statistics processor consumes match and odds feed structures via API gateway HTTP client requests during inference loops.
* Feeds serve as input candidates containing the necessary features (odds, fixtures history) to evaluate predictive outcomes.

---

## 3. Data Classification: Internal vs. Web Surfaced

### Internal-Only Data
* Raw provider adapter payloads (e.g. JSON fixtures arrays).
* Ingestion validator warning lists and rejected record errors.
* Detailed job execution timestamps and worker logs.

### Web-Surfaced Data (Generic Console Only)
* Normalized match lists containing competing generic tags.
* Active odds selection tables (e.g. 1X2 choice odds).
* Ingestion status runs success logs.

---

## 4. Owner-Decision Gating
Any transition from this mock integration design to production components requires owner-approved ADRs:
* Choosing a production database store (SQL or NoSQL).
* Selecting and integrating a live sports data provider API.
* Defining statistical scoring algorithms or risk control settings.
