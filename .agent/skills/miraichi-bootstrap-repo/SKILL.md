---
name: miraichi-bootstrap-repo
description: Guides agents when creating or reviewing the Miraichi repository structure and config defaults.
metadata:
  project: Miraichi
  owner: quylang88
  version: "0.1.0"
---

# Repository Bootstrap Skill

## Purpose
Enforces folder structure, config defaults, and documentation conventions across the monorepo.

## When to Use This Skill
Use this skill when checking the layout of files, adding directories, or adding baseline config templates.

## Inputs
- Directory listings, file paths, and config templates.

## Process
1. Inspect file creations to ensure they align with the 4 main folders structure.
2. Confirm `.gitkeep` is placed in empty directories.
3. Validate that markdown documentation follows the standard section structure.

## Output Format
- Repository structure validation reports.

## Rules
- Keep root clean.
- Root should have only 4 main folders: apps, packages, docs, ops.
- Use markdown-first documentation.
- Use .gitkeep for empty folders.
- Create useful placeholder docs.
- Do not add app code yet.

## What Not to Do
- Do not add arbitrary folders directly under the repository root.

## Definition of Done
- Directory layout matches target tree specification exactly, with all empty directories containing a `.gitkeep` file.
