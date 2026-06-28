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
Ensures that the World Cup and other national-team competitions can be the first delivery target without blocking future club competitions or requiring changes to core application code.

## When to Use This Skill
Use this skill during code reviews, schema audits, and pull request checklist validations.

## Inputs
- Proposed code changes, directory trees, database design logs.

## Process
1. Inspect files for competition-specific behavior in core code paths.
2. Validate that football concept naming matches generic terms.
3. Confirm that World Cup and national-team competition parameters reside in configuration or data artifacts, not parser/model/route forks.

## Output Format
- Agnostic compliance review log.

## Rules
- World Cup is the first explicit data/training target.
- National teams and national-team competitions come before club competitions.
- Treat competition as configurable data.
- Core concepts must remain generic:
  competition, season, team, match, player, market, prediction, bet, bankroll, risk rule.
- World Cup-specific metadata belongs in config/data, not core logic.
- Flag any parser, route, model, or folder structure that locks Miraichi to one tournament.
- Do not flag valid registry/config/data entries merely because they name World Cup or national teams.

## What Not to Do
- Do not accept any core code structure containing hard-coded tournament rules or competition-coupled branches.

## Definition of Done
- Audit review passes with World Cup/national-team metadata isolated to config/data and zero tournament-specific core logic patterns found.
