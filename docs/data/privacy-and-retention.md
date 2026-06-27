# Privacy & Data Retention Policy

User privacy protections and database cleanup thresholds.

## Purpose
Ensures GDPR compliance and limits storage sizes.

## Status
- **Status**: Draft
- **Review Status**: Deferred; not accepted for implementation.

## Scope
User bet slips history, login logs, and old sports fixtures datasets.

## Retention Rules
- Retain personal user bet slip logs for up to 3 years unless deletion is requested.
- Delete developer debug logs after 30 days.

## TODO / Next Steps
- [ ] Configure database cron job to clean expired sessions records.
