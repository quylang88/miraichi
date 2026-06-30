import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const WORKFLOW_PATH = path.resolve('.github/workflows/ci.yml');

function readWorkflow() {
  return fs.readFileSync(WORKFLOW_PATH, 'utf8');
}

describe('GitHub Actions CI workflow', () => {
  it('exists and runs the required non-deploy verification commands', () => {
    const workflow = readWorkflow();

    expect(workflow).toContain('name: CI');
    expect(workflow).toContain('pnpm/action-setup@v4');
    expect(workflow).toContain('actions/setup-node@v4');
    expect(workflow).toContain('pnpm install --frozen-lockfile');
    expect(workflow).toContain('pnpm run verify:lifecycle');
    expect(workflow).toContain('pnpm run test:unit');
    expect(workflow).toContain('pnpm run lint');
    expect(workflow).toContain('pnpm run typecheck');
    expect(workflow).toContain('pnpm run audit');
    expect(workflow).toContain('pnpm run audit:type-safety');
    expect(workflow).toContain('pnpm run build');
  });

  it('does not deploy or reference Cloudflare secrets', () => {
    const workflow = readWorkflow();
    const forbiddenMarkers = [
      'wrangler',
      'pages deploy',
      'deploy:staging',
      'deploy:staging:local',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'secrets.',
      'production'
    ];

    for (const marker of forbiddenMarkers) {
      expect(workflow).not.toContain(marker);
    }
  });

  it('keeps integration and staging checks out of the default PR workflow', () => {
    const workflow = readWorkflow();

    expect(workflow).not.toContain('pnpm run test:integration');
    expect(workflow).not.toContain('pnpm run verify:staging');
    expect(workflow).not.toContain('pnpm run smoke:staging');
  });
});
