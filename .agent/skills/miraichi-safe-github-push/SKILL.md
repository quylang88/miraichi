---
name: miraichi-safe-github-push
description: Guides agents when executing Git commands and pushing code changes to GitHub.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Safe GitHub Push Skill

## Purpose
Ensures that all commits and pushes are safe, verified, and do not leak credentials or overwrite remote history.

## When to Use This Skill
Use this skill when executing Git commands, staging files, committing, or pushing to remote repositories.

## Inputs
- Git status outputs, staged diffs, remote configurations, and remote commit listings.

## Process
1. Run `git status` to verify modified files list.
2. Review staged changes for sensitive credentials or environment keys.
3. Check the remote repository history using `git ls-remote` before pushing.

## Output Format
- Git execution log and confirmation summaries.

## Rules
- Always run git status before committing.
- Always check staged files.
- Always check for secrets before commit.
- Always check remote URL.
- Never force push.
- If remote has existing commits, stop and explain the safest next step.
- Use conventional commit messages.

## What Not to Do
- Never use force options (`-f` or `--force`) during pushes without explicit manual authorization.

## Definition of Done
- Branch updates are pushed cleanly to the verified remote URL.
