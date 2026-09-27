# Production Delivery Automation And Owner-Data Safety Design

* **Status**: Written spec awaiting owner review
* **Date**: 2026-09-27
* **Decision**: `docs/decisions/ADR-0055-production-delivery-automation-and-owner-data-safety.md`
* **Lifecycle**: `phase:plan` review; `phase:implementation-plan` remains blocked until this written
  spec is approved

## Outcome

Miraichi will have a repeatable, owner-controlled delivery path in which every change reaches the
retained Frankfurt staging environment before it can reach production. GitHub required checks block
unsafe merges. A reviewed `staging -> main` merge automatically backs up durable owner data, applies
compatible migrations, deploys the exact reviewed candidate to an isolated Singapore production
environment, and verifies the live result without writing owner data.

The design optimizes for safe upgrades and maintainability under a free-tier operating target. It
does not promise high availability, point-in-time recovery, or zero data loss.

## Approved Boundaries

- `main` represents production; `staging` represents the hosted staging candidate.
- Short-lived change branches enter `staging` through pull requests.
- Frankfurt staging remains in place. Production uses a new Supabase project in Singapore
  `ap-southeast-1` and a separate Cloudflare Worker.
- Production begins with empty owner tables. No Frankfurt owner rows are copied.
- Production Edge invocations are pinned to `ap-southeast-1`; Cloudflare static assets and the
  gateway remain globally distributed.
- Durable owner data is backed up to encrypted private R2 objects. Match/provider data is not part of
  the required backup.
- The expected bill is zero while usage remains inside provider free tiers. No provider free tier is
  treated as a hard spending cap or availability guarantee.
- Merging the green `staging -> main` pull request is the owner's explicit production approval. The
  subsequent deployment is automatic.
- This phase designs delivery only. It does not create remote projects, configure secrets, push
  branches, modify GitHub rules, or deploy production.

## Current-State Corrections

The active topology is Cloudflare Worker Static Assets plus one gateway-protected Supabase Edge
Function and private Postgres. Cloudflare Pages-only deployment documents are historical and must be
retired or rewritten during implementation. The current `.github/workflows/ci.yml` runs check-only
unit, syntax, type, audit, and build gates; it intentionally excludes integration, staging checks,
deployment secrets, and deployment commands. Neither `staging` nor `develop` exists on the remote,
and `main` is the current default branch.

`PROJECT_PLAN.md` remains authoritative when older operations documents disagree.

## Delivery Topology

```text
change branch
  -> pull request to protected staging
       -> secret-free full CI
            -> merge
                 -> Frankfurt staging deploy
                      -> hosted smoke and owner review
                           -> pull request staging -> protected main
                                -> candidate/evidence verification
                                     -> merge is production approval
                                          -> encrypted owner backup
                                          -> Singapore migration
                                          -> Singapore Edge deploy
                                          -> production Worker/PWA deploy
                                          -> read-only production smoke

scheduled production backup
  -> owner-data export
       -> validation + encryption
            -> private Cloudflare R2 Standard bucket
                 -> weekly disposable restore verification
```

## Branch Contract

### Change branches

Change branches follow the existing repository naming conventions and normally branch from
`staging`. They cannot deploy. A pull request to `staging` receives no staging or production
credentials.

### `staging`

`staging` requires a pull request, resolved conversations, and the unique aggregate status check
`quality-gate`. Direct pushes, force-pushes, and deletion are blocked. A merge creates the push event
that starts the staging deployment.

The staging deployment records the exact source commit, release manifest, migration set, runtime
versions, hosted evidence, and final state. A failed deployment remains failed evidence and cannot be
used by the production candidate gate.

### `main`

`main` has the same protections and an additional required `release-candidate` check. The check
rejects a pull request whose head branch is not `staging`, whose content diverges from the hosted
candidate, or whose exact staging deployment did not finish successfully. `main` must remain an
ancestor of `staging` before release so the production merge cannot silently omit a hotfix.

No independent review count is required for the owner-only repository. Required checks plus the
owner's merge action are the approval. Repository administrators should not routinely bypass the
rules.

### Hotfixes

A `hotfix/*` branch starts from `main`, is incorporated into `staging`, and is deployed there before
it can return to `main`. After production, `staging` must still contain the hotfix. Direct production
hotfix pushes are forbidden.

## Environment Isolation

