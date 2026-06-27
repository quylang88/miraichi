# Feature Flags Plan

Toggles and rules for releasing features incrementally.

## Purpose
Establishes runtime flags definitions and target user cohorts.

## Status
- **Status**: Active

## Scope
Maps available feature keys, testing buckets, and rollout rules.

## Core Flags
- `enable-realtime-odds` - Toggle polling odds feeds.
- `enable-ai-assistant` - Toggle frontend chat dashboard.
- `restrict-high-stakes` - Toggle bankroll risk limits protection.

## TODO / Next Steps
- [ ] Determine configuration integration service (e.g. LaunchDarkly or local env triggers).
