# Operations Runbook

For a normal release, follow `PRODUCTION-DELIVERY.md`. For data loss, corrupt owner state, backup
failure, key rotation, or restore testing, follow `OWNER-DATA-RECOVERY.md`. Do not improvise from a
historical staging report.

Minimum operator sequence:

1. Confirm clean reviewed Git state and run the repository gate named by the active phase.
2. Run remote readiness and stop on any missing logical requirement.
3. Use a pull request into protected `staging`; inspect the exact hosted deployment and clean
   synthetic owner data.
4. Promote only through the exact `staging -> main` pull request. The owner's merge is production
   approval and starts deployment automatically.
5. On failure, preserve sanitized evidence, stop further promotion, and use exact prior runtime IDs.
   Never roll schema backward or run a linked reset.

No local verification result is staging or production approval.
