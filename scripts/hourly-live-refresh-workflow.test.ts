import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { PostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';
import {
  runLocalEdgeSchedulerSmoke,
  verifyHourlyLiveRefreshWorkflow
} from './hourly-live-refresh-workflow.js';

const WORKFLOW_PATH = '.github/workflows/hourly-live-refresh.yml';

describe('hourly live refresh workflow', () => {
  it('is a manual rollback trigger using only the scoped service credential after staging cron proof', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    expect(verifyHourlyLiveRefreshWorkflow(workflow, { stagingCronProven: true })).toEqual([]);
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

  it('retains hourly fallback until staging cron proof, then requires manual-only rollback', () => {
    const workflow = readFileSync(WORKFLOW_PATH, 'utf8');
    expect(verifyHourlyLiveRefreshWorkflow(workflow, { stagingCronProven: false }))
      .toContain('missing_hourly_schedule');
    expect(verifyHourlyLiveRefreshWorkflow(workflow, { stagingCronProven: true })).toEqual([]);

    const scheduledFallback = workflow.replace(
      'on:\n  workflow_dispatch:',
      "on:\n  schedule:\n    - cron: '17 * * * *'\n  workflow_dispatch:"
    );
    expect(verifyHourlyLiveRefreshWorkflow(scheduledFallback, { stagingCronProven: true }))
      .toContain('hourly_fallback_must_be_removed');
  });

  it('proves missing-secret rejection, one request, idempotency, and cleanup without exposing values', async () => {
    let secretsCreated = false;
    let unscheduleCalls = 0;
    const calls: Array<{ text: string; values: readonly unknown[] }> = [];
    const client: PostgresQueryClient = {
      query: async <T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) => {
        calls.push({ text, values });
        if (text.includes('configure_edge_hourly_live_refresh') && !secretsCreated) {
          throw new Error('Required Edge scheduler Vault secret is missing or duplicated');
        }
        if (text.includes('vault.create_secret')) secretsCreated = true;
        if (text.includes('from cron.job')) {
          return { rows: [{ exact: true } as unknown as T], rowCount: 1 };
        }
        if (text.includes('from net.http_request_queue')) {
          return { rows: [{ exact: true } as unknown as T], rowCount: 1 };
        }
        if (text.includes('unschedule_edge_hourly_live_refresh')) {
          unscheduleCalls += 1;
          return { rows: [{ unscheduled: unscheduleCalls === 2 } as unknown as T], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      },
      transaction: async (operation) => operation(client)
    };

    await expect(runLocalEdgeSchedulerSmoke(client, () => 'generated-disposable-secret-value'))
      .resolves.toEqual({
        missingSecretRejected: true,
        oneJob: true,
        sanitizedRequest: true,
        idempotentUnschedule: true,
        disposableSecretsRemoved: true
      });
    expect(calls.filter((call) => call.text.includes('vault.create_secret'))).toHaveLength(3);
    expect(calls.some((call) => call.text.includes('generated-disposable-secret-value'))).toBe(false);
  });
});
