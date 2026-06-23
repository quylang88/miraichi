# ADR-0014: Data Provider Abstraction and Source Selection Criteria

* **Status**: Draft
* **Date**: 2026-06-23
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started

---

## 1. Context
Miraichi must ingest match fixtures and odds feeds from external sports data feeds. Direct coupling to a specific provider's API structure makes it difficult to change vendors or support multiple data sources.

## 2. Options Considered
* **Option A**: Direct integration with a specific provider's API payloads directly inside the worker scheduler.
* **Option B (Recommended)**: Define a strict provider parser adapter interface that isolates external API schemas from core logic.
* **Option C**: Centralized caching proxy service to fetch, normalize, and serve the feeds.

## 3. Decision & Recommendation
Recommend **Option B**. Define a provider parser adapter interface in `packages/shared` or `apps/worker`. Individual parsers map incoming feed payloads (e.g. hypothetical vendor examples `ProviderAlphaAdapter` or `ProviderBetaAdapter`) into the internal generic football model. No specific external provider is selected or integrated in Phase 3.

## 4. Consequences
* Adding a new provider only requires writing a new parser adapter, leaving the downstream poller and prediction logic untouched.
* The system remains highly testable through mock adapters (e.g. `MockProviderAdapter`) reading local files.
* Introduces a small overhead of writing normalization mapping code.

## 5. Risks
* Variations in vendor features (e.g., updates frequency, support for webhooks) might require extending the adapter interface.
* Over-engineering the abstraction layer if the project remains locked to a single data vendor.

## 6. Open Questions
* Which sports API provider meets our requirements for cost, reliability, historical odds, and data granularity?
* Should we use a polling mechanism or purchase a plan with webhook support?

## 7. Explicit Exclusions
* This decision does NOT select the final production sports data API vendor.
* No live network HTTP requests or API credential keys will be configured.
