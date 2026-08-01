---
name: miraichi-project-guardrails
description: Use when evaluating Miraichi scope, implementation plans, data sources, persistence, betting behavior, or changes that may cross owner-approved product boundaries.
---

# Miraichi Project Guardrails

**REQUIRED SUB-SKILL:** Use `miraichi-delivery-lifecycle` before applying these guardrails.

## Product Contract

Miraichi is owner-only and has four primary tabs: `Today`, `Matches`, `Bets`, `Bankroll`.

Allowed match data is factual: fixtures, schedules, results, statuses, teams, competitions, events, lineups, and odds. Owner data includes manual bets, odds, stake points, settlements, notes, bankroll accounts, ledger entries, and backups.

## Rules

- Keep the browser behind the Miraichi API; never expose server/database credentials.
- A website source and crawler require an accepted owner-approved ADR.
- Keep provider code removable and canonical IDs provider-neutral.
- Keep both club and national-team competitions valid through configuration.
- Do not add prediction, chat, explanation, model-training, automated picks, expected goals, stake sizing, Kelly, ROI, CLV, or risk formulas.
- Do not add public authentication, multi-tenancy, paid services, secrets, or production schema changes without explicit owner approval.
- New application modules default to TypeScript.
- Tracked source under `apps/`, `packages/`, and `scripts/` stays TypeScript-first unless an owner-approved compatibility exception names the file and reason.
- Preserve Git history and unrelated user changes.

## Review Output

State the factual boundary, any inference, the concrete violation or risk, and the earliest safe next action.

## Definition Of Done

The proposed work stays inside the current `PROJECT_PLAN.md` phase, has the required owner decision, and passes product-boundary plus relevant lifecycle verification.
