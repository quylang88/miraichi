import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/release-candidate.yml', 'utf8');

describe('GitHub Actions release-candidate gate', () => {
  it('is a uniquely named, main-only pull-request check with minimum read permissions', () => {
    expect(workflow).toContain('name: Release Candidate');
    expect(workflow).toMatch(/pull_request:\s*\n\s*branches:\s*\n\s*- main/u);
    expect(workflow).not.toMatch(/^\s*push:/mu);
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).toMatch(/permissions:\s*\n\s*actions: read\s*\n\s*contents: read\s*\n\s*deployments: read/u);
    expect(workflow).not.toMatch(/^\s+(?:actions|contents|deployments|id-token|packages|pull-requests): write$/mu);
    expect(workflow).toMatch(/^  release-candidate:/mu);
    expect(workflow).toContain('name: release-candidate');
  });

  it('resolves exact-SHA staging deployment and artifact evidence before verification', () => {
    expect(workflow).toContain("github.event.pull_request.head.ref == 'staging'");
    expect(workflow).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(workflow).toContain('fetch-depth: 0');
    expect(workflow).toContain('miraichi-release-${headSha}');
    expect(workflow).toContain('github.rest.repos.listDeployments');
    expect(workflow).toContain('github.rest.repos.listDeploymentStatuses');
    expect(workflow).toContain('github.rest.actions.listArtifactsForRepo');
    expect(workflow).toContain('actions/download-artifact@v8');
    expect(workflow).toContain('digest-mismatch: error');
    expect(workflow).toContain('run-id: ${{ steps.evidence.outputs.run-id }}');
    expect(workflow).toContain('pnpm run verify:release-candidate');
  });

  it('has no deployment environment, secret, or mutation capability', () => {
    expect(workflow).not.toMatch(/^    environment:/mu);
    for (const forbidden of [
      'secrets.',
      'supabase link',
      'supabase db push',
      'supabase functions deploy',
      'wrangler deploy',
      'release:deploy'
    ]) expect(workflow).not.toContain(forbidden);
  });
});
