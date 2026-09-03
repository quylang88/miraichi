import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const RUNBOOK = 'docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md';

describe('owner-hosted Edge and Cloudflare deployment readiness', () => {
  it('pins the local Wrangler artifact runtime', () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8')) as { packageManager?: string };
    const gateway = JSON.parse(readFileSync('apps/cloudflare-gateway/package.json', 'utf8')) as { devDependencies?: Record<string, string> };
    expect(root.packageManager).toBe('pnpm@10.18.3');
    expect(gateway.devDependencies?.wrangler).toBe('4.128.0');
  });

  it('documents the exact one-origin handoff without committing or printing secrets', () => {
    const runbook = readFileSync(RUNBOOK, 'utf8');
    for (const marker of [
      'supabase link --project-ref',
      'supabase db push --dry-run',
      'supabase db push',
      'pnpm run build:web-static',
      'pnpm run cloudflare:artifact:verify',
      'pnpm run edge:function:build',
      'pnpm run edge:runtime:smoke -- --scope auth',
      '/api/v1/health',
      'MIRAICHI_EDGE_FUNCTION_URL',
      'MIRAICHI_GATEWAY_TOKEN',
      'MIRAICHI_REFRESH_TOKEN',
      'SUPABASE_DB_URL',
      'eu-central-1',
      'wrangler deploy --env staging --dry-run'
    ]) expect(runbook).toContain(marker);
    expect(runbook).toContain('Do not run `supabase db reset --linked`');
    expect(runbook).not.toContain('SPORTSCORE_API_KEY');
    expect(runbook).not.toContain('SPORTSCORE_BASE_URL');
    expect(runbook).not.toContain('CLOUD_PERSISTENCE_MODE=supabase');
  });
});
