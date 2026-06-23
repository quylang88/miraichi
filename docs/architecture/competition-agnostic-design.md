# Competition-Agnostic Design Guidelines

Architectural principles to prevent coupling with specific football competitions.

## Purpose
Ensures that adding a new football tournament or league (e.g. World Cup, Premier League, Champions League) does not require changing core application logic.

## Status
- **Status**: Draft

## Scope
Directly governs database modeling, api payloads, predictions pipelines, and backend routing.

## Core Principles

### 1. No Hard-Coded Logic
- Never hard-code identifiers, names, or rules specific to any competition (e.g. "World Cup", "FIFA", "Group A").
- All tournament-specific properties (e.g. groups, knockout schedules, points calculations) must be handled dynamically through data schemas or dynamic configurations.

### 2. Generic Football Domain Model
- Model football entities using generic schemas:
  - **`Competition`**: Generic name, region, format.
  - **`Season`**: Represents active years (e.g. 2026, 2026-2027).
  - **`Team`**: Agnostic home/away name strings.
  - **`Match`**: Refers to team, season, competition IDs.
  - **`Market`**: Odds values representing prediction categories.
  - **`Bet` / `Bankroll` / `Risk Rule`**: User configurations mapped to matches.

### 3. Separation of Configuration & Core
- World Cup-specific behavior (e.g. group stages, double headers) must live in registry databases or config files in `packages/config/`.
- The core codebase in `apps/api` and `apps/worker` simply loads this configuration at runtime.

## TODO / Next Steps
- [ ] Define the competition metadata schema registry template.
