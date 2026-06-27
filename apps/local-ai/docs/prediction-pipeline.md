# Prediction Pipeline Plan

Feature engineering, model inference, and output caching workflows.

## Purpose
Specifies the flow of match history variables from initial database query to prediction vector generation.

## Status
- **Status**: Active

## Scope
ML features pipeline, model input prep, prediction execution, and confidence calibration.

## Pipeline Guidelines
- Feature extractions must extract agnostic historical parameters (e.g. rolling goal averages, Elo ratings) rather than tournament-specific milestones.

## TODO / Next Steps
- [ ] Implement features extractor class skeleton.
- [ ] Define prediction confidence scale metrics.