| Property | Staging | Production |
| --- | --- | --- |
| Git branch | `staging` | `main` |
| GitHub Environment | `staging` | `production` |
| Supabase project | retained Frankfurt project | new Singapore project |
| Edge region header | `eu-central-1` | `ap-southeast-1` |
| Cloudflare Worker | existing staging Worker | separate production Worker |
| Database | staging-only | production-only |
| Scheduler/Vault | staging-only names/values | production-only names/values |
| R2 backup | no production backup access | private production bucket credentials |
| Owner data | test-only with mandatory cleanup | real owner data |

Environment secrets use the same logical variable names so one deployment implementation serves
both targets, but values are stored separately. The browser never receives database, gateway,
provider-refresh, session-signing, backup-encryption, or R2 credentials. Cloudflare never receives a
database credential.

## Workflow Components

### Pull-request CI

The pull-request workflow runs without deployment secrets and contains independently visible jobs
for:

- product-boundary and lifecycle verification;
- unit tests;
- syntax, lint, and TypeScript checks;
- guardrail and type-safety audits;
- integration, endpoint, structured-bet, settlement, and PWA suites;
- static web build;
- empty-database and prior-schema migration verification;
- migration policy checks;
- Supabase Edge build/runtime/module-graph checks; and
- Cloudflare artifact dry-run verification.

An aggregate `quality-gate` job depends on every required job and is the only PR check named in both
branch rules. Required job names remain unique across workflows.

### Staging deployment

A push to `staging` runs the `staging` GitHub Environment with a non-cancelling concurrency group.
It checks out the immutable SHA, installs from the frozen lockfile, reruns the staging release gate,
builds the candidate, and writes a release manifest. The manifest contains the source SHA, Git tree
ID, migration-list hash, web artifact hash, Edge bundle hash, Cloudflare source/artifact hash, and
toolchain versions.

The workflow compares local and remote migration lists, runs a dry run, applies compatible pending
migrations, deploys the Edge function, deploys the Worker/PWA, configures the scheduler, and runs the
committed hosted gates. On success it stores a bounded-retention GitHub artifact whose name begins
with `miraichi-release-` and ends with the exact 40-character source SHA, then marks the GitHub
staging deployment successful. If that artifact expires before
promotion, the candidate must be redeployed to staging; production never substitutes a `latest`
artifact.

### Release-candidate verification

The `staging -> main` pull request verifies all of the following:

- the source branch is exactly `staging`;
- `main` is an ancestor of `staging`;
- the exact staging SHA has a successful deployment and hosted evidence;
- the release artifact and manifest hashes match;
- the proposed merge tree contains no release-only edits; and
- full verification and migration policy checks pass on the proposed merge tree.

### Production deployment

A push to `main` uses a non-cancelling production concurrency group. It proves that the merge tree
matches the approved candidate and downloads the artifact by SHA. Environment-specific bindings are
injected only during deployment; reviewed application assets and bundles remain unchanged.

The ordered production transaction is:

1. Validate event, branch, candidate SHA, manifest, and production secret names.
2. Export, validate, encrypt, upload, and read back the pre-deploy owner backup metadata.
3. Compare migration lists and run the production migration dry run.
4. Apply compatible migrations.
5. Deploy the Supabase Edge function pinned to `ap-southeast-1`.
6. Deploy the production Cloudflare Worker/PWA at 100% traffic.
7. Configure the production scheduler and verify its target and Vault names without printing values.
8. Run the non-mutating production smoke suite.
9. Record the Git commit, tree, manifest, migrations, runtime versions, region, and backup receipt.

The PWA is not gradually split across Worker versions because consecutive shell, asset, and service
worker requests could cross versions. A complete version is deployed and rolled back as a unit.

### Scheduled backup

The backup workflow runs daily and by manual dispatch. It has no deployment permission. The weekly
path downloads the newest backup into an isolated runner, decrypts it, creates a disposable local
Supabase database, applies current migrations, restores the backup, and verifies the owner-data
contract. It always destroys the disposable database and never targets hosted staging or production.

## Release Automation Structure

GitHub YAML remains thin orchestration. Tested TypeScript modules under `scripts/` own target
validation, release-manifest creation, migration policy, backup envelopes, R2 retention, evidence
parsing, and smoke assertions. Environment selection is explicit; scripts reject an unknown target,
missing value, localhost production URL, duplicated staging/production identifier, or a production
region other than `ap-southeast-1`.

This structure keeps the staging and production procedures on one code path without allowing one
environment to reuse the other's credentials.

## Owner-Data Backup Contract

### Durable contents

The next backup schema includes:

