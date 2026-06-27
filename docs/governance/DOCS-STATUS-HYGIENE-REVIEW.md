# Docs Status Hygiene Review

* **Status**: Active Review
* **Date**: 2026-06-27

This review records the first status-hygiene pass after Phase 5.9. The goal is not to make the repository look cleaner; the goal is to make status labels tell the truth.

---

## 1. Current Problem

The repository still contains many documents marked `Draft`. That is not automatically wrong, but the label is currently overloaded.

Observed categories:

* Root docs that are actually living guidance.
* Phase reports that record completed work.
* ADR candidates that are intentionally not accepted.
* Old planning docs that may be superseded by later phase reports.
* App/package docs that remain draft because implementation is still evolving.
* Ops/deployment docs that should remain draft until Phase 6.

The bad fix would be mass-promoting these docs to `Accepted`. That would be dishonest because `Accepted` means owner-approved decision, not "reviewed once".

---

## 2. Status Recommendations

| Document group | Recommended status | Reason |
| :--- | :--- | :--- |
| Root phase and workflow docs | `Active` or `Active Governance` | They guide current work but are not ADR decisions. |
| Owner gates and status taxonomy | `Active Governance` | They define rules for the repo. |
| ADRs with owner approval | `Accepted` | They have decision authority. |
| ADR candidates and candidate reviews | Keep `Candidate`, `Proposed`, or `Draft` | They are not owner-approved decisions unless promoted separately. |
| Completed phase reports/reviews | `Completed`, `Completed - Verified`, or `Closed` | They record historical completion. |
| Older planning docs replaced by newer phase reports | `Superseded` | They should not compete with newer source-of-truth docs. |
| Package/app docs for evolving implementation | Keep `Draft` until reviewed against current code. | Premature acceptance would hide drift. |
| Ops/deployment docs | Keep `Draft` until Phase 6. | Deployment target and CI/CD decisions are not complete. |

---

## 3. Immediate Changes Applied

This pass updates only obvious high-level governance/current-phase files:

* `README.md` becomes `Active`.
* `PROJECT_PLAN.md` becomes `Active`.
* `ROADMAP.md` becomes `Active`.
* `WORKFLOW.md` becomes `Active Governance`.
* `CHANGELOG.md` becomes `Active Log`.
* New governance taxonomy uses `Active Governance`.
* Draft Phase 5.10 planning docs use `Proposed` and are not active until this hygiene work closes.

This pass intentionally avoids fake acceptance and uses targeted status classes.

---

## 4. Slice Results

| Slice | Result | Notes |
| :--- | :--- | :--- |
| Phase 1 docs | Completed | Phase 1 planning docs are `Closed`, review/report docs are `Completed`, and architecture guidance still in use is `Active`. |
| Phase 3 docs | Completed | Current data contracts and guardrails are `Active`; phase plans/reviews/reports are `Closed`, `Completed`, or `Completed - Verified`. |
| Phase 4 docs | Completed | Current local-ai contracts are `Active`; phase plans/reviews/reports are `Closed`, `Completed`, or `Completed - Verified`. |
| App/package docs | Completed | App and package module docs are `Active` because they guide current code boundaries; this does not mean owner decision acceptance. |
| Ops docs | Completed | Ops docs intentionally remain `Draft`, with `Review Status: Deferred until Phase 6 planning.` |

---

## 5. Remaining Drafts After Cleanup

The remaining intended `Draft` documents in the cleaned slices are:

* `docs/data/privacy-and-retention.md` because privacy/retention policy is not accepted for implementation.
* `ops/**` docs because Phase 6 testing/deployment planning is not active.

Any future reduction of these drafts requires owner-approved Phase 6 or privacy/security planning, not cosmetic status changes.

---

## 6. Follow-Up Backlog

Recommended future cleanup slices:

1. Betting docs: separate candidate planning, owner-applied boundaries, and completed Phase 5 reports before starting Phase 5.10.
2. Product/workflow/prompt docs: decide which are active guidance versus historical templates.
3. Ops docs: revisit only when Phase 6 testing/deployment planning is active.

Each cleanup slice should include a grep check proving that no non-ADR doc was promoted to `Accepted` without owner approval.
