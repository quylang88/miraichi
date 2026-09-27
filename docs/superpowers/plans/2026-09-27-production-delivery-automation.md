# Production Delivery Automation And Owner-Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a tested `change branch -> staging -> main` delivery path that automatically deploys Frankfurt staging and clean Singapore production while preserving and recoverably backing up durable owner data.

**Architecture:** Keep GitHub Actions as thin orchestration over tested TypeScript release modules. Staging and production share release code but use explicit, non-interchangeable target contracts; production promotion consumes the exact successful staging artifact, creates an encrypted owner-data backup before mutation, applies compatible migrations, deploys Edge and Worker/PWA as one recorded release, and runs read-only smoke checks. Remote provisioning and branch protection are a final operational gate because they depend on real provider accounts and cannot be proven by repository tests alone.

**Tech Stack:** Node.js 22 in CI, TypeScript 6, pnpm 10.18.3, Vitest 4, Supabase CLI 2.109.0, Cloudflare Wrangler 4.128.0, GitHub Actions, Postgres/Supabase, Cloudflare Workers Static Assets, private Cloudflare R2 Standard, Node `crypto` AES-256-GCM, AWS SDK S3 client for R2.

**Spec:** `docs/superpowers/specs/2026-09-27-production-delivery-automation-design.md`

## Global Constraints

- `main` is production and `staging` is the only production release source; change branches cannot deploy.
- Staging remains Frankfurt `eu-central-1`; production is a separate Supabase project in Singapore `ap-southeast-1` and a separate Cloudflare Worker.
- Production begins with zero owner rows. No staging owner row, match row, provider state, secret, or session is copied.
- The operating target is provider free tiers, not a guarantee of zero billing, uptime, or a hard spending cap.
- Durable owner data is backed up; rehydratable match/provider data and transient discipline challenges are excluded.
- No plaintext backup, database URL, cookie, password, provider locator, Vault value, gateway token, R2 secret, or encryption key may enter a log or GitHub artifact.
- All new application and release modules are TypeScript. Keep owner-only and competition-agnostic boundaries intact.
- Normal releases use additive expand/backfill/contract migrations. Never run `supabase db reset --linked`.
- PWA shell, Worker, and Edge deploy as a complete version; there is no split-traffic rollout.
- Every code slice follows RED -> minimal GREEN -> focused checks -> self-review -> relevant gate -> one conventional commit.
- `pnpm run verify:local` is local evidence only; hosted staging evidence and an owner merge are separate gates.
- Do not push, create remote resources, configure secrets/rules, or deploy until all repository slices pass and the operational rollout task is reached.

## Review Focus

- A PR, tag, fork, stale artifact, or arbitrary branch must never acquire staging/production credentials or trigger a deployment; Tasks 8-11 pin event and provenance rejection.
- A wrong key, modified authenticated metadata, partial upload, hash mismatch, or wrong owner must fail before any restore or deployment mutation; Tasks 4-6 pin fail-closed behavior.
- A migration that passes static scanning but loses owner data or breaks the previous runtime must fail executable empty/prior-schema preservation checks; Task 7 owns these cases.
- Mismatched web, Worker, Edge, tree, migration, or compatibility identities must fail smoke/promotion instead of accepting `latest`; Tasks 2, 8, and 9 pin cross-layer equality.
- A failure after migration, Edge, Worker, scheduler, or smoke must stop at the documented boundary and select the recorded prior version, never an unqualified latest version; Task 8 owns failure injection.

---

### Task 1: Lock The Two Release Targets

**Files:**
- Create: `packages/config/src/release-targets.ts`
- Create: `packages/config/src/release-targets.test.ts`
- Modify: `packages/config/src/index.ts`
- Modify: `apps/cloudflare-gateway/src/config.ts`
- Modify: `apps/cloudflare-gateway/src/config.test.ts`
- Modify: `apps/cloudflare-gateway/wrangler.jsonc`
- Modify: `scripts/cloudflare-owner-hosting-verify.ts`
- Modify: `scripts/cloudflare-owner-hosting-verify.test.ts`

**Interfaces:**
- Produces `ReleaseEnvironment = 'staging' | 'production'`.
- Produces `ReleaseTarget { environment, branch, edgeRegion, cloudflareEnvironment, requiresOwnerBackup }`.
- Produces `getReleaseTarget(environment: string): ReleaseTarget` and `assertReleaseTargetBindings(target, bindings): void`.
- Extends `CloudflareGatewayConfig` to the two valid environment/region pairs only.

