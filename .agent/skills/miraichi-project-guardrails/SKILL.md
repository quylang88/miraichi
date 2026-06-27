---
name: miraichi-project-guardrails
description: Evaluates requested tasks to prevent agent drift and ensure compliance with project scope rules.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Project Guardrails Skill

## Purpose
Protect the Miraichi project scope, prevent agent drift, and maintain architectural boundaries.

## When to Use This Skill
Use this skill at the beginning of every task analysis, plan creation, or before writing files to verify that proposed changes do not violate phase boundaries.

## Inputs
- User requests, current project phase, and target files list.

## Process
1. Load `.agent/skills/miraichi-delivery-lifecycle/SKILL.md`.
2. Inspect the incoming request for out-of-scope targets (e.g. database setup, prediction algorithms, frontend code).
3. Cross-reference the proposal against the project scope guidelines.
4. Reject or flag any tasks that attempt to introduce actual business logic.

## Output Format
- Verification summary or scope check reports.

## Rules
- Phase 0 is repo/bootstrap/docs/workflow only.
- Do not implement business logic.
- Do not implement prediction algorithms.
- Do not implement betting calculations.
- Do not create production database schemas.
- Do not add secrets.
- Do not hard-code World Cup.
- World Cup is only the first use case.
- Miraichi must remain competition-agnostic.
- New application modules default to TypeScript.
- After the owner-approved repo-wide JavaScript-to-TypeScript migration, tracked implementation source under `apps/`, `packages/`, and `scripts/` must stay TypeScript-first. Do not add new tracked `.js` source files there unless an explicit owner-approved compatibility exception names the file and reason.
- Browser-facing `.js` URLs, generated static `.js` artifacts, third-party configuration formats, and tool-required bridge files may exist only when source ownership remains clear and verification covers the compatibility path.
- Do not perform opportunistic JavaScript-to-TypeScript migration. Any future migration outside the already migrated repo source must identify exact files or file groups, runtime strategy, behavior-preservation tests, and verification commands.
- Repository-wide JavaScript-to-TypeScript migration is allowed only when the owner explicitly requests it in the active task. It must preserve browser `.js` URLs where required, update runtime commands before verification, avoid `@ts-nocheck` as a blanket escape hatch, and pass local plus integration verification before being reported complete.

## What Not to Do
- Never accept a task to write business logic, prediction logic, betting formulas, production schemas, secrets, or hard-coded competition logic without an accepted owner-approved lifecycle boundary.
- Never reintroduce tracked JavaScript implementation source as a shortcut after the repo-wide TypeScript migration.

## Definition of Done
- Scope validation check passes with no violations found.
