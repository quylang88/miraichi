# Document Status Taxonomy

* **Status**: Active Governance
* **Date**: 2026-06-27

This document defines allowed documentation statuses for Miraichi. It exists because using `Draft` everywhere hides real project state, while changing everything to `Accepted` would be false.

---

## 1. Allowed Statuses

| Status | Use for | Do not use for |
| :--- | :--- | :--- |
| `Draft` | Incomplete docs, early notes, or material still being shaped. | Owner-approved decisions or active governance. |
| `Candidate` | ADR candidates or undecided proposals. | Implemented or owner-approved decisions. |
| `Proposed` | Reviewed recommendation awaiting owner approval. | Final decisions. |
| `Accepted` | Owner-approved ADRs or explicit owner-approved decisions only. | General docs, reports, or docs that merely look correct. |
| `Active` | Living operational guidance currently in force. | Historical reports or closed planning docs. |
| `Active Planning` | Current planning phase documents that are being used now. | Completed phase reports. |
| `Active Review` | Current review/checklist docs used to gate an active phase. | Final phase reports. |
| `Active Governance` | Rules that govern agents, phases, owner gates, lifecycle, and status policy. | ADRs that need owner acceptance metadata. |
| `Completed` | Reports for completed work where the artifact records what happened. | Future plans or live governance. |
| `Completed - Verified` | Completed work with recorded verification evidence. | Docs without verification evidence. |
| `Closed` | Completed planning or preview artifact with no active edits expected. | Ongoing source-of-truth docs. |
| `Superseded` | Docs replaced by a newer source of truth. | Docs still used to guide implementation. |

---

## 2. Acceptance Rules

`Accepted` is a narrow status.

A document may use `Accepted` only when one of these is true:

* It is an ADR with explicit owner approval metadata.
* It is an owner decision record with explicit approval.
* It is a review document whose purpose is to record acceptance of a bounded decision, and the owner approval is traceable.

General architecture docs, workflow docs, package README files, phase plans, and reports should not use `Accepted` just because they are useful.

---

## 3. Status Cleanup Rules

When cleaning docs:

* Prefer `Active` for root docs that are current living guidance.
* Prefer `Active Governance` for owner gates, lifecycle rules, and taxonomy docs.
* Prefer `Completed` or `Completed - Verified` for phase reports.
* Prefer `Closed` for preview or planning artifacts whose work is finished.
* Prefer `Superseded` when a newer document explicitly replaces the older one.
* Keep `Draft` when the document is incomplete or still intentionally exploratory.
* Keep `Candidate` or `Proposed` for ADR flow until owner approval exists.

Do not do bulk status replacement. Each status change must have a reason.