- [ ] **Step 1: Write failing target and gateway tests.** Assert `staging -> staging/eu-central-1/no backup`, `production -> main/ap-southeast-1/backup`, reject unknown targets, reject crossed identifiers/regions, reject localhost production URLs, and require both Wrangler environments.
- [ ] **Step 2: Run `pnpm exec vitest run packages/config/src/release-targets.test.ts apps/cloudflare-gateway/src/config.test.ts scripts/cloudflare-owner-hosting-verify.test.ts`.** Expected: FAIL because the production target does not exist.
- [ ] **Step 3: Implement the target contract and make the Cloudflare verifier accept only the two exact mappings.** Keep the existing forbidden-binding scan and exact HTTPS-origin checks.
- [ ] **Step 4: Run the focused tests and `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Review the slice.** Inspect for any implicit default to production, staging credential reuse, or weakened forbidden-binding rule; fix before proceeding.
- [ ] **Step 6: Run `pnpm run verify:product-boundary && pnpm run verify:lifecycle` and commit.**

```bash
git add packages/config apps/cloudflare-gateway scripts/cloudflare-owner-hosting-verify.ts scripts/cloudflare-owner-hosting-verify.test.ts
git commit -m "feat(release): define isolated deployment targets"
```

### Task 2: Give Every Runtime One Immutable Release Identity

**Files:**
- Create: `packages/shared/src/contracts/release-metadata.ts`
- Create: `packages/shared/src/contracts/release-metadata.test.ts`
- Modify: `packages/shared/src/contracts/index.ts`
- Create: `scripts/release/release-manifest.ts`
- Create: `scripts/release/release-manifest.test.ts`
- Modify: `apps/api/src/runtime/api-runtime.ts`
- Modify: `apps/api/src/runtime/edge-runtime-composition.ts`
- Modify: `apps/api/src/api-router.ts`
- Modify: `apps/api/src/routes/health.ts`
- Modify: `apps/api/src/routes/health.test.ts`
- Modify: `apps/cloudflare-gateway/src/index.ts`
- Modify: `apps/cloudflare-gateway/src/index.test.ts`
- Modify: `apps/web/scripts/build-static.ts`
- Modify: `apps/web/scripts/build-static.test.ts`
- Modify: `apps/web/public/service-worker.ts`
- Modify: `apps/web/src/pwa/service-worker.test.ts`

**Interfaces:**
- Produces `ReleaseMetadata { environment, gitSha, artifactVersion, compatibilityVersion }` and `readReleaseMetadata(env): ReleaseMetadata`.
- Produces `ReleaseManifest { schemaVersion: 'miraichi.release.v1', sourceSha, treeId, migrationHash, webHash, edgeHash, workerHash, toolchain, builtAt }`.
- Produces `createReleaseManifest(input): ReleaseManifest`, `canonicalReleaseManifest(manifest): string`, and `sha256FileTree(root): Promise<string>`.
- `/api/v1/health`, Worker response headers, and generated `dist/release.json` expose the same non-secret release fields.

- [ ] **Step 1: Write failing tests.** Assert strict 40-character lowercase SHA input, stable canonical hashes independent of directory enumeration order, health/gateway equality, generated `release.json`, and service-worker cache `miraichi-shell-<webHash>` while deleting only older `miraichi-shell-*` caches.
- [ ] **Step 2: Run the new/focused Vitest files.** Expected: FAIL on missing release contract and the hand-maintained `v17` cache.
- [ ] **Step 3: Implement metadata parsing, canonical manifest hashing, runtime exposure, and build-time service-worker token replacement.** Do not expose database migration details or secret values to the browser.
- [ ] **Step 4: Run focused tests, `pnpm run build:web-static`, `pnpm run pwa:verify`, and `pnpm run typecheck`.** Expected: PASS with a content-derived cache and generated release file.
- [ ] **Step 5: Review the slice.** Confirm the static hash excludes timestamps/generated manifest recursion, cache activation preserves IndexedDB/auth state, and all public metadata is non-secret.
- [ ] **Step 6: Run `pnpm run verify:local` and commit.**

```bash
git add packages/shared scripts/release apps/api apps/cloudflare-gateway apps/web
git commit -m "feat(release): add immutable release identity"
```

### Task 3: Version A Complete Owner Backup Contract

**Files:**
- Modify: `packages/shared/src/contracts/cloud-persistence-contracts.ts`
- Modify: `packages/shared/src/contracts/cloud-persistence-contracts.test.ts`
- Modify: `apps/api/src/persistence/cloud-persistence-adapter.ts`
- Modify: `apps/api/src/persistence/memory-cloud-persistence-adapter.ts`
- Modify: `apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts`
- Modify: `apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.ts`
- Modify: `apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts`
- Modify: `apps/api/src/routes/backups.ts`
- Modify: `apps/api/src/routes/backups.test.ts`
- Modify: `apps/web/src/services/backup-service.ts`
- Modify: `apps/web/src/services/backup-service.test.ts`
- Modify: `tests/integration/core-betting-journal.test.ts`
- Create: `apps/api/src/persistence/supabase/sql/owner-backup-v3.sql`
- Create: `apps/api/src/persistence/supabase/sql/owner-backup-v3.test.ts`
- Create: `supabase/migrations/20260927100000_owner_backup_v3.sql`

**Interfaces:**
- Produces `OwnerProfileBackup { ownerProfileId, label, settings, createdAt, updatedAt }`.
- Produces `CloudBackupEnvelopeV3` with schema `miraichi.cloud-backup.v3`, `ownerProfile`, V2 durable collections, `recordCounts`, and `payloadSha256`; the hash is calculated over canonical V3 JSON with the `payloadSha256` field omitted.
- `CloudBackupEnvelope` remains a V1/V2/V3 union; import accepts all three and export emits V3 only.

- [ ] **Step 1: Write failing contract/adapter/route/web tests.** Round-trip profile settings plus drafts, bets, accounts, ledger, discipline config, and settlement events; assert matches, provider state, sessions, receipts, live state, and challenges are absent; assert V1/V2 still import without invented profile values; assert wrong owner/duplicate IDs fail before writes and a transaction failure leaves storage unchanged; assert the browser exports/imports V3 while still accepting a selected legacy V1/V2 file.
- [ ] **Step 2: Run `pnpm exec vitest run packages/shared/src/contracts/cloud-persistence-contracts.test.ts apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts apps/api/src/routes/backups.test.ts apps/api/src/persistence/supabase/sql/owner-backup-v3.test.ts apps/web/src/services/backup-service.test.ts tests/integration/core-betting-journal.test.ts`.** Expected: FAIL because only V1/V2 exist.
- [ ] **Step 3: Implement V3 export/import and the additive receipt constraint migration.** Restore profile first, then accounts, drafts/bets, settlement events, and ledger inside one transaction; do not create match foreign-key requirements.
- [ ] **Step 4: Run the focused tests, `pnpm run provider:local-sql-smoke`, and `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Review the slice.** Trace every durable table from the spec to one field and prove every excluded table is absent; inspect legacy behavior and restore ordering.
- [ ] **Step 6: Run `pnpm run verify:local` and commit.**

