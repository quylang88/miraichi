# Phase 5.10 Add Bet Draft/Form State and Persistence Planning

* **Status**: Active Planning
* **Date**: 2026-06-27
* **Phase**: 5.10

This document starts Phase 5.10 as a planning-only phase for Add Bet draft state, form-state contracts, and local-first persistence boundaries. It does not implement storage, forms, calculations, APIs, schemas, or runtime user flows.

---

## 1. Purpose

Phase 5.10 prepares the next implementation boundary after the completed Phase 5.9 production PWA shell.

The phase must answer these questions before any Phase 5.11 code slice starts:

* What type-only draft shape should represent an in-progress Add Bet entry?
* What form-state shape should track touched fields, warnings, draft validity, and review readiness?
* What persistence adapter boundary should protect future local-first storage work?
* What backup envelope should future export/import flows use?
* Which failure states must be planned before writing IndexedDB, import, or export code?

---

## 2. Source Decisions

Phase 5.10 is constrained by these accepted boundaries:

* `ADR-0023`: user-entered real bet record boundary.
* `ADR-0024`: match-centric betting history grouping.
* `ADR-0025`: market catalog and line preset registry.
* `ADR-0026`: HK-only visible odds format for first implementation.
* `ADR-0031`: five-tab PWA betting journal UX boundary.
* `ADR-0033`: local-first betting data persistence and backup boundary.
* `ADR-0034`: TypeScript adoption and typed domain contracts boundary.

Accepted ADRs authorize planning and bounded implementation only where a later implementation plan explicitly says so. They do not authorize formulas, prediction algorithms, real provider integrations, cloud sync, account systems, or production database schemas.

---

## 3. Add Bet Draft Boundary

The future draft contract should represent user input before it becomes a saved bet record.

Recommended type-only contract fields:

| Field | Planning intent | Boundary |
| :--- | :--- | :--- |
| `draftId` | Client-generated draft identifier. | Not a persisted bet ID. |
| `matchGroupId` | Source-of-truth match grouping reference from ADR-0024. | Do not infer final teams from free text. |
| `marketType` | One accepted v1 market or custom market. | Must not encode settlement behavior. |
| `customMarketLabel` | Free-text label when market type is custom. | Metadata only. |
| `lineValue` | User-entered line when relevant. | Non-0.25 values may warn only. |
| `oddsFormat` | Visible first implementation format. | HK-only unless a later ADR expands it. |
| `oddsValue` | Raw odds entry for the selected format. | No conversion formula in Phase 5.10. |
| `stakePoints` | User-entered stake points candidate. | No bankroll or risk calculation. |
| `notes` | Optional user notes. | Metadata only. |
| `tags` | Optional user labels. | Metadata only. |
| `createdAt` | Draft creation timestamp. | Use UTC timestamp planning language. |
| `updatedAt` | Last draft update timestamp. | Use UTC timestamp planning language. |

The draft contract must stay separate from the final saved bet envelope. A future code slice may transform a valid draft into a saved record only after an implementation plan defines the exact mapper and tests.

---

## 4. Form State Boundary

The future form-state contract should describe UI interaction state without becoming business logic.

Recommended type-only form-state fields:

| Field | Planning intent | Boundary |
| :--- | :--- | :--- |
| `activeStep` | Current Add/Edit/Review surface or form step. | UI state only. |
| `dirtyFields` | Field names changed by the user. | No validation formulas. |
| `touchedFields` | Field names the user has visited. | UI state only. |
| `warnings` | Warning-only messages keyed by field. | Warnings must not hard-block save unless later approved. |
| `blockingErrors` | Technical errors that prevent draft review, such as missing required fields. | Must not encode bankroll/risk rules. |
| `reviewReady` | Whether the draft can move to review UI. | Based on structural completeness only. |
| `lastSavedAt` | Future autosave timestamp, if persistence is approved later. | Do not implement autosave in Phase 5.10. |

The key rule is strict: structural form completeness is allowed; betting calculations, risk decisions, bankroll limits, odds conversion, and settlement logic are not allowed.

