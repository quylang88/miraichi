import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('active owner-hosted deployment boundary', () => {
  it('exposes only local Cloudflare artifact preparation, never an active staging deploy', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const environmentTemplate = readFileSync('.env.example', 'utf8');
    const wrangler = readFileSync('apps/cloudflare-gateway/wrangler.jsonc', 'utf8');

    expect(packageJson.scripts['deploy:staging']).toBeUndefined();
    expect(packageJson.scripts['deploy:staging:local']).toBeUndefined();
    expect(packageJson.scripts['cloudflare:artifact:verify']).toBe(
      'tsx scripts/cloudflare-owner-hosting-verify.ts'
    );
    expect(wrangler).toContain('"directory": "../web/dist"');
    expect(wrangler).toContain('"run_worker_first": ["/api", "/api/*"]');
    expect(environmentTemplate).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(environmentTemplate).not.toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(environmentTemplate).not.toContain('CLOUDFLARE_PAGES_PROJECT');
  });
});
