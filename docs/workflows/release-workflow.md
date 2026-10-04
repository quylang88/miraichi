# Release Workflow

Steps for building, tagging, and releasing updates.

## Purpose
Ensures that deployment milestones are achieved safely and tracked.

## Status
- **Status**: Active under ADR-0055

## Scope
Directly plans versioning tags and release tasks.

## Release Steps

1. Load `.agent/skills/miraichi-delivery-lifecycle/SKILL.md` and follow `PROJECT_PLAN.md`.
2. Make changes on a short-lived branch based on protected `staging`.
3. Open a pull request to protected `staging`; `quality-gate` must pass with no deployment secrets.
4. Merge to `staging`. The exact SHA automatically deploys through Cloudflare Worker Static Assets
   and the Frankfurt Supabase Edge Function, then runs hosted verification.
5. Review exact-SHA evidence and clean synthetic owner rows in the test finalizer.
6. Open the sole `staging -> main` production pull request. Both `quality-gate` and
   `release-candidate` must pass; no production-only content edit is allowed.
7. The owner's merge is final production approval. The main push automatically runs backup-first
   deployment to the isolated Singapore production environment and read-only smoke.
8. Preserve the exact deployment/artifact evidence. On failure, use exact prior runtime IDs; never
   roll schema backward or reset a linked database.

Hotfixes follow protected main -> staging -> main, never a direct production push. Detailed steps,
stop conditions, and recovery are in `docs/operations/PRODUCTION-DELIVERY.md` and
`docs/operations/OWNER-DATA-RECOVERY.md`.

## Required Checks

- `staging`: `quality-gate`
- `main`: `quality-gate`, `release-candidate`