- owner profile identity and durable settings;
- bet drafts;
- bet records, including their denormalized match labels and betting context;
- bankroll accounts;
- bankroll ledger entries;
- discipline configuration; and
- bet settlement and correction events.

The restore order preserves account, bet, settlement, and ledger relationships. The envelope has an
explicit schema version, export timestamp, owner identity, per-collection counts, and canonical
payload SHA-256.

### Excluded contents

Match snapshots/records, live overlays, provider caches/circuits/checkpoints, refresh leases, backup
receipts, sessions/revocations, and temporary discipline challenges are excluded. Match data can be
rehydrated, but canonical ID construction remains stable so an old bet can reconnect when the exact
match returns. A bet remains readable and manually settleable from its stored labels and market data
even when no match record exists.

### Encryption and storage

The backup is encrypted before upload with a versioned AES-256-GCM envelope using a random 12-byte
nonce, a 16-byte authentication tag, and an independent base64-encoded 256-bit production backup
key. Environment, backup schema version, owner identity, export timestamp, and plaintext SHA-256 are
authenticated metadata. Plaintext is never written to an artifact or log. The key lives in the
GitHub production Environment and the owner's offline password manager. R2 credentials are scoped
only to the private backup bucket.

R2 uses Standard storage. Automation retains 30 daily objects and 12 monthly objects, refuses a new
upload if projected retained storage exceeds the internal 1 GB ceiling, and verifies uploaded object
metadata and ciphertext hash. A low budget alert is advisory only and is not represented as a hard
cap.

## Migration Safety Contract

Normal automated releases may create tables, add compatible nullable/defaulted columns, add safe
indexes, add constraints after old rows are proven valid, and run bounded idempotent backfills.
Migration verification runs from an empty database and from the last production-compatible schema.

The policy rejects remote reset, `TRUNCATE`, owner-table deletion, unbounded data rewrites, new cascade
deletes over owner data, lossy type changes, and removal of columns/tables still referenced by the
rollback version. Static SQL checks are a guard, not proof; executable migration and preservation
tests remain mandatory.

Structural retirement follows expand/backfill/contract:

1. Expand adds the new representation while old code still works.
2. Backfill is bounded, repeatable, observable, and preserves the old representation.
3. Application code reads the new representation while retaining rollback compatibility.
4. Contract removal occurs only in a later explicitly reviewed release after the old runtime is no
   longer a rollback target.

Migrations run before new runtime code. A failed transactional migration blocks all code deployment.
No automation runs `supabase db reset --linked`.

## PWA And Client Compatibility

The service-worker cache identity derives from release content rather than a hand-maintained number.
Activation deletes only older Miraichi shell caches. It never clears IndexedDB, sends
`Clear-Site-Data`, or removes owner authentication outside the explicit logout flow. Any IndexedDB
schema change is versioned and tested by upgrading a database created by the prior release.

API evolution adds optional fields before requiring them. A new API must tolerate the immediately
previous PWA contract during upgrade and rollback. Removed fields require the same staged contract
process as database fields.

## Release Identity And Evidence

Web, Worker, and Edge expose non-secret release metadata containing environment, Git SHA, artifact
version, and compatibility version. Production smoke proves all layers agree and records the
`x-sb-edge-region` response. Database migration state is checked server-side without exposing the
database URL or private schema detail to the browser.

Logs and evidence may contain timestamps, counts, hashes, public deployment URLs, version IDs, and
sanitized error codes. They must not contain owner payloads, cookies, passwords, database URLs,
provider locators, Vault values, gateway tokens, or encryption keys.

## Failure And Rollback Contract

| Failure point | Required result |
| --- | --- |
| Candidate build or local verification | No remote action |
| Pre-deploy backup | No migration or runtime deployment |
| Migration dry run | No migration or runtime deployment |
| Transactional migration | Transaction rollback; old runtimes remain active |
| Edge deployment | Worker remains on the old version; restore prior Edge bundle if activation changed |
| Worker deployment or production smoke | Roll back Worker and Edge code; retain additive schema |
| Scheduler configuration | Pause scheduler; keep owner routes only if core smoke is safe |
| Backup restore drill | Mark backup health failed and block production migration until corrected |

Automation never restores a production backup automatically because that could overwrite owner writes
created after the backup. Runtime rollback uses the recorded prior Worker version and retained prior
Edge artifact. A schema correction is forward-only unless an explicit, separately reviewed recovery
procedure proves a reversal cannot discard data.

## Verification Matrix

### Repository and workflow contracts

- Branch triggers, permissions, environment names, concurrency, and deploy ordering have executable
  tests.