```bash
git add packages/shared apps/api apps/web/src/services/backup-service.ts apps/web/src/services/backup-service.test.ts tests/integration/core-betting-journal.test.ts supabase/migrations/20260927100000_owner_backup_v3.sql
git commit -m "feat(backup): version complete owner data exports"
```

### Task 4: Encrypt And Authenticate Backup Envelopes

**Files:**
- Create: `scripts/release/owner-backup-crypto.ts`
- Create: `scripts/release/owner-backup-crypto.test.ts`

**Interfaces:**
- Produces `EncryptedOwnerBackupV1 { envelopeVersion: 'miraichi.owner-backup.aes-gcm.v1', algorithm: 'AES-256-GCM', keyId, nonceBase64, tagBase64, ciphertextBase64, authenticatedMetadata, ciphertextSha256 }`.
- Produces `parseBackupKey(base64: string): Buffer`, `encryptOwnerBackup(input, key): EncryptedOwnerBackupV1`, and `decryptOwnerBackup(envelope, key): CloudBackupEnvelopeV3`.
- Authenticated metadata is exactly environment, backup schema version, owner identity, export timestamp, and plaintext SHA-256.

- [ ] **Step 1: Write failing crypto tests.** Assert round-trip with a 32-byte key, random 12-byte nonces, 16-byte tags, deterministic canonical plaintext hash, and rejection of short keys, wrong keys, changed owner/environment/timestamp/hash, changed ciphertext, and unsupported versions before plaintext is returned.
- [ ] **Step 2: Run `pnpm exec vitest run scripts/release/owner-backup-crypto.test.ts`.** Expected: FAIL because the module is missing.
- [ ] **Step 3: Implement AES-256-GCM with Node `crypto`, canonical UTF-8 JSON, explicit AAD, and constant-shape sanitized errors.** Never accept plaintext file paths or log payload/key material.
- [ ] **Step 4: Run the focused test and `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Review the slice.** Verify nonce generation uses `randomBytes`, AAD is byte-for-byte stable, and errors cannot echo inputs.
- [ ] **Step 6: Run `pnpm run verify:local` and commit.**

```bash
git add scripts/release/owner-backup-crypto.ts scripts/release/owner-backup-crypto.test.ts
git commit -m "feat(backup): encrypt owner backup artifacts"
```

### Task 5: Store Encrypted Backups In Bounded Private R2

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Create: `scripts/release/r2-owner-backup-store.ts`
- Create: `scripts/release/r2-owner-backup-store.test.ts`

**Interfaces:**
- Adds the locked `@aws-sdk/client-s3` development dependency for the S3-compatible R2 API.
- Produces `StoredBackupObject { key, size, uploadedAt, ciphertextSha256, metadata }`.
- Produces `OwnerBackupStore { list(), put(), head(), get(), delete() }` and `createR2OwnerBackupStore(config)`.
- Produces `planBackupRetention(objects, now): { keep, remove, projectedBytes }` with 30 daily, 12 monthly, and a 1,000,000,000-byte ceiling.

- [ ] **Step 1: Write failing store/retention tests.** Assert private bucket calls, environment/owner/date/hash object keys, upload-then-HEAD/readback verification, daily/monthly retention, idempotent retry, ceiling refusal before PUT, no deletion after a failed PUT, and rejection of metadata/hash mismatch or cross-environment objects.
- [ ] **Step 2: Run `pnpm exec vitest run scripts/release/r2-owner-backup-store.test.ts`.** Expected: FAIL because the store does not exist.
- [ ] **Step 3: Add the SDK and implement the store behind the interface.** Inject the S3 client in tests; set no public ACL; delete only objects selected after a verified new upload.
- [ ] **Step 4: Run the focused test, `pnpm install --frozen-lockfile`, and `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Review the slice.** Confirm object listing cannot cross bucket/prefix, credentials never appear in thrown errors, and 1 GB is an internal refusal threshold rather than a claimed provider cap.
- [ ] **Step 6: Run `pnpm run verify:local` and commit.**

