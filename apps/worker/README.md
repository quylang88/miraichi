# Background Worker

Scheduled cron executions, queue processing, and data sync workers.

## Purpose
Manages task consumption (polling sports APIs, trigger-based predictions updates, email notifications, and bankroll audit summaries).

## Status
- **Status**: Draft

## Scope
Defines Redis queue connections, cron schedule tables, email engines, and batch processors.

## Guidelines
- Keep worker tasks lightweight and stateless.
- Scale worker instances horizontally using standard queue partitions.

## TODO / Next Steps
- [ ] Initialize Node.js/TypeScript queue consumer skeleton.
- [ ] Configure Redis client connections template.
