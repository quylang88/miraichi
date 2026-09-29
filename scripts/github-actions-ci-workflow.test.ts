import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync('.github/workflows/ci.yml', 'utf8');

const requiredJobs = [
  'boundaries',
  'unit-tests',
  'static-analysis',
  'audits',
  'integration',
  'web-build',
  'migrations',
  'edge-runtime',
  'cloudflare-artifact'
] as const;

describe('GitHub Actions pull-request quality gate', () => {
  it('runs only for pull requests targeting staging or main with read-only permissions', () => {
    expect(workflow).toContain('name: CI');
    expect(workflow).toMatch(/on:\s*\n\s*pull_request:\s*\n\s*branches:\s*\n\s*- staging\s*\n\s*- main/u);
    expect(workflow).not.toMatch(/^\s*push:/mu);
    expect(workflow).not.toContain('pull_request_target');
    expect(workflow).toMatch(/permissions:\s*\n\s*contents: read/u);
    expect(workflow).not.toMatch(/^\s+(?:actions|contents|deployments|id-token|packages|pull-requests): write$/mu);
  });

  it('keeps every required gate independently visible and aggregates all of them', () => {
    for (const job of requiredJobs) {
      expect(workflow).toMatch(new RegExp(`^  ${job}:`, 'mu'));
    }
    expect(workflow).toMatch(/^  quality-gate:/mu);
    expect(workflow).toContain('name: quality-gate');
    expect(workflow).toContain('if: ${{ always() }}');
    expect(workflow).toContain(`needs: [${requiredJobs.join(', ')}]`);
    expect(workflow).toContain('toJSON(needs)');
    expect(workflow).toContain("result !== 'success'");
  });

  it('covers the complete release gate instead of a check-only subset', () => {
    for (const command of [
      'pnpm run verify:product-boundary',
      'pnpm run verify:lifecycle',
      'pnpm run test:unit',
      'pnpm run lint',
      'pnpm run typecheck',
      'pnpm run audit',
      'pnpm run audit:type-safety',
      'pnpm run test:integration',
      'pnpm run build:web-static',
      'pnpm run verify:migrations',
      'pnpm run edge:function:build',
      'pnpm run edge:function:graph:verify',
      'pnpm run edge:runtime:smoke -- --scope all',
      'pnpm run cloudflare:artifact:verify'
    ]) expect(workflow).toContain(command);
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm exec playwright install --with-deps chromium webkit');
  });

  it('preserves dollar signs in the generated scrypt password hash for the Edge env parser', () => {
    expect(workflow).toContain(`printf "MIRAICHI_OWNER_PASSWORD_HASH='%s'\\n" "$owner_hash"`);
    expect(workflow).not.toContain(`printf 'MIRAICHI_OWNER_PASSWORD_HASH=%s\\n' "$owner_hash"`);
  });

  it('cannot reach deployment environments, deployment credentials, or mutation commands', () => {
    expect(workflow).not.toMatch(/^    environment:/mu);
    for (const forbidden of [
      'secrets.',
      'pull_request_target',
      'supabase link',
      'supabase db push',
      'supabase functions deploy',
      'wrangler versions deploy',
      'release:deploy',
      'deploy:staging',
      'deploy:production'
    ]) expect(workflow).not.toContain(forbidden);
  });
});