```bash
git add package.json pnpm-lock.yaml scripts/release/r2-owner-backup-store.ts scripts/release/r2-owner-backup-store.test.ts
git commit -m "feat(backup): add bounded private R2 storage"
```

### Task 6: Orchestrate Backup Creation And Disposable Restore Drills

**Files:**
- Create: `scripts/release/owner-backup-runtime.ts`
- Create: `scripts/release/owner-backup-runtime.test.ts`
- Create: `scripts/release/owner-backup-cli.ts`
- Create: `scripts/release/owner-backup-cli.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `createAndVerifyOwnerBackup({ adapter, store, key, target, ownerProfileId, now }): Promise<BackupReceipt>`.
- Produces `restoreOwnerBackupToDisposableDatabase({ envelope, adapter, expectedOwner }): Promise<RestoreReport>`.
- CLI commands are `create`, `verify-latest`, and `restore-local`; `restore-local` rejects any non-local database host.

- [ ] **Step 1: Write failing orchestration tests.** Assert validation/encryption/upload/readback/receipt order, no remote mutation after export or upload failure, wrong-owner rejection before import, relationship/count verification after restore, unchanged target on failed transaction, local-host enforcement, and zero match/provider collections.
- [ ] **Step 2: Run `pnpm exec vitest run scripts/release/owner-backup-runtime.test.ts scripts/release/owner-backup-cli.test.ts`.** Expected: FAIL because the runtime is missing.
- [ ] **Step 3: Implement the dependency-injected runtime and CLI.** Reuse the Supabase persistence adapter; output only receipt IDs, counts, hashes, timestamps, and sanitized status codes.
- [ ] **Step 4: Add `backup:owner:create`, `backup:owner:verify`, and `backup:owner:restore-local` scripts; run focused tests and `pnpm run typecheck`.** Expected: PASS.
- [ ] **Step 5: Review the slice.** Confirm plaintext exists only in memory, production restore is impossible through this CLI, and receipt creation happens only after verified storage.
- [ ] **Step 6: Run `pnpm run verify:local` and commit.**

```bash
git add package.json scripts/release/owner-backup-runtime.ts scripts/release/owner-backup-runtime.test.ts scripts/release/owner-backup-cli.ts scripts/release/owner-backup-cli.test.ts
git commit -m "feat(backup): automate backup and restore verification"
```

### Task 7: Enforce Compatible Migration Policy Executably

**Files:**
- Create: `scripts/release/migration-policy.ts`
- Create: `scripts/release/migration-policy.test.ts`
- Create: `scripts/release/verify-migrations.ts`
- Create: `scripts/release/verify-migrations.test.ts`
- Create: `tests/integration/production-migration-preservation.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `auditMigrationSql(path, sql): MigrationFinding[]` and `verifyMigrationSet({ baseSha, headSha, migrations }): MigrationReport`.
- Produces `MigrationRunner` injection for empty-database and prior-schema tests.
- Adds `verify:migrations` and includes it in `verify:release`.

