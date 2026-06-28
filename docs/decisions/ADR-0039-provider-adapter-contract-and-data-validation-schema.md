# ADR-0039: Provider Adapter Contract and Data Validation Schema

* **Status**: Accepted
* **Date**: 2026-06-28
* **Accepted Date**: 2026-06-28
* **Owner Approval Required**: Yes
* **Owner Approval**: Approved by project owner
* **Implementation Status**: Not started
* **Source Candidate**: [ADR-CANDIDATES-PHASE-7.md](file:///c:/CODE/miraichi/docs/decisions/ADR-CANDIDATES-PHASE-7.md)
* **Note**: This accepted ADR defines validation boundaries only. It does not approve dependency installation or provider integration code.

---

## 1. Context
Third-party sports data can be incomplete, malformed, stale, or internally inconsistent. Invalid fixtures, scores, timestamps, or odds can corrupt datasets and evaluation reports.

## 2. Options Considered
* **Option A**: Store raw payloads and defer validation to prediction runtime.
* **Option B (Accepted)**: Validate provider payloads at the parser boundary before normalization and dataset generation.

## 3. Decision
Accept **Option B**.

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

## 8. Acceptance Notes
Accepted by the project owner on 2026-06-28 as a Phase 7 validation-boundary decision only. This decision authorizes parser-boundary validation requirements and dead-letter evidence planning. It does not approve package installation, live provider adapter code, logging vendors, production database schema, or import recovery scripts.
