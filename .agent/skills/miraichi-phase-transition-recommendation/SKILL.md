---
name: miraichi-phase-transition-recommendation
description: Use when closing, reviewing, handing off, or preparing to start a Miraichi phase; deciding the next phase; checking phase gates; or identifying owner review questions before phase transition.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Miraichi Phase Transition Recommendation

## Purpose
Prevent vague phase endings. Every phase closeout must state the earliest safe next phase, the gate evidence, and any owner answers needed before work can continue.

## Core Rule
Do not say a phase is ready to advance unless the exit gate is satisfied and required owner decisions for the next phase are explicit. If anything is missing, say the transition is blocked and name the missing evidence.

Formal `phase:owner-feedback` and `phase:production` are final-release gates by default. For intermediate phase closeouts, recommend the earliest safe next implementation/planning/testing phase instead of owner feedback, unless the owner explicitly asks for a review checkpoint.

## Required Inputs
- Current or closing phase.
- `PROJECT_PLAN.md` active phase and TODO state.
- Relevant phase plan, review, report, ADR, or owner decision docs.
- Verification evidence and changed files, if implementation occurred.

## Process
1. Read `miraichi-delivery-lifecycle` and `miraichi-project-guardrails`.
2. Treat `PROJECT_PLAN.md` as the current phase source of truth when root docs disagree.
3. Check the current phase exit gate from the lifecycle skill.
4. Recommend the earliest safe next phase command, not the most ambitious one.
5. Identify owner decisions required before that phase can start.
6. For each owner question, give one recommended answer, the reason, and the risk of choosing otherwise.
7. If required approval or answers are missing, mark the next phase as blocked instead of implying permission.

## Output Format
Use the user's language and include these sections:

1. **Ket luan thang**: Can the next phase start, yes or no.
2. **Vi sao**: Source facts and exit gate evidence.
3. **Owner decisions can thiet**: Questions, approvals, or final-review blockers still required.
4. **Khuyen nghi**: Recommended next phase command and recommended answer for each owner question.

## Rules
- Never treat local tests, a proposed document, or an agent recommendation as owner approval.
- Never recommend `phase:owner-feedback` after an intermediate phase unless the owner explicitly requests it or the project plan says this is the final release review.
- Never recommend `phase:production` until all planned release phases are complete or explicitly removed from scope.
- Never recommend `phase:code-slice` when the implementation plan lacks exact files, failing test, implementation step, and verification command.
- Never recommend Phase 5.11 while Phase 5.10 is incomplete, unreviewed, or unapproved.
- If multiple next phases are possible, choose the earliest safe lifecycle phase and explain why.
- If no owner questions remain, say that explicitly.

## Common Mistakes
| Mistake | Correct behavior |
| --- | --- |
| "Looks ready" without evidence | Cite the exact gate and document evidence. |
| Recommending owner review after every phase | Use phase closeout for intermediate phases; reserve formal owner review for final release unless explicitly requested. |
| Recommending implementation too early | Recommend `phase:implementation-plan` until TDD slices are exact. |
| Listing questions without guidance | Recommend an answer for every question and state the risk. |

## Definition of Done
- The response names the next phase or says transition is blocked.
- Required owner approvals and questions are listed.
- Every open owner question has a concrete recommendation.
- The recommendation stays within lifecycle and guardrail boundaries.
