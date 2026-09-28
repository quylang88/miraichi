import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/deploy-staging.yml', 'utf8');

describe('GitHub Actions staging deployment workflow', () => {
  it('deploys only immutable staging pushes or explicit staging recovery runs', () => {
    expect(workflow).toContain('name: Deploy Staging');
    expect(workflow).toMatch(/on:\s*\n\s*push:\s*\n\s*branches:\s*\n\s*- staging\s*\n\s*workflow_dispatch:/u);
    expect(workflow).not.toContain('pull_request:');
    expect(workflow).toContain('environment: staging');
    expect(workflow).toContain('group: miraichi-staging-deploy');
    expect(workflow).toContain('cancel-in-progress: false');
    expect(workflow).toContain('ref: ${{ github.sha }}');
    expect(workflow).toContain('MIRAICHI_RELEASE_SHA: ${{ github.sha }}');
    expect(workflow).toContain("GITHUB_REF_NAME !== 'staging'");
  });

  it('uses only the minimum permissions and environment-scoped staging values', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s*actions: read\s*\n\s*contents: read\s*\n\s*deployments: write/u);
    expect(workflow).not.toMatch(/^\s+(?:contents|actions|packages|id-token): write$/mu);
    for (const name of [
      'SUPABASE_ACCESS_TOKEN', 'SUPABASE_DB_PASSWORD', 'SUPABASE_PROJECT_REF',
      'CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID',
      'MIRAICHI_PUBLIC_ORIGIN', 'MIRAICHI_EDGE_FUNCTION_URL', 'MIRAICHI_GATEWAY_TOKEN',
      'MIRAICHI_OWNER_PASSWORD'
    ]) expect(workflow).toContain(name);
    for (const forbidden of ['production', 'R2_', 'OWNER_BACKUP_KEY', 'BACKUP_ENCRYPTION']) {
      expect(workflow).not.toContain(forbidden);
    }
    const jobEnvironment = /jobs:[\s\S]*?\n    env:\n([\s\S]*?)\n\n    steps:/u.exec(workflow)?.[1] ?? '';
    expect(jobEnvironment).not.toContain('secrets.');
  });

  it('verifies, builds, manifests, and deploys through the tested transaction in order', () => {
    for (const marker of [
      'pnpm install --frozen-lockfile',
      'pnpm run verify:staging',
      'pnpm run edge:function:build',
      'pnpm run cloudflare:artifact:verify',
      'release-manifest.ts create-workspace',
      'release-manifest.json',
      'pnpm run release:deploy',
      'pnpm run verify:staging:hosted'
    ]) expect(workflow).toContain(marker);
    expect(workflow.indexOf('pnpm run verify:staging')).toBeLessThan(workflow.indexOf('release-manifest.ts create-workspace'));
    expect(workflow.indexOf('release-manifest.ts create-workspace')).toBeLessThan(workflow.indexOf('pnpm run release:deploy'));
    expect(workflow.indexOf('pnpm run release:deploy')).toBeLessThan(workflow.indexOf('pnpm run verify:staging:hosted'));
    for (const directMutation of ['supabase db push', 'supabase functions deploy', 'wrangler deploy']) {
      expect(workflow).not.toContain(directMutation);
    }
  });

  it('records success and failure and retains exact-SHA evidence for a bounded time', () => {
    expect(workflow).toContain('github.rest.repos.createDeployment');
    expect(workflow).toContain('github.rest.repos.createDeploymentStatus');
    expect(workflow).toContain("state: 'success'");
    expect(workflow).toContain("state: 'failure'");
    expect(workflow).toContain('if: ${{ always() }}');
    expect(workflow).toContain('actions/upload-artifact@v7');
    expect(workflow).toContain('name: miraichi-release-${{ github.sha }}');
    expect(workflow).toContain('retention-days: 14');
    expect(workflow).toContain('Assemble immutable candidate artifact');
    expect(workflow).toMatch(/uses: actions\/upload-artifact@v7[\s\S]*?path: artifacts\/candidate\s/u);
    expect(workflow).toContain('deployment-evidence.json');
    expect(workflow).toContain('apps/web/dist');
    expect(workflow).toContain('supabase/functions');
  });

  it('resolves exact prior rollback evidence and never uses a moving latest artifact', () => {
    expect(workflow).toContain('github.rest.repos.listDeployments');
    expect(workflow).toContain('github.rest.repos.listDeploymentStatuses');
    expect(workflow).toContain('github.rest.actions.listArtifactsForRepo');
    expect(workflow).toContain('actions/download-artifact@v8');
    expect(workflow).toContain('digest-mismatch: error');
    expect(workflow).toContain("core.setOutput('run-id'");
    expect(workflow).toContain('run-id: ${{ steps.prior.outputs.run-id }}');
    expect(workflow).toContain('github-token: ${{ github.token }}');
    expect(workflow).toContain('deployment-evidence.ts artifacts/prior/deployment-evidence.json');
    expect(workflow).toContain('MIRAICHI_STAGING_BASELINE_SHA');
    expect(workflow).not.toMatch(/name:\s*(?:latest|miraichi-release-latest)/u);
  });
});