- [ ] **Step 1: Write failing policy tests.** Reject linked reset, `TRUNCATE`, owner-table/column deletion, owner-data `ON DELETE CASCADE`, lossy type changes, unbounded updates, altered historical migrations, and contract removal without a compatibility declaration; accept additive V3 constraint work and bounded idempotent backfill patterns.
- [ ] **Step 2: Write the failing integration test.** Seed a prior-schema owner profile, draft, bet, account, ledger, discipline config, and settlement event; apply pending migrations; assert byte-equivalent durable values and that both current and immediately previous contract readers work.
- [ ] **Step 3: Run the two focused commands.** Expected: FAIL because the verifier is missing.
- [ ] **Step 4: Implement changed-file discovery, static findings, migration-list hashing, and injected Supabase CLI runners.** Scope static checks to new/changed migrations while executable tests always exercise the full ordered set.
- [ ] **Step 5: Run focused tests, local Supabase empty/prior-schema verification, and `pnpm run typecheck`.** Expected: PASS; if Docker/local Supabase is unavailable, stop and report rather than mark the integration check green.
- [ ] **Step 6: Review the slice.** Inspect false negatives around comments/dynamic SQL and confirm no command can construct `db reset --linked`.
- [ ] **Step 7: Run `pnpm run verify:release` and commit.**

```bash
git add package.json scripts/release/migration-policy.ts scripts/release/migration-policy.test.ts scripts/release/verify-migrations.ts scripts/release/verify-migrations.test.ts tests/integration/production-migration-preservation.test.ts
git commit -m "feat(migrations): gate destructive production changes"
```

### Task 8: Make Deployment A Tested Transaction With Rollback

