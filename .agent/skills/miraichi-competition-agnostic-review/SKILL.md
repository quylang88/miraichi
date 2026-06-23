---
name: miraichi-competition-agnostic-review
description: Audits code, naming patterns, database plans, and configurations for competition agnosticism.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Competition-Agnostic Review Skill

## Purpose
Ensures that adding a new football tournament or league (e.g. World Cup, Premier League) does not require changing core application code.

## When to Use This Skill
Use this skill during code reviews, schema audits, and pull request checklist validations.

## Inputs
- Proposed code changes, directory trees, database design logs.

## Process
1. Inspect files for specific tournament keywords (e.g. "World Cup", "FIFA").
2. Validate that football concept naming matches generic terms.
3. Confirm that tournament-specific parameters reside in configuration files under `packages/config/`.

## Output Format
- Agnostic compliance review log.

## Rules
- Do not hard-code World Cup.
- Treat competition as configurable data.
- Core concepts must remain generic:
  competition, season, team, match, player, market, prediction, bet, bankroll, risk rule.
- World Cup-specific behavior belongs in config/data, not core logic.
- Flag any naming, docs, folders, or assumptions that lock Miraichi to one tournament.

## What Not to Do
- Do not accept any code structure containing hard-coded tournament rules or names.

## Definition of Done
- Audit review passes with zero tournament-specific code patterns found.