---

## 5. Local-First Persistence Planning Boundary

Phase 5.10 may plan the future persistence adapter but must not implement it.

Future persistence adapter capabilities to plan:

| Capability | Future purpose | Phase 5.10 boundary |
| :--- | :--- | :--- |
| `saveDraft` | Store one Add Bet draft locally. | Plan interface only. |
| `loadDraft` | Read one draft by ID. | Plan interface only. |
| `listDraftsByMatch` | Find drafts for a match group. | Plan interface only. |
| `deleteDraft` | Remove abandoned draft state. | Plan interface only. |
| `saveBetRecord` | Persist a finalized user-entered bet. | Deferred to Phase 5.11+. |
| `exportBackup` | Create JSON backup payload. | Plan envelope only. |
| `importBackup` | Restore from JSON backup payload. | Plan failure states only. |

IndexedDB remains the preferred future local-first persistence option under ADR-0033. Phase 5.10 must not create IndexedDB code, object stores, schema migrations, storage libraries, service-worker sync, auth, cloud sync, database clients, or production schemas.

---

## 6. Backup Envelope and Import/Export Failure States

Future backup payloads should be versioned and explicit.

Recommended backup envelope planning shape:

| Field | Planning intent |
| :--- | :--- |
| `schemaVersion` | Version for future import compatibility checks. |
| `exportedAt` | UTC timestamp for backup creation. |
| `sourceApp` | Static app identifier for future diagnostics. |
| `records` | Future saved bet records. |
| `drafts` | Optional in-progress drafts if later approved. |
| `settings` | Optional shell/app settings if later approved. |

Future import/export failure states to plan before implementation:

* Unsupported `schemaVersion`.
* Malformed JSON.
* Missing required envelope fields.
* Record-level structural validation failure.
* Duplicate record identity.
* Partial import conflict.
* User cancellation before commit.
* Storage quota exceeded.
* Browser storage unavailable.

No import, export, parser, validator, or storage code is authorized in Phase 5.10.

---

## 7. Explicit Exclusions

Phase 5.10 must not add:

* IndexedDB implementation.
* `localStorage` betting-history persistence.
* Export/import runtime code.
* Autosave runtime code.
* API endpoints.
* Database clients, ORMs, schemas, migrations, or seed files.
* Auth, cloud sync, or account systems.
* Betting calculations.
* Settlement formulas.
* Odds conversion formulas.
* ROI, yield, CLV, bankroll, stake-sizing, Kelly, or risk formulas.
* AI recommendation logic, ranking, confidence claims, or stake advice.
* Prediction algorithms or model-training logic.
* Real provider integrations.
* Hard-coded real competitions, teams, leagues, or tournaments.

---

## 8. TypeScript Migration Backlog

Phase 5.10 should keep future implementation TypeScript-first without forcing a full migration.

Recommended migration order:

1. Add new Add Bet draft/form-state contracts as `.ts` files only after owner-approved implementation planning.
2. Add future persistence adapter contracts as `.ts` files before any storage code.
3. Keep new shared config, validators, and pure domain helpers TypeScript-first.
4. Migrate touched web shell helpers only when the change already requires editing them.
5. Leave existing API, local-ai, worker, package runtime bridges, service worker files, and scripts in JavaScript until a focused migration slice is approved.

Do not run a bulk JS-to-TS migration. It would create a large regression surface without advancing Phase 5.10 planning.

---

## 9. Phase 5.10 Exit Criteria

Phase 5.10 can close only when:

* Add Bet draft and form-state planning boundaries are documented.
* Local-first persistence adapter boundaries are documented.
* Backup envelope and import/export failure states are documented.
* Docs status hygiene review is recorded.
* TypeScript migration policy is explicit in lifecycle and guardrail docs.
* Readiness review confirms no storage, formulas, schemas, APIs, or runtime Add Bet implementation started.

After Phase 5.10 closes, Phase 5.11 may be proposed as a separate owner-approved local-first persistence implementation plan.