**Files:**
- Create: `scripts/release/command-runner.ts`
- Create: `scripts/release/command-runner.test.ts`
- Create: `scripts/release/deployment-runtime.ts`
- Create: `scripts/release/deployment-runtime.test.ts`
- Create: `scripts/release/deploy-release.ts`
- Create: `scripts/release/deploy-release.test.ts`
- Create: `scripts/release/production-smoke.ts`
- Create: `scripts/release/production-smoke.test.ts`
- Create: `scripts/release/deployment-evidence.ts`
- Create: `scripts/release/deployment-evidence.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `CommandRunner.run(command, args, options)` using argument arrays only.
- Produces `ReleaseOperations` for validate, backup, migration dry-run/apply, Edge deploy/rollback, Worker deploy/rollback, scheduler configure/pause, smoke, and evidence record.
- Produces `runDeployment(plan, operations): Promise<DeploymentEvidence>` and `runProductionSmoke(input): Promise<ProductionSmokeReport>`.
- Adds `release:deploy`, `verify:production:hosted`, and `release:evidence:verify`.

- [ ] **Step 1: Write failing transaction tests.** Inject a failure at every stage; assert no later step runs, backup failure causes zero remote mutation, migration failure leaves runtimes old, Edge failure leaves Worker old, Worker/smoke failure restores the recorded prior Edge/Worker IDs, scheduler failure pauses it, schema is never rolled back destructively, and no code selects `latest`.
- [ ] **Step 2: Write failing smoke/evidence tests.** Assert shell/manifest/service-worker health, direct Edge denial, unauthenticated same-origin denial, release equality, schema compatibility, scheduler target, `x-sb-edge-region=ap-southeast-1`, and absence of owner-data mutation methods.
- [ ] **Step 3: Run the focused release tests.** Expected: FAIL because the transaction runtime does not exist.
- [ ] **Step 4: Implement the orchestrator and CLI adapters for pinned Supabase/Wrangler commands.** Production order must match the nine steps in the spec; staging uses the same code path without production backup.
- [ ] **Step 5: Run focused tests, `pnpm run cloudflare:artifact:verify`, `pnpm run edge:function:build`, and `pnpm run typecheck`.** Expected: PASS without a remote call.
- [ ] **Step 6: Review the slice.** Check command arguments for injection, redaction, exact prior-version selection, and behavior when rollback itself fails; preserve primary and rollback error codes in sanitized evidence.
- [ ] **Step 7: Run `pnpm run verify:release` and commit.**

```bash
git add package.json scripts/release
git commit -m "feat(deploy): add transactional release orchestration"
```

### Task 9: Build The Secret-Free Full PR And Candidate Gates

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/release-candidate.yml`
- Modify: `scripts/github-actions-ci-workflow.test.ts`
- Create: `scripts/github-actions-release-candidate-workflow.test.ts`
- Create: `scripts/release/release-candidate.ts`
- Create: `scripts/release/release-candidate.test.ts`
- Modify: `scripts/hosted-deployment-boundary.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `verifyReleaseCandidate(input): CandidateVerification` for exact `staging -> main`, ancestry, merged-tree equality, successful staging deployment, exact artifact name/SHA, manifest hashes, and no release-only edits.
- The only required aggregate PR check is named `quality-gate`; the main PR also requires uniquely named `release-candidate`.

- [ ] **Step 1: Rewrite/add failing workflow contract tests.** Assert `pull_request` only for `staging`/`main`, read-only permissions, no environment/secrets/deploy commands, visible child jobs for every spec gate, `quality-gate` depends on all of them and fails on any failed/cancelled dependency.
- [ ] **Step 2: Write failing candidate tests.** Reject wrong head/base, fork, tag, non-ancestor main, stale/expired artifact, unsuccessful deployment, mismatched tree/hash, and a merge tree with release-only changes; accept only the exact staging SHA evidence.
- [ ] **Step 3: Run the three workflow/candidate tests.** Expected: FAIL against the current check-only CI.
- [ ] **Step 4: Implement the full CI matrix, aggregate gate, release-candidate workflow, and tested provenance parser.** No job in either PR workflow may reference deployment environment secrets.
- [ ] **Step 5: Run focused tests and `pnpm run verify:release`.** Expected: PASS.
- [ ] **Step 6: Review the slice.** Compare every required workflow component in the spec to an actual job and dependency; check duplicate check names and pull-request privilege escalation.
- [ ] **Step 7: Commit.**

```bash
git add .github/workflows/ci.yml .github/workflows/release-candidate.yml scripts package.json
git commit -m "ci: enforce full pull request release gates"
```

### Task 10: Auto-Deploy Every Green `staging` Push

**Files:**
- Create: `.github/workflows/deploy-staging.yml`
- Create: `scripts/github-actions-staging-deploy-workflow.test.ts`
- Modify: `scripts/hosted-deployment-boundary.test.ts`
- Modify: `scripts/owner-hosted-deployment-readiness.test.ts`

**Interfaces:**
- Workflow trigger is exactly `push.branches: [staging]` plus manual recovery dispatch.
- Uses GitHub Environment `staging`, concurrency `miraichi-staging-deploy` with `cancel-in-progress: false`, immutable checked-out SHA, `miraichi-release-<40-char-sha>` evidence artifact, and the Task 8 CLI.

- [ ] **Step 1: Write the failing workflow test.** Assert frozen install, `verify:staging`, manifest generation, migration compare/dry-run/apply, Edge then Worker then scheduler, committed hosted verification, success/failure deployment status, bounded artifact retention, and no production/R2 secret name.
- [ ] **Step 2: Run `pnpm exec vitest run scripts/github-actions-staging-deploy-workflow.test.ts scripts/hosted-deployment-boundary.test.ts scripts/owner-hosted-deployment-readiness.test.ts`.** Expected: FAIL because staging deploy automation is absent.
- [ ] **Step 3: Implement the thin workflow using environment-scoped variables/secrets and `release:deploy --environment staging`.** Never build from a moving branch ref after checkout.
- [ ] **Step 4: Run focused tests, `pnpm run cloudflare:artifact:verify`, and a local dry-run of release planning.** Expected: PASS with zero remote mutation.
- [ ] **Step 5: Review the slice.** Check non-cancelling concurrency, secret scope, failed status reporting, and exact artifact naming.
- [ ] **Step 6: Run `pnpm run verify:release` and commit.**

```bash
git add .github/workflows/deploy-staging.yml scripts/github-actions-staging-deploy-workflow.test.ts scripts/hosted-deployment-boundary.test.ts scripts/owner-hosted-deployment-readiness.test.ts
git commit -m "ci: automate Frankfurt staging deployment"
```

### Task 11: Auto-Deploy Approved Production And Schedule Backups

**Files:**
- Create: `.github/workflows/deploy-production.yml`
- Create: `.github/workflows/backup-production.yml`
- Create: `scripts/github-actions-production-workflows.test.ts`
- Modify: `scripts/hosted-deployment-boundary.test.ts`
- Modify: `scripts/owner-hosted-deployment-readiness.test.ts`

**Interfaces:**
- Production deploy trigger is exactly `push.branches: [main]`; it resolves the merged `staging` PR SHA, downloads only that candidate artifact, verifies tree/hash equality, then runs `release:deploy --environment production`.
- Backup workflow supports daily cron/manual creation and weekly disposable restore; it has no application deployment permission.
- Uses GitHub Environment `production` and non-cancelling concurrency groups.

- [ ] **Step 1: Write failing production workflow tests.** Reject arbitrary direct-push context/fork/tag, require successful candidate provenance before production secrets are used, require predeploy backup before migration, exact deployment order, read-only smoke, evidence retention, and rollback invocation on failure.
- [ ] **Step 2: Add failing backup workflow tests.** Assert daily encrypted create/verify, weekly local-only restore, guaranteed disposable cleanup, no deploy command/permission, and no plaintext artifact step.
- [ ] **Step 3: Run the focused workflow/boundary tests.** Expected: FAIL because production workflows are absent.
- [ ] **Step 4: Implement both workflows as thin calls into Tasks 6 and 8.** Use named environment values only; never echo or persist secret values.
- [ ] **Step 5: Run focused tests and local dry-runs for production planning/backup planning.** Expected: PASS with zero remote mutation.
- [ ] **Step 6: Review the slice.** Inspect credential reachability per job, candidate lookup on merge commits, backup-first ordering, weekly teardown on failure, and all concurrency settings.
- [ ] **Step 7: Run `pnpm run verify:release` and commit.**

```bash
git add .github/workflows/deploy-production.yml .github/workflows/backup-production.yml scripts/github-actions-production-workflows.test.ts scripts/hosted-deployment-boundary.test.ts scripts/owner-hosted-deployment-readiness.test.ts
git commit -m "ci: automate approved production delivery"
```

### Task 12: Make Remote Readiness And Operations Explicit

**Files:**
- Create: `scripts/release/remote-readiness.ts`
- Create: `scripts/release/remote-readiness.test.ts`
- Create: `docs/operations/PRODUCTION-DELIVERY.md`
- Create: `docs/operations/OWNER-DATA-RECOVERY.md`
- Create: `docs/operations/github/staging-ruleset.json`
- Create: `docs/operations/github/main-ruleset.json`
- Modify: `.env.example`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/RELEASE-WORKFLOW.md`
- Modify: `docs/operations/README.md`
- Modify: `docs/operations/RUNBOOK.md`
- Modify: `docs/operations/DEPLOYMENT-AND-ENVIRONMENTS.md`
- Modify: `PROJECT_PLAN.md`
- Modify: `package.json`

