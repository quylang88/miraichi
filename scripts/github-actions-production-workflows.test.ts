import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const deploy = readFileSync('.github/workflows/deploy-production.yml', 'utf8');
const backup = readFileSync('.github/workflows/backup-production.yml', 'utf8');
const runtime = readFileSync('scripts/release/deployment-runtime.ts', 'utf8');

describe('GitHub Actions production deployment workflow', () => {
  it('runs only for immutable main pushes with non-cancelling production isolation', () => {
    expect(deploy).toContain('name: Deploy Production');
    expect(deploy).toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- main\s*\n/u);
    expect(deploy).not.toContain('pull_request:');
    expect(deploy).not.toContain('workflow_dispatch:');
    expect(deploy).toContain('environment: production');
    expect(deploy).toContain('group: miraichi-production-deploy');
    expect(deploy).toContain('cancel-in-progress: false');
    expect(deploy).toContain('ref: ${{ github.sha }}');
    expect(deploy).toContain("GITHUB_REF_NAME !== 'main'");
    expect(deploy).toContain('MIRAICHI_RELEASE_ENVIRONMENT: production');
    expect(deploy).toContain('MIRAICHI_EDGE_REGION: ap-southeast-1');
  });

  it('proves the merged staging candidate before any production secret is reachable', () => {
    for (const marker of [
      'github.rest.repos.listPullRequestsAssociatedWithCommit',
      "head.ref !== 'staging'",
      'merge_commit_sha',
      'github.rest.repos.listDeployments',
      'github.rest.repos.listDeploymentStatuses',
      'github.rest.actions.listArtifactsForRepo',
      'miraichi-release-${candidateSha}',
      'actions/download-artifact@v8',
      'digest-mismatch: error',
      'verify:release-candidate -- --github-production'
    ]) expect(deploy).toContain(marker);
    expect(deploy).toMatch(/permissions:\s*\n\s*actions: read\s*\n\s*contents: read\s*\n\s*deployments: write\s*\n\s*pull-requests: read/u);
    const proof = deploy.indexOf('verify:release-candidate -- --github-production');
    const firstSecret = deploy.indexOf('secrets.');
    expect(proof).toBeGreaterThan(0);
    expect(firstSecret).toBeGreaterThan(proof);
    const jobEnvironment = /jobs:[\s\S]*?\n    env:\n([\s\S]*?)\n\n    steps:/u.exec(deploy)?.[1] ?? '';
    expect(jobEnvironment).not.toContain('secrets.');
  });

  it('uses the tested backup-first transaction and a second read-only production smoke', () => {
    for (const marker of [
      'materialize-release-metadata.ts',
      'pnpm run release:deploy',
      'pnpm run verify:production:hosted',
      'SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD',
      'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID',
      'MIRAICHI_GATEWAY_TOKEN', 'SUPABASE_DATABASE_URL', 'SUPABASE_DATABASE_CA_BASE64',
      'OWNER_BACKUP_R2_ENDPOINT', 'OWNER_BACKUP_R2_BUCKET',
      'OWNER_BACKUP_R2_ACCESS_KEY_ID', 'OWNER_BACKUP_R2_SECRET_ACCESS_KEY',
      'OWNER_BACKUP_KEY_ID', 'OWNER_BACKUP_KEY_BASE64'
    ]) expect(deploy).toContain(marker);
    expect(deploy.indexOf('pnpm run release:deploy')).toBeLessThan(deploy.indexOf('pnpm run verify:production:hosted'));
    for (const directMutation of ['supabase db push', 'supabase functions deploy', 'wrangler deploy']) {
      expect(deploy).not.toContain(directMutation);
    }
    const backupIndex = runtime.indexOf('operations.backup');
    const dryRunIndex = runtime.indexOf('operations.migrationDryRun');
    const applyIndex = runtime.indexOf('operations.applyMigrations');
    const edgeIndex = runtime.indexOf('operations.deployEdge');
    const workerIndex = runtime.indexOf('operations.deployWorker');
    const schedulerIndex = runtime.indexOf('operations.configureScheduler');
    const smokeIndex = runtime.indexOf('operations.smoke');
    expect([backupIndex, dryRunIndex, applyIndex, edgeIndex, workerIndex, schedulerIndex, smokeIndex])
      .toEqual([...new Set([backupIndex, dryRunIndex, applyIndex, edgeIndex, workerIndex, schedulerIndex, smokeIndex])].sort((a, b) => a - b));
    expect(runtime).toContain('operations.rollbackWorker');
    expect(runtime).toContain('operations.rollbackEdge');
  });

  it('records both final states and retains exact rollback evidence without latest', () => {
    for (const marker of [
      'github.rest.repos.createDeployment',
      'github.rest.repos.createDeploymentStatus',
      "state: 'success'", "state: 'failure'",
      'if: ${{ always() }}',
      'actions/upload-artifact@v7',
      'name: miraichi-production-${{ github.sha }}',
      'retention-days: 30',
      'MIRAICHI_PRODUCTION_BASELINE_SHA',
      'MIRAICHI_PRIOR_EDGE_VERSION_ID',
      'MIRAICHI_PRIOR_WORKER_VERSION_ID',
      'deployment-evidence.json'
    ]) expect(deploy).toContain(marker);
    expect(deploy).not.toMatch(/name:\s*(?:latest|miraichi-(?:release|production)-latest)/u);
    expect(deploy).not.toContain("statuses.some((status) => status.state === 'success')");
    expect(deploy).toMatch(/Resolve prior successful production rollback artifact[\s\S]*?deployments\.sort\(\(left, right\) => right\.id - left\.id\);[\s\S]*?for \(const deployment of deployments\)/u);
  });
});

