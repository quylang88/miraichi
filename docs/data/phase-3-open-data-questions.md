# Phase 3 Open Data Questions

This file logs outstanding data architectural questions, source provider choices, and feed design unknowns.

## Purpose
Identifies critical unknowns that must be investigated and resolved before Phase 3 exits and production data ingestion begins.

## Status
- **Status**: Closed
- **Date**: 2026-06-23

## Active Open Questions

### Q1: Feed Update Frequencies & Polling Strategy
- **Description**: What is the optimal frequency for polling sport feeds (fixtures, results, odds)? How do we balance up-to-date data with API rate limits and costs?
- **Trade-offs**:
  - *High Frequency (e.g., every 5 minutes)*: Fresh odds and match statuses, high API costs, risk of hitting rate limits.
  - *Low Frequency (e.g., every hour/daily)*: Cost-efficient, but prediction models might process stale odds.
- **Status**: Open. Needs research into provider-specific rate limits and webhooks.

### Q2: Third-Party Sports API Selection
- **Description**: Which external provider offers the best balance of fixture data depth, historical odds, coverage, and API pricing?
- **Candidates**: Public factual match websites evaluated under the current source-selection phase.
- **Status**: Open. Deferred to ADR-0014 candidate review.

### Q3: Generic Odds Normalization & Schema Mapping
- **Description**: Betting markets are named differently across providers (e.g., "1X2", "Three-Way Result", "Match Winner"). How do we define a standard odds contract that seamlessly maps these variations?
- **Status**: Open. Deferred to ADR-0015 candidate review.

### Q4: Ingestion Error Recovery & Fault Tolerance
- **Description**: How do we handle provider failures, network drops, or malformed payloads without losing fixture updates?
- **Status**: Open. Requires evaluation of queue retry strategies and fallback mock repositories.

### Q5: Traceability of Prediction Inputs
- **Description**: To audit predictive AI accuracy, we must reconstruct the exact data state (odds, team statistics, player status) that existed when the prediction was generated. How do we store historical snapshot boundaries?
- **Status**: Open. Deferred to ADR-0016 candidate review.
