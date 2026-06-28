# ADR-0039: Provider Adapter Contract and Data Validation Schema

* **Status**: Draft - Owner Review Required
* **Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This draft defines validation boundaries only. It does not approve dependency installation or provider integration code.

---

## 1. Context
Third-party sports data can be incomplete, malformed, stale, or internally inconsistent. Invalid fixtures, scores, timestamps, or odds can corrupt datasets and evaluation reports.

## 2. Options Considered
* **Option A**: Store raw payloads and defer validation to prediction runtime.
* **Option B (Draft Recommended)**: Validate provider payloads at the parser boundary before normalization and dataset generation.

## 3. Draft Recommendation
Recommend **Option B**.

Define provider adapter validation schemas at the parser boundary. Zod is a reasonable candidate for runtime validation, but installing or wiring Zod must wait for an owner-approved implementation plan.

Validation should classify fields into critical required fields and optional warning fields. Critical record failures should reject or quarantine the affected record; optional missing fields should produce warnings without failing the whole batch.

## 4. Owner Decisions Required
| Question | Recommended Answer | Reason | Risk If Chosen Otherwise |
| --- | --- | --- | --- |
| How should missing minor fields be handled? | Define critical vs optional fields. Missing critical fields reject the record; missing optional fields emit warnings and preserve partial data. | Not every provider omission should kill a batch. | Overly strict validation drops usable data; overly loose validation corrupts datasets. |
| Should invalid raw payloads be stored in a dead-letter cache? | Yes, store local dead-letter records with payload path/hash, provider ID, validation reason, and timestamp. Redact secrets. | Debugging provider drift requires raw evidence. | Without dead-letter evidence, parser failures become hard to reproduce. |

## 5. Consequences
* Bad data is caught before it reaches normalized contracts.
* Provider drift becomes observable through structured validation errors.
* Dataset builds can report quality warnings instead of silently accepting corrupt inputs.

## 6. Risks
* Validation can become too strict and reject valid provider changes.
* Full validation may add CPU cost for large historical imports.
* Dead-letter retention needs a later storage and cleanup policy.

## 7. Explicit Exclusions
* No package installation is approved.
* No live provider adapter code is approved.
* No logging vendor, Sentry integration, or alerting system is approved.
* No production database schema or table index is approved.
* No import recovery script is approved.

## 8. Draft Readiness
This ADR is ready to become a draft. It is a guardrail-strengthening decision and does not require accepting a provider or model threshold.