**Interfaces:**
- Produces `checkRemoteReadiness(input): ReadinessReport` listing missing logical names only, never values.
- Adds `release:readiness` for staging/production preflight.
- Ruleset templates require PRs, resolved conversations, `quality-gate`, and for `main` also `release-candidate`; direct/force pushes and deletion are blocked.

- [ ] **Step 1: Write failing readiness tests.** Assert missing free Supabase slot, duplicate project/Worker IDs, wrong regions, public/missing R2 bucket, missing offline key confirmation, missing GitHub environments/rules, localhost production URLs, and any shared staging/production identifier block readiness without exposing values.
- [ ] **Step 2: Run `pnpm exec vitest run scripts/release/remote-readiness.test.ts`.** Expected: FAIL because the checker is absent.
- [ ] **Step 3: Implement the checker and write the two runbooks/ruleset templates.** Document recovery point near 24 hours, no PITR/SLA, R2 usage billing risk, manual forward-only schema recovery, exact secret names, rotation, rollback, the `main -> staging -> main` hotfix path, staging synthetic-data cleanup, and first clean-production checks.
- [ ] **Step 4: Rewrite historical Pages/Tokyo operational claims as superseded where still active.** Preserve historical decision records; do not falsify past evidence.
- [ ] **Step 5: Run focused tests, `pnpm run verify:lifecycle`, `pnpm run verify:product-boundary`, `pnpm run release:readiness -- --fixture`, and `git diff --check`.** Expected: PASS.
- [ ] **Step 6: Review the slice.** Follow both runbooks from a clean reader's perspective and confirm every remote mutation has a verification and rollback/stop condition.
- [ ] **Step 7: Run `pnpm run verify:staging` and commit.**

