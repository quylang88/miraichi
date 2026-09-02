import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { verifyHourlyLiveRefreshWorkflow } from './hourly-live-refresh-workflow.js';

const WORKFLOW_PATH = '.github/workflows/hourly-live-refresh.yml';

describe('hourly live refresh workflow', () => {
  it('is an hourly best-effort wake-up using only the scoped service credential', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    expect(verifyHourlyLiveRefreshWorkflow(workflow)).toEqual([]);
  });

  it('rejects unsafe endpoints, deploy behavior, local mutation, and unbounded requests', () => {
    const unsafe = `
on:\n  schedule:\n    - cron: '0 * * * *'
jobs:\n  refresh:\n    steps:\n      - run: pnpm run deploy:staging && curl https://sportscore.com/api/v1/matches
`;
    const findings = verifyHourlyLiveRefreshWorkflow(unsafe);
    expect(findings).toEqual(expect.arrayContaining([
      'missing_scoped_refresh_url',
      'missing_bounded_curl',
      'forbidden_deploy_command',
      'forbidden_sportscore_access'
    ]));
  });
});
