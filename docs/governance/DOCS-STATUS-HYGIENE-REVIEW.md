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
* Phase 5.10 planning docs use `Active Planning` / `Active Review`.

This pass intentionally does not mass-edit app, package, data, local-ai, ops, or old planning docs. Those require targeted review because many are partly historical and partly still useful.

---

## 4. Follow-Up Backlog

Recommended future cleanup slices:

1. Phase 1 docs: mark completion reports as completed and planning package docs as closed or superseded where Phase 2+ docs replaced them.
2. Phase 3 docs: separate completed reports from still-active data planning notes.
3. Phase 4 docs: mark completed local-ai scaffold reports accurately and keep real model planning deferred.
4. App/package docs: compare each README/doc against current code before changing status.
5. Ops docs: keep draft until Phase 6 deployment planning is active.

Each cleanup slice should include a grep check proving that no non-ADR doc was promoted to `Accepted` without owner approval.
