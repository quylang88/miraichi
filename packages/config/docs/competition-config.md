# Competition Config Design

Format specifications for adding new sport competitions dynamically.

## Purpose
Ensures that all competitions are treated as configuration data rather than code.

## Status
- **Status**: Active

## Scope
Competition metadata schemas, season templates, and tournament rules definitions.

## Design Rules
1. **No Code Changes for New Tournaments**: Adding a new competition (e.g. Premier League, Champions League, World Cup) must only require adding database records or config entries.
2. **Schema Properties**:
   - `id`: unique string key
   - `name`: user display name
   - `type`: league format vs knockout tournament format
   - `seasonFormat`: standard start/end boundaries
   - `rules`: rules for scoring, tie-breaking, extra time.

## TODO / Next Steps
- [ ] Define JSON schemas for league and tournament configurations.
- [ ] Implement registry validation scripts.
