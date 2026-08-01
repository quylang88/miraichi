---
name: miraichi-competition-agnostic-review
description: Use when reviewing Miraichi match contracts, crawler adapters, configuration, routes, storage, or UI behavior for competition coupling.
---

# Competition-Agnostic Review

## Core Rule

Competition selection is data, not a branch in core behavior. Both `club` and `national-team` are first-class types.

## Review Checklist

- Core names use competition, season, team, match, event, lineup, market, odds, bet, and bankroll.
- Competition IDs and allowlists live in config or data.
- Parsers and routes do not contain tournament-specific forks.
- Provider IDs remain provenance and never become canonical entity IDs.
- A provider adapter can be removed without changing shared contracts or web routes.
- Tests include at least one club and one national-team fixture where the behavior applies to both.

## Findings

Report exact files and behavior. Do not flag a valid configured competition name merely because it is specific; flag only coupling in shared/core behavior.

## Definition Of Done

No tournament or competition type controls core application structure, and configured competitions work without source-specific IDs leaking into public contracts.