describe('GitHub Actions production backup workflow', () => {
  it('supports daily create, weekly disposable restore, and explicit manual modes', () => {
    expect(backup).toContain('name: Backup Production Owner Data');
    expect(backup.match(/- cron:/gu)).toHaveLength(2);
    expect(backup).toContain('workflow_dispatch:');
    expect(backup).toContain('mode:');
    expect(backup).toContain('create');
    expect(backup).toContain('restore-verify');
    expect(backup).toContain('environment: production');
    expect(backup).toContain('group: miraichi-production-backup');
    expect(backup).toContain('cancel-in-progress: false');
    expect(backup.match(/GITHUB_REF_NAME !== 'main'/gu)).toHaveLength(2);
  });

  it('creates and verifies encrypted R2 backups without deploy capability or artifacts', () => {
    expect(backup).toMatch(/permissions:\s*\n\s*contents: read/u);
    expect(backup).not.toContain('deployments: write');
    expect(backup).not.toContain('actions: write');
    expect(backup).toContain('pnpm run backup:owner:create');
    expect(backup).toContain('pnpm run backup:owner:verify');
    expect(backup).not.toContain('actions/upload-artifact');
    for (const forbidden of [
      'release:deploy', 'supabase db push', 'supabase functions deploy', 'wrangler deploy',
      'CLOUDFLARE_API_TOKEN', 'SUPABASE_ACCESS_TOKEN', 'MIRAICHI_PUBLIC_ORIGIN'
    ]) expect(backup).not.toContain(forbidden);
  });

  it('restores only into disposable local Supabase and always tears it down', () => {
    for (const marker of [
      'pnpm exec supabase start',
      'pnpm exec supabase db reset --local',
      'pnpm run backup:owner:restore-local',
      'pnpm exec supabase stop --no-backup',
      'if: ${{ always() }}',
      'postgresql://postgres:postgres@127.0.0.1:15422/postgres'
    ]) expect(backup).toContain(marker);
    expect(backup.indexOf('backup:owner:restore-local')).toBeLessThan(backup.indexOf('supabase stop --no-backup'));
    for (const marker of [
      'OWNER_BACKUP_R2_ENDPOINT', 'OWNER_BACKUP_R2_BUCKET',
      'OWNER_BACKUP_R2_ACCESS_KEY_ID', 'OWNER_BACKUP_R2_SECRET_ACCESS_KEY',
      'OWNER_BACKUP_KEY_ID', 'OWNER_BACKUP_KEY_BASE64'
    ]) expect(backup).toContain(marker);
  });
});
