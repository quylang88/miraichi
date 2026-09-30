# Production Delivery Runbook

## Status and non-negotiable boundary

This is the active delivery runbook for Miraichi. `staging` is the hosted candidate branch and
`main` is production. Frankfurt staging uses `eu-central-1`; production uses a separate Supabase
project in Singapore `ap-southeast-1` and a separate Cloudflare Worker. Production starts with
zero production owner rows. Staging owner rows are never copied to production.

Merging the exact green `staging -> main` pull request is the owner's production approval. There is
no second approval after merge: the non-cancelling production workflow starts automatically. Local
success, a green pull request, or a successful staging deployment alone is not production approval.

Stop immediately if a provider requires a paid plan or payment commitment, the readiness report is
blocked, a required artifact is missing/expired, a secret is visible in output, a backup cannot be
read back, or the exact staging candidate cannot be proven. Cloudflare R2 is usage-billed. Expected
free-tier use is a planning target, not a hard cost ceiling. The free stack has no uptime SLA and no
point-in-time recovery.
Operationally, there is no point-in-time recovery and no uptime SLA.

## Delivery topology

1. A short-lived change branch opens a pull request to protected `staging`.
2. `quality-gate` runs the full secret-free verification graph. A failed or skipped child blocks it.
3. Merge to `staging` deploys the exact SHA to Frankfurt and records a bounded
   `miraichi-release-<sha>` artifact plus GitHub deployment status.
4. Inspect hosted staging and clean all synthetic owner rows in a finalizer, even when the smoke
   test fails.
5. Open the single `staging -> main` pull request. Both `quality-gate` and `release-candidate` must
   pass. The latter proves the latest exact-SHA staging deployment, artifact, manifest, tree, and
   hosted evidence.
6. The owner reviews sanitized evidence and merges. The main push downloads only that verified
   candidate, creates an encrypted owner backup, dry-runs/applies additive migrations, deploys Edge
   and Worker/PWA, configures the scheduler, runs read-only smoke, and retains exact rollback
   evidence.

The protected branch rules are in `docs/operations/github/staging-ruleset.json` and
`docs/operations/github/main-ruleset.json`. They require pull requests, resolved conversations,
blocked force-push/deletion, `quality-gate`, and on `main` also `release-candidate`. There is no
independent reviewer requirement for this owner-only repository; administrators must not bypass
the rules as normal operation.

## Remote readiness

Create a gitignored `.secrets/remote-readiness.json` matching `RemoteReadinessInput` in
`scripts/release/remote-readiness.ts`, then run:

```powershell
pnpm run release:readiness .secrets/remote-readiness.json
```

The committed contract itself is checked without remote values by:

```powershell
pnpm run release:readiness --fixture
```

Only logical missing names are printed. A ready result must prove:

- distinct `staging` and `production` GitHub Environments;
- distinct Supabase project refs, Worker names, public origins, and Edge URLs;
- Frankfurt `eu-central-1` staging and Singapore `ap-southeast-1` production;
- a private production R2 bucket and an independently retained offline encryption key;
- both rulesets active with the exact required checks;
- no localhost or loopback production endpoint;
- either a provisioned production project or an available Supabase Free project slot while it is
  being created.

Before changing any existing remote rule, export its current sanitized configuration. Every remote
mutation has an immediate proof and stop/rollback boundary:

| Mutation | Verify immediately | Stop or rollback |
| --- | --- | --- |
| Create `staging`, GitHub Environments, and rulesets | Read back branch target, environment names, bypass actors, and exact checks; prove a direct push/failing PR cannot merge | Do not push candidates until corrected; restore the exported prior main ruleset if protection regresses |
| Activate private R2 bucket/credentials | Prove no public access, bucket-scoped credentials, encrypted write/readback, and retention plan | Revoke credentials and block backup/deploy if policy or readback is wrong; do not upload plaintext |
| Create Singapore Supabase/Worker | Prove distinct IDs, `ap-southeast-1`, direct Edge denial, and zero owner rows | Leave the resource unused; never repurpose Frankfurt or delete a project without separate approval |
| Enter/rotate secrets | List names only and run the relevant auth/readback smoke | Revoke and rotate any exposed/mismatched value; never weaken gateway or TLS checks |
| Apply schema | Run exact migration dry-run, history comparison, and preservation checks | Stop runtime deployment; repair only with a reviewed forward migration |
| Deploy Edge/Worker/scheduler | Prove release identity, region, target/Vault names, and read-only smoke | Pause scheduler and restore exact recorded runtime versions; never use `latest` |
| Merge `staging -> main` | Watch backup-first transaction and final GitHub deployment status | The merge cannot be undone as a schema rollback; stop traffic changes and follow exact runtime/data recovery procedures |

