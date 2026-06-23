# Football Domain Model

Logical schemas and relationships for football matches.

## Purpose
Establishes database entities and relationships.

## Status
- **Status**: Draft

## Scope
Directly maps to shared types in packages/shared.

## Domain Model
- **Competition** (1) <----> (N) **Season**
- **Season** (1) <----> (N) **Match**
- **Match** (1) <----> (N) **Market** (Odds listings)
- **Match** (1) <----> (N) **Prediction**

## TODO / Next Steps
- [ ] Align model schemas with ORM schemas.