- PR workflows contain no secret or deploy references.
- A failing child job makes the aggregate gate fail.
- Production rejects fork, tag, arbitrary branch, direct-push, and unapproved candidate events.

### Persistence and backup

- Current owner data round-trips through the new backup version.
- Legacy backup versions migrate forward without inventing owner values.
- Restore rejects wrong owner, duplicate identities, modified ciphertext, modified metadata, and
  unsupported schema versions before writing.
- Failed restore transactions leave the disposable database unchanged.
- Match/provider records are absent from the owner backup.

### Deployment failure injection

- Missing or cross-environment identifiers fail before remote mutation.
- Backup, migration, Edge, Worker, scheduler, and smoke failures stop at the documented boundary.
- Rollback selects the recorded prior version rather than an unqualified latest version.

### Hosted staging

- Same-origin static/API health, login/logout, hardened cookie, saved-cookie replay denial, owner data
  flows, match/detail/live behavior, scheduler delivery, PWA cache upgrade, and redaction pass.
- Tests create only identified synthetic owner rows and must delete them in a mandatory finalizer.
- Final counts match the pre-test owner-data baseline.

### Production smoke

- Static shell, manifest, service worker, release metadata, direct Edge denial, unauthenticated
  same-origin denial, database compatibility state, scheduler target, and Singapore Edge region pass.
- Production smoke performs no owner-data create, update, import, settlement, or delete operation.

## Initial Rollout

1. Reconcile active deployment documentation and retire the Pages-only operational path.
2. Implement secret-free full CI and prove a failing pull request cannot merge.
3. Create and protect `staging` from the owner-selected reviewed baseline.
4. Create the GitHub `staging` Environment and automate the retained Frankfurt deployment.
5. Rehearse a harmless staging release, failed gate, runtime rollback, and evidence lookup.
6. Activate private R2 Standard storage, configure retention and the internal capacity guard, and
   prove encrypted backup/restore using synthetic data only.
7. Create the separate Singapore Supabase project and production Worker without public promotion.
8. Apply all committed migrations to the empty production project and prove zero owner rows.
9. Configure separate production secrets, Vault entries, scheduler definitions, and GitHub
   `production` Environment.
10. Run production artifact and read-only smoke dry runs without serving owner traffic.
11. Open the first real `staging -> main` release pull request and require every gate.
12. The owner merges; automation performs the first backup, migration check, production deployment,
    read-only smoke, and baseline evidence record.

No step treats local verification as hosted evidence or staging evidence as production approval.

## Operational Limits

- Supabase Free does not provide point-in-time recovery, downloadable managed backups, a production
  SLA, or guaranteed immunity from inactivity pausing.
- Supabase currently grants two active Free projects across organizations where the account is an
  owner or administrator. Retained Frankfurt staging plus Singapore production consumes both slots.
  Provisioning must verify that the owner has one free slot; otherwise the phase is blocked until an
  unrelated project is paused/moved or the cost constraint changes.
- Daily backup leaves a worst-case recovery-point window approaching 24 hours for failures unrelated
  to a pre-deploy backup. Pre-deploy backup specifically protects the upgrade boundary.
- R2 has usage-based billing beyond its free allowance and no hard zero-cost cap. The 1 GB internal
  ceiling, retention policy, private access, and alert reduce but do not mathematically eliminate
  billing risk.
- Disaster recovery is manual: create a new Singapore project, apply migrations, restore owner data,
  rehydrate matches, deploy runtimes, rotate secrets, verify, and switch the Worker target.
- Production initially uses a free `workers.dev` origin. A custom domain is a later owner decision.

## Out Of Scope

- Public authentication, multi-tenancy, paid infrastructure, analytics, recommendations, betting
  formulas, or new data providers.
- Copying staging owner data into production.
- Backing up rebuildable match/provider data.
- Supabase preview branches or per-PR hosted databases.
- Automatic database downgrade or automatic production restore.
- Creating remote resources, secrets, branches, rules, or deployments during the design phase.

## References

- Supabase environment management: https://supabase.com/docs/guides/deployment/managing-environments
- Supabase regions: https://supabase.com/docs/guides/platform/regions
- Supabase regional Edge invocation: https://supabase.com/docs/guides/functions/regional-invocation
- Supabase production checklist: https://supabase.com/docs/guides/deployment/going-into-prod
- GitHub protected branches: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches
- GitHub deployment environments: https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- Cloudflare Worker GitHub Actions: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- Cloudflare Worker rollback: https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