## GitHub Environment inventory

Set values only in the corresponding GitHub Environment. Staging and production values must not be
shared even when names are identical.

Staging variables:

- `SUPABASE_PROJECT_REF`
- `MIRAICHI_PUBLIC_ORIGIN`
- `MIRAICHI_EDGE_FUNCTION_URL`
- `MIRAICHI_STAGING_BASELINE_SHA`
- `MIRAICHI_STAGING_BASELINE_EDGE_VERSION_ID`
- `MIRAICHI_STAGING_BASELINE_WORKER_VERSION_ID`
- `MIRAICHI_STAGING_BASELINE_RELEASE_SHA`
- `MIRAICHI_STAGING_BASELINE_RELEASE_ARTIFACT`
- `MIRAICHI_STAGING_BASELINE_SCHEMA_COMPAT_VERSION`

Staging secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DATABASE_URL`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MIRAICHI_GATEWAY_TOKEN`
- `MIRAICHI_OWNER_PASSWORD`

Production variables:

- `SUPABASE_PROJECT_REF`
- `MIRAICHI_PUBLIC_ORIGIN`
- `MIRAICHI_EDGE_FUNCTION_URL`
- `MIRAICHI_OWNER_PROFILE_ID`
- `OWNER_BACKUP_R2_ENDPOINT`
- `OWNER_BACKUP_R2_BUCKET`
- `OWNER_BACKUP_KEY_ID`
- `MIRAICHI_PRODUCTION_BASELINE_SHA`
- `MIRAICHI_PRODUCTION_BASELINE_EDGE_VERSION_ID`
- `MIRAICHI_PRODUCTION_BASELINE_WORKER_VERSION_ID`
- `MIRAICHI_PRODUCTION_BASELINE_RELEASE_SHA`
- `MIRAICHI_PRODUCTION_BASELINE_RELEASE_ARTIFACT`
- `MIRAICHI_PRODUCTION_BASELINE_SCHEMA_COMPAT_VERSION`

Production secrets:

- `SUPABASE_ACCESS_TOKEN`
- `SUPABASE_DB_PASSWORD`
- `SUPABASE_DATABASE_URL`
- `SUPABASE_DATABASE_CA_BASE64`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `MIRAICHI_GATEWAY_TOKEN`
- `OWNER_BACKUP_R2_ACCESS_KEY_ID`
- `OWNER_BACKUP_R2_SECRET_ACCESS_KEY`
- `OWNER_BACKUP_KEY_BASE64`

Enter secret values only in provider/GitHub UI or a trusted interactive prompt. Never paste them
into chat, commands that persist in shell history, artifacts, logs, or tracked files.

## Session pooler for migration runners

The GitHub runner cannot use the Free project's IPv6 direct endpoint. For each environment,
copy **Connect -> Session pooler** from that exact Supabase project. Do not construct a pooler
hostname from the region: the cluster index is provider-assigned. Prefer removing the
`:[YOUR-PASSWORD]` placeholder and reusing the existing `SUPABASE_DB_PASSWORD` Environment secret.
Alternatively, insert the percent-encoded password in the URL. Save the URL as the Environment secret
`SUPABASE_DATABASE_URL` through GitHub UI or `gh secret set` stdin. Never pass a real secret in
`--body` or shell history. Use port 5432, username `postgres.<project-ref>`, database `postgres`,
and SSL `require` or a certificate-verifying mode; transaction mode on port 6543 is rejected.

