# Config Package

Global environment parameters, feature flags, and competition configurations.

## Purpose
Ensures single source of truth for runtime configurations and application toggles.

## Status
- **Status**: Active

## Scope
Schema checks for environment variables, competition config formats, feature flags.

## Guidelines
- Never embed environment secrets in files under this directory.
- All configurations must follow the competition-agnostic model rules.

## TODO / Next Steps
- [ ] Implement environment variable schema validations.
