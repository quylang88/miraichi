import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const RUNBOOK = 'docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md';
const DOCS_INDEX = 'docs/README.md';

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
      'supabase secrets set --env-file .secrets/edge.staging.env',
      'pnpm run build:web-static',
      'pnpm run cloudflare:artifact:verify',
      'pnpm run edge:function:build',
      'pnpm run edge:runtime:smoke -- --scope all',
      '/api/v1/health',
      'MIRAICHI_EDGE_FUNCTION_URL',
      'MIRAICHI_PUBLIC_ORIGIN',
      'MIRAICHI_GATEWAY_TOKEN',
      'MIRAICHI_REFRESH_TOKEN',
      'SUPABASE_DB_URL',
      'eu-central-1',
      'wrangler deploy --env staging --dry-run',
      'wrangler versions deploy'
    ]) expect(runbook).toContain(marker);
    expect(runbook).toContain('Do not run `supabase db reset --linked`');
    expect(runbook).not.toContain('SPORTSCORE_API_KEY');
    expect(runbook).not.toContain('SPORTSCORE_BASE_URL');
    expect(runbook).not.toContain('CLOUD_PERSISTENCE_MODE=supabase');
  });

  it('indexes the active Edge hosting decision, design, plan, and runbook', () => {
    const index = readFileSync(DOCS_INDEX, 'utf8');
    for (const currentDocument of [
      'docs/decisions/ADR-0052-supabase-edge-cloudflare-owner-hosting.md',
      'docs/superpowers/specs/2026-09-03-supabase-edge-cloudflare-owner-hosting-design.md',
      'docs/superpowers/plans/2026-09-03-supabase-edge-cloudflare-owner-hosting.md',
      'docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md'
    ]) expect(index).toContain(currentDocument);
  });
});
