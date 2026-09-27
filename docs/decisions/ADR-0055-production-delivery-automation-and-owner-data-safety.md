# ADR-0055: Production delivery automation and owner-data safety

- Status: Accepted on 2026-09-27; the implementation plan awaits owner review, and implementation
  plus production promotion remain unapproved.
- Extends ADR-0052's Supabase Edge Function and Cloudflare Worker topology.
- Supersedes ADR-0052's proposed Tokyo production region with Singapore `ap-southeast-1`.

## Context

Miraichi has a verified Frankfurt staging deployment, forward-only Supabase migrations, hosted
owner-flow checks, and recorded runtime rollback evidence. GitHub Actions is still check-only: the
repository has no protected `staging` branch, no production environment, no automatic deployment,
and no independent production owner-data backup. Some older operations documents still describe a
Cloudflare Pages-only target even though the active topology is Cloudflare Worker Static Assets in
front of a Supabase Edge Function and private Postgres.

The owner wants every change reviewed on staging before production, full verification to block bad
merges, and automatic deployment after a reviewed production merge. The owner requires a free-tier
operating target and expects to live in Vinh Phuc, Vietnam after another one or two years in Japan.

## Decision

Use three Git roles: short-lived change branches, protected `staging`, and protected `main`.
Changes enter `staging` only through a green pull request. A successful `staging` push deploys the
retained Frankfurt environment and records hosted evidence for that exact commit. Production accepts
only a `staging -> main` pull request whose exact candidate passed full verification and hosted
staging checks. Merging that pull request is the owner's production approval and automatically
deploys production; there is no second manual approval after merge.

Create production as a separate Supabase project in Singapore `ap-southeast-1` and a separate
Cloudflare Worker. Pin production Edge invocations to the database region. Keep Frankfurt staging
separate, retain environment-specific secrets, and never copy production owner data into staging.
Production starts with an empty owner dataset; only committed migrations and default owner setup are
applied. Match data may be hydrated independently.

Before every production migration, export the durable owner dataset, validate it, encrypt it, and
store it in a private Cloudflare R2 Standard bucket. Also run a daily backup and a weekly disposable
restore test. Match snapshots, provider caches, refresh state, sessions, and temporary discipline
challenges are rebuildable or ephemeral and remain outside the owner backup. The pipeline enforces a
1 GB internal storage ceiling and lifecycle retention so expected R2 usage remains well inside the
current free tier; R2 is usage-billed and is not represented as a hard zero-cost service.

Normal production automation accepts only backward-compatible expand/backfill migrations. Destructive
contract migrations require a separately reviewed release after old code no longer depends on the
retired structure. Runtime rollback restores prior Worker and Edge code but never automatically
reverses schema or restores owner data.

## Consequences

- A failed check cannot merge, and a failed staging deployment cannot become a production candidate.
- The production database, credentials, scheduler, URL, and backup destination are isolated from
  staging.
- Singapore avoids a planned Tokyo-to-Vietnam database migration. Changing region later would still
  require a new Supabase project and an explicit data migration.
- Free-tier operation has no uptime, point-in-time recovery, or zero-data-loss guarantee. R2 backups
  protect durable owner records but do not provide high availability.
- Direct pushes, force-pushes, and branch deletion are blocked for `staging` and `main`. No independent
  reviewer count is required because the product and repository are owner-only; required checks and
  the explicit merge remain the gates.
- Production automation, remote project creation, secret configuration, branch changes, pushes, and
  deployment are not authorized by this ADR. They require an approved written spec and implementation
  plan followed by the normal Miraichi lifecycle.

## Design

The complete contract is in
`docs/superpowers/specs/2026-09-27-production-delivery-automation-design.md`.
