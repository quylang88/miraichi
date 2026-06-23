# Prompt Routing Plan

Guidelines for directing queries to specific tools or prediction pipelines.

## Purpose
Directs queries (e.g. "What are the odds for Arsenal vs Chelsea?") to the correct API.

## Status
- **Status**: Draft

## Scope
Maps query intents to API paths and database search patterns.

## Routing Logic
1. **Match/Odds Queries**: Route to API fixtures endpoint databases.
2. **Analysis/Opinion Queries**: Route to statistical summaries inference generator.
3. **General Support**: Route to system help scripts.

## TODO / Next Steps
- [ ] Implement intent classification prompt templates.
