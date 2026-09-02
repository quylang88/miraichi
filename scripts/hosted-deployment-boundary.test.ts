import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('active owner-hosted deployment boundary', () => {
  it('does not expose the superseded Cloudflare static deploy as the active staging command', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      scripts: Record<string, string>;
    };
    const environmentTemplate = readFileSync('.env.example', 'utf8');

    expect(packageJson.scripts['deploy:staging']).toBeUndefined();
    expect(packageJson.scripts['deploy:staging:local']).toBeUndefined();
    expect(environmentTemplate).not.toContain('CLOUDFLARE_API_TOKEN');
    expect(environmentTemplate).not.toContain('CLOUDFLARE_ACCOUNT_ID');
    expect(environmentTemplate).not.toContain('CLOUDFLARE_PAGES_PROJECT');
  });
});
