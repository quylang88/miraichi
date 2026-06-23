# Phase 4.2 Mock Local AI Prediction Pipeline Plan

* **Date**: June 23, 2026
* **Status**: **Draft**

---

## 1. Context & Objectives
This plan outlines the architecture for the **Mock Local AI Prediction Pipeline** (Phase 4.2). The mock pipeline validates data propagation, schema contract integration, and natural language explanation flows downstream from `apps/worker` and `apps/api` to `apps/local-ai`, without deploying any prediction models or actual machine learning runtimes.

---

## 2. Integration Pipeline Flow
The mock pipeline is designed around three main stages:

1. **Input Reception**:
   * The local AI service receives standard `inputCandidate` snapshot payloads (containing match fixtures, odds, and metadata) from the ingestion layers.
2. **Mock Inference**:
   * The mock prediction engine validates that the payload contains required identifiers (`inputCandidateId`, `matchId`, etc.).
   * By default, it runs in a safe fallback mode, returning a standard, traceable prediction envelope.
3. **LLM Explanation & Refusal**:
   * The mock explanation engine reads the prediction envelope.
   * If predictions are unavailable, it returns a deterministic refusal message. Otherwise, it generates a mock translation of the output.

---

## 3. Pluggable Algorithm Architecture
To ensure future algorithms can be plugged in later without rewriting interface layers:
* The prediction execution block is wrapped behind a generic prediction strategy interface.
* Implementing new algorithms (e.g. classifier weights, neural nets) will require creating a new strategy class.
* **CRITICAL**: Swapping mock strategies for active statistical models requires a specific, owner-approved ADR and must not be done during early scaffolding.

---

## 4. Strict Scoping & Exclusions
* **No Prediction Calculations**: No probability models, neural nets, regression algorithms, or heuristic classifications.
* **No Betting/Bankroll Rules**: No wagers, stakes, daily risk limits, or bankroll adjustments.
* **No External LLM Runtimes**: All explanation outputs are returned as static mock text payloads. No connection to OpenAI, Anthropic, Gemini, or local GGUF/ONNX instances is authorized.
