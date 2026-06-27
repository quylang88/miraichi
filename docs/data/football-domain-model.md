# Football Domain Model

Logical schemas and relationships for football matches.

## Purpose
Establishes logical data structures and relationships.

## Status
- **Status**: Active

## Scope
Describes document-level contracts and TypeScript interfaces implemented in `packages/shared`. This represents logical constraints only; no database tables or ORM schemas are created.

## Domain Model
- **Competition** (1) <----> (N) **Season**
- **Season** (1) <----> (N) **Match**
- **Match** (1) <----> (N) **Market** (Odds listings)
- **Match** (1) <----> (N) **Prediction**

## TODO / Next Steps
- [ ] Refine core TypeScript type definitions in `packages/shared`.
- [ ] Verify parser schemas map correctly to these logical entities.
