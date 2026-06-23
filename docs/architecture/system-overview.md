# System Overview

High-level architecture design and system flows.

## Purpose
Explains how backend components, workers, design packages, and local AI interact.

## Status
- **Status**: Draft

## Scope
Broad system patterns, messaging channels, and client-server setups.

## General Design
- Decoupled API and Prediction runner systems using queues.
- Microservices communicating via JSON contracts over HTTP and Redis.
- Config-driven database layer to isolate sport data adapters.

## TODO / Next Steps
- [ ] Detail sequence flow diagram for a user requesting match prediction.
