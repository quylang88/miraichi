# Redis Queue Design

Message broker definitions, queue hierarchies, and failover workflows.

## Purpose
Establishes how tasks are distributed across Redis channels.

## Status
- **Status**: Active

## Scope
Queue channels, priority structures, message schemas, and retry policies.

## Queue Definitions
- `sports-data-ingestion` - Processing external API fixture data.
- `ai-prediction-runs` - Triggering ML prediction steps in apps/local-ai.
- `notifications` - Email alerts and user telegram notifications.

## TODO / Next Steps
- [ ] Write schema validations for queue message payloads.
- [ ] Connect dead-letter queues to alerts.
