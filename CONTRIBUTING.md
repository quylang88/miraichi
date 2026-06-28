# Contributing to Miraichi

Guidelines and standards for submitting code and design proposals.

## Purpose
This document provides instructions on how to set up, propose changes, and contribute to the monorepo.

## Status
- **Status**: Draft

## Scope
Applies to all code contributors, including human developers and AI subagents.

## Core Guidelines
1. **Competition Agnosticism**: World Cup and national-team competitions are the first delivery target, and their metadata belongs in registry/config/data. Never submit core parser, route, model, or business logic that only works for one competition.
2. **Lifecycle Discipline**: Follow `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` for planning, code slices, integration, staging, production, and maintenance.
3. **TDD Requirement**: New or changed behavior needs a failing unit test before implementation and a passing test after implementation.
4. **Monorepo Structure**: Place code only in `apps/` or `packages/`. Do not pollute the root folder.
5. **Commit Quality**: Write descriptive commit messages matching the conventions in WORKFLOW.md.

## TODO / Next Steps
- [ ] Add instructions for setting up the local environment once the app skeleton is ready.
