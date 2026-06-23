# Competition-Agnostic Review

## Purpose
Review whether Miraichi architecture planning risks assuming one competition-specific implementation. This review supports Phase 1 planning and should be repeated before implementation work begins.

## Status
- **Status**: Draft
- **Phase**: Phase 1 - Architecture Planning
- **Date**: 2026-06-23

## Scope
This document reviews architecture documentation language and planning boundaries. It does not implement checks, schemas, configuration files, provider adapters, or competition-specific behavior.

## Review Summary
Miraichi's core architecture should remain competition-agnostic. The first use case may reference World Cup scenarios for product validation, but core docs, packages, apps, and future implementation plans should use generic football concepts.

## Generic Core Vocabulary
- competition
- season
- team
- match
- player
- market
- prediction
- bet
- bankroll
- risk rule

## Risks Identified
- Early examples could become implicit defaults if they use one competition name too often.
- Data ingestion planning could leak provider-specific or competition-specific fields into shared concepts.
- Betting and bankroll planning could imply fixed formats before markets and risk rules are modeled generically.
- LLM prompts could overfit explanations to a single initial use case unless local AI and configuration boundaries stay generic.
- Root architecture docs can sound more final than intended if they mention candidate runtimes or storage tools without labeling them as options.

## Recommendations
- Use initial-use-case language when mentioning World Cup, and avoid using it as a package, folder, type, table, route, or core configuration name.
- Keep competition-specific metadata in future configuration or provider data, not in app logic.
- Use generic vocabulary in architecture docs and defer concrete fields to later ADRs.
- Require competition-agnostic review before adding APIs, schemas, ingestion adapters, prediction workflows, or betting workflows.
- Add review checks that flag competition names, fixed tournament phases, and hard-coded group assumptions.

## Draft Review Result
The Phase 1 planning package is acceptable if it remains open-ended, uses generic domain language, and treats World Cup only as an initial use case or coupling risk. No final architecture choice should be considered approved by this review.