The release adapter verifies the project username/host/port and rejects unsafe query parameters.
It supplies the migration dry-run/apply commands with a password-free `--db-url` argument and
passes the password only through `PGPASSWORD` (decoded from the URL when supplied, otherwise
read from `SUPABASE_DB_PASSWORD` without percent-decoding). Other remote SQL queries stay on the
pinned CLI's linked Management API path, which does not require a direct Postgres connection.
When the URL is absent, the legacy linked migration path remains available, but a direct IPv6
failure still blocks deployment before mutation. Configure the URL before the next staging release.

## First clean production baseline

Before the first automated production merge:

1. Create the separate Singapore Supabase project and separate production Worker. Do not rename or
   reuse the Frankfurt resources.
2. Apply all committed migrations to the empty Singapore project using the reviewed forward path.
   Never use `supabase db reset --linked`.
3. Query every durable owner table and record zero production owner rows. The tables are owner
   profile, bet drafts, bet records, bankroll accounts, bankroll ledger entries, discipline config,
   and settlement events. A nonzero count is a hard stop.
4. Record the exact deployed baseline Git SHA, Edge version, Worker version, release artifact, and
   schema compatibility in the production Environment variables. These are rollback inputs, not a
   moving `latest` alias.
5. Prove direct Edge access without the gateway token is denied, Edge execution reports
   `ap-southeast-1`, the Worker/Edge release identities agree, and the production smoke performs
   GET/read-only checks only.
6. Create/read back an encrypted empty owner backup and perform the disposable restore test.
7. Hydrate rebuildable match/provider data independently only after the clean owner baseline is
   recorded. Match data is not owner backup data and can be pulled again through the approved
   source pipeline.

## Normal release and evidence review

Before merging `staging -> main`, inspect the candidate SHA, tree ID, artifact digest, migration
hash, staging deployment ID/status, hosted smoke result, and synthetic-data cleanup result. After
merge, watch the complete production workflow. Required order is backup, migration dry-run,
migration apply, Edge, Worker/PWA, scheduler, transaction smoke/evidence, then a second read-only
hosted smoke.

The production artifact is named `miraichi-production-<main-sha>` and contains no secret or owner
payload. It contains the manifest, sanitized deployment evidence, production release metadata, and
exact rollback code artifacts. A successful status is valid only when deploy, smoke, assembly, and
artifact upload all succeed.

## Rollback and stop conditions

The release transaction compensates runtime failures by pausing the scheduler and restoring the
exact prior Worker and Edge identities. It never rolls the database schema backward and never
restores owner data automatically. If the separate hosted smoke fails after the transaction has
already succeeded, stop new releases, inspect the sanitized evidence, and run a reviewed exact-ID
runtime rollback; do not guess versions or use `latest`.

Schema recovery is forward-only: add a reviewed compensating migration compatible with both the old
and new runtime. Owner-data recovery follows `OWNER-DATA-RECOVERY.md`. A failed backup/readback,
wrong region, mismatched release identity, missing rollback artifact, nonzero unexpected owner row,
or any secret exposure blocks promotion.

## Hotfix path

Direct production hotfixes are forbidden. The mandatory main -> staging -> main path is:

1. Branch `hotfix/*` from the exact `main` commit.
2. Merge it by pull request into `staging` and let Frankfurt auto-deploy it.
3. Complete hosted smoke and synthetic owner-row cleanup.
4. Open `staging -> main`; `release-candidate` proves that `main` is still an ancestor and that no
   release-only edits were introduced.
5. The owner merges only after evidence review. Keep the hotfix in `staging` after production.

## Cost and availability truth

- Supabase Free and Cloudflare Free have quotas and no uptime or recovery guarantee.
- The practical recovery point is approximately one successful daily backup, not zero data loss.
- R2 is usage-billed. The repository limits one encrypted object to 16 MB, one owner prefix to 100
  objects, retained ciphertext to 1 GB, and SDK attempts to one. These fail-closed controls keep the
  application far below the current Standard free allocation under normal operation, but they do
  not cap the Cloudflare account bill or protect against unrelated account workloads.
- Set the lowest practical account budget alert after R2 activation and review Billable Usage. The
  alert is informational and delayed; it does not pause usage or provide a zero-cost guarantee.
- No point-in-time recovery, cross-region database failover, or support SLA is provided by this
  design.
