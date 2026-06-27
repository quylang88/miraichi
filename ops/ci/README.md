# Continuous Integration (CI)

Pipelines and check workflows for automated pull requests.

## Purpose
Ensures that all pushes to master/main are built, tested, and audited.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 check-only CI workflow implemented; deployment automation remains blocked.

## Scope
Maps trigger scenarios, lint parameters, and testing jobs.

## Guidelines
- Avoid hardcoding API secrets inside workflow definitions.
- Keep execution times fast by utilizing parallel run matrices.

## TODO / Next Steps
- [x] Review `ops/PHASE-6-TESTING-DEPLOYMENT-HARDENING-PLAN.md`.
- [x] After owner approval, create an implementation plan before adding workflow YAML.
- [x] Add check-only CI workflow under `.github/workflows/ci.yml`.
- [ ] Keep CI deployment automation out of scope until owner-approved secrets and branch policy exist.
