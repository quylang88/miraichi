# Metrics Tracking Plan

Application performance metrics (APM) and model analytics tracking.

## Purpose
Establishes the key performance indicators (KPIs) to monitor.

## Status
- **Status**: Draft
- **Review Status**: Phase 6 planning active; metrics provider pending owner approval.

## Scope
Tracks routes latency, database connections pools, worker task sizes, and AI model predictions confidence accuracy.

## Standard Metrics
- **Web/PWA Staging**: HTTP availability, service worker cache marker, smoke-check pass rate.
- **API**: HTTP request duration, active db connections, error rate after API staging is approved.
- **Worker**: Jobs count in queue, retry ratios, execution time after worker staging is approved.
- **AI**: Inference time and calibration metrics only after real model evaluation planning is approved.

## TODO / Next Steps
- [ ] Keep backend, database, and model metrics draft-only until their staging targets are approved.
