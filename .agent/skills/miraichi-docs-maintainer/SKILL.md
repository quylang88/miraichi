---
name: miraichi-docs-maintainer
description: Ensures repository documentation is updated, clickable, and syntactically correct.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Docs Maintainer Skill

## Purpose
Maintains consistency, formatting, and link integrity for all repository documentation.

## When to Use This Skill
Use this skill when editing markdown files, changing roadmap milestones, or modifying workflow templates.

## Inputs
- Markdown documentation, relative links, and commit files.

## Process
1. Inspect markdown formatting for correct header structure (Title, Purpose, Status, Scope).
2. Validate that relative links scheme matches `file:///` format and is clickable.
3. Review `CHANGELOG.md` to ensure modifications are tracked.

## Output Format
- Lint-checked markdown updates.

## Rules
- Project plans must be reflected in PROJECT_PLAN.md.
- Roadmap must be reflected in ROADMAP.md.
- Architecture decisions must be reflected in ARCHITECTURE.md or docs/decisions/.
- Agent responsibilities must be reflected in AGENTS.md and docs/agents/.
- Workflow rules must be reflected in WORKFLOW.md and docs/workflows/.
- Keep docs concise and actionable.

## What Not to Do
- Do not commit broken links or placeholder documents without TODO annotations.

## Definition of Done
- Markdown files pass validation checks with zero link failures.
