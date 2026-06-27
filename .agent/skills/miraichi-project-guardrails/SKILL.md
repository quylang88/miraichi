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

## What Not to Do
- Never accept a task to write functional API route handlers or UI view code.

## Definition of Done
- Scope validation check passes with no violations found.