```bash
git add .env.example docs scripts/release/remote-readiness.ts scripts/release/remote-readiness.test.ts PROJECT_PLAN.md package.json
git commit -m "docs: add production delivery operations"
```

### Task 13: Provision, Rehearse, And Promote The Real Environments

**Files:**
- Modify after evidence exists: `docs/operations/PRODUCTION-DELIVERY.md`
- Modify after evidence exists: `PROJECT_PLAN.md`

**Interfaces:**
- Consumes all repository gates and runbooks from Tasks 1-12.
- Produces provider-side projects, GitHub rules/environments, a successful Frankfurt rehearsal, an empty Singapore baseline, and sanitized release evidence.

- [ ] **Step 1: Run the full local closeout.** Run `pnpm run verify:staging`, `git diff --check`, and the staged secret scan. Stop on any failure.
- [ ] **Step 2: Push the reviewed implementation branch using `.agent/skills/miraichi-safe-github-push/SKILL.md`.** Do not create `staging` from an unreviewed or dirty tree.
- [ ] **Step 3: Verify provider prerequisites manually.** Confirm one Supabase Free project slot, R2 activation/checkout status, private bucket policy, Cloudflare account access, GitHub Actions availability, and exact free-tier/billing dashboards. If a paid requirement appears, stop for a new owner decision.
- [ ] **Step 4: Create/protect `staging` from the owner-selected reviewed SHA and configure the `staging` GitHub Environment.** Enter secrets only in provider/GitHub UI or trusted CLI prompts; never in chat, shell history, or tracked files.
- [ ] **Step 5: Rehearse Frankfurt staging.** Prove a failed gate cannot merge, a staging push deploys, synthetic owner rows are cleaned in a finalizer, rollback restores recorded versions, and `miraichi-release-<sha>` evidence can be retrieved.
- [ ] **Step 6: Activate private R2 and prove encrypted synthetic backup/restore.** Confirm object metadata/hash, 30-daily/12-monthly retention planning, weekly disposable restore, and no plaintext artifact.
- [ ] **Step 7: Create Singapore Supabase and the separate production Worker, then configure `production`.** Apply all migrations to the empty project; assert zero production owner rows before first use and exact `ap-southeast-1` Edge routing. Record that clean baseline before independently hydrating rebuildable match/provider data through the already approved source pipeline; do not copy staging owner rows.
- [ ] **Step 8: Run production dry-runs without owner traffic.** Verify candidate artifact lookup, migration dry-run, scheduler/Vault name checks, release identity, direct Edge denial, and read-only smoke.
- [ ] **Step 9: Open the first `staging -> main` PR.** Require green `quality-gate`, green `release-candidate`, successful exact-SHA staging deployment, and owner review of sanitized evidence.
- [ ] **Step 10: Merge only after the owner confirms the PR.** The merge is production approval; watch the non-cancelling production workflow through backup, migration, Edge, Worker/PWA, scheduler, smoke, and evidence.
- [ ] **Step 11: Record sanitized evidence and commit the closeout.** Include commit/tree/artifact hashes, version IDs, regions, backup receipt ID/counts, smoke results, and known free-tier limitations; include no secret or owner payload.

```bash
git add docs/operations/PRODUCTION-DELIVERY.md PROJECT_PLAN.md
git commit -m "docs: record production rollout evidence"
```

## Final Whole-Branch Review

- [ ] Map every approved design requirement to Tasks 1-13 and list any deliberate deferral; no implicit omission is allowed.
- [ ] Review the complete branch diff for credential exposure, cross-environment identifiers, deployment privilege, owner-data loss, non-additive schema changes, and production-writing smoke requests.
- [ ] Run `pnpm run verify:staging`, the empty/prior-schema migration checks, release/backup dry-runs, and all workflow contract tests from a clean checkout.
- [ ] Confirm every TDD slice has its RED evidence noted in the commit/review log and one green commit; local success is not reported as hosted success.
- [ ] Use `.agent/skills/miraichi-phase-transition-recommendation/SKILL.md` to name the earliest safe next phase. Do not recommend production while any hosted rehearsal, owner merge, backup/restore proof, or rollback proof is missing.
