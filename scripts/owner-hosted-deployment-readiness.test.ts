import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const RUNBOOK = 'docs/operations/KOYEB-SUPABASE-OWNER-HOSTING.md';

describe('owner-hosted Koyeb deployment readiness', () => {
  it('keeps the pnpm and TypeScript runtime available after production dependency pruning', () => {
    const root = JSON.parse(readFileSync('package.json', 'utf8')) as { packageManager?: string };
    const api = JSON.parse(readFileSync('apps/api/package.json', 'utf8')) as { dependencies?: Record<string, string> };
    expect(root.packageManager).toBe('pnpm@10.18.3');
    expect(api.dependencies?.tsx).toBe('^4.22.4');
  });

  it('documents an exact one-origin free-tier setup without committing or printing secrets', () => {
    const runbook = readFileSync(RUNBOOK, 'utf8');
    for (const marker of [
      'supabase link --project-ref',
      'supabase db push --dry-run',
      'supabase db push',
      'Session pooler',
      'pnpm run build:web-static',
      'pnpm run start:hosted',
      '/api/v1/health',
      'MIRAICHI_API_URL',
      'MIRAICHI_REFRESH_TOKEN',
      'CLOUD_PERSISTENCE_MODE=supabase',
      'SPORTSCORE_LIVE_MODE=widget',
      'HOSTED_WEB_MODE=required',
      'Cloudflare không bắt buộc'
    ]) expect(runbook).toContain(marker);
    expect(runbook).not.toContain('supabase db reset --linked');
    expect(runbook).not.toContain('SPORTSCORE_API_KEY');
    expect(runbook).not.toContain('SPORTSCORE_BASE_URL');
  });
});
