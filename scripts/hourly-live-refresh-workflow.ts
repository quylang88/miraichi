import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import type { PostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';
import { createPostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';

const LOCAL_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:15422/postgres';
const VAULT_NAMES = [
  'miraichi_edge_function_url',
  'miraichi_edge_gateway_token',
  'miraichi_live_refresh_token'
] as const;

export interface LocalEdgeSchedulerSmokeResult {
  readonly missingSecretRejected: true;
  readonly oneJob: true;
  readonly sanitizedRequest: true;
  readonly idempotentUnschedule: true;
  readonly disposableSecretsRemoved: true;
}

class ExpectedQueueRollback extends Error {}

export async function runLocalEdgeSchedulerSmoke(
  client: PostgresQueryClient,
  createSecret: () => string = () => randomBytes(32).toString('base64url')
): Promise<LocalEdgeSchedulerSmokeResult> {
  const deleteSecrets = () => client.query(
    'delete from vault.secrets where name = any($1::text[])',
    [VAULT_NAMES]
  );
  await client.query('select miraichi_app.unschedule_edge_hourly_live_refresh()');
  await deleteSecrets();

  let missingSecretRejected = false;
  try {
    await client.query('select miraichi_app.configure_edge_hourly_live_refresh()');
  } catch (error) {
    missingSecretRejected = error instanceof Error && error.message.includes('missing or duplicated');
  }
  if (!missingSecretRejected) throw new Error('Missing Vault secret rejection was not proved');

  const functionUrl = 'https://localruntime.supabase.co/functions/v1/miraichi-api';
  try {
    await client.query('select vault.create_secret($1, $2, $3)', [
      functionUrl, VAULT_NAMES[0], 'Miraichi local Edge scheduler smoke URL'
    ]);
    await client.query('select vault.create_secret($1, $2, $3)', [
      createSecret(), VAULT_NAMES[1], 'Miraichi local Edge scheduler smoke gateway token'
    ]);
    await client.query('select vault.create_secret($1, $2, $3)', [
      createSecret(), VAULT_NAMES[2], 'Miraichi local Edge scheduler smoke refresh token'
    ]);

    await client.query('select miraichi_app.configure_edge_hourly_live_refresh()');
    await client.query('select miraichi_app.configure_edge_hourly_live_refresh()');
    const job = await client.query<{ exact: boolean }>(`
      select count(*) = 1
        and bool_and(schedule = '17 * * * *')
        and bool_and(command = 'select miraichi_app.invoke_edge_hourly_live_refresh();') as exact
      from cron.job
      where jobname = 'miraichi-edge-hourly-live-refresh'
    `);
    const oneJob = job.rows[0]?.exact === true;

    let sanitizedRequest = false;
    try {
      await client.transaction(async (transaction) => {
        await transaction.query('select miraichi_app.invoke_edge_hourly_live_refresh()');
        const request = await transaction.query<{ exact: boolean }>(`
          select count(*) = 1
            and bool_and(method = 'POST')
            and bool_and(url = $1)
            and bool_and(headers ? 'x-miraichi-gateway-token')
            and bool_and(headers ? 'Authorization')
            and bool_and(headers ->> 'x-region' = 'eu-central-1')
            and bool_and(octet_length(headers ->> 'x-miraichi-gateway-token') >= 32)
            and bool_and(left(headers ->> 'Authorization', 7) = 'Bearer ')
            and bool_and(timeout_milliseconds = 90000) as exact
          from net.http_request_queue
          where url = $1
        `, [`${functionUrl}/api/v1/live/refresh?reason=hourly`]);
        sanitizedRequest = request.rows[0]?.exact === true;
        throw new ExpectedQueueRollback('Rollback disposable pg_net request');
      });
    } catch (error) {
      if (!(error instanceof ExpectedQueueRollback)) throw error;
    }

    const first = await client.query<{ unscheduled: boolean }>(
      'select miraichi_app.unschedule_edge_hourly_live_refresh() as unscheduled'
    );
    const second = await client.query<{ unscheduled: boolean }>(
      'select miraichi_app.unschedule_edge_hourly_live_refresh() as unscheduled'
    );
    const idempotentUnschedule = first.rows[0]?.unscheduled === true
      && second.rows[0]?.unscheduled === false;
    if (!oneJob || !sanitizedRequest || !idempotentUnschedule) {
      throw new Error('Local Edge scheduler smoke did not prove all gates');
    }
  } finally {
    await client.query('select miraichi_app.unschedule_edge_hourly_live_refresh()');
    await deleteSecrets();
  }
  return {
    missingSecretRejected: true,
    oneJob: true,
    sanitizedRequest: true,
    idempotentUnschedule: true,
    disposableSecretsRemoved: true
  };
}

export function verifyHourlyLiveRefreshWorkflow(
  workflow: string,
  options: { readonly stagingCronProven?: boolean } = {}
): string[] {
  const findings: string[] = [];
  const hasHourlySchedule = /cron:\s*['"]17 \* \* \* \*['"]/u.test(workflow);
  if (options.stagingCronProven) {
    if (hasHourlySchedule) findings.push('hourly_fallback_must_be_removed');
    if (!workflow.includes('workflow_dispatch:')) findings.push('missing_manual_rollback');
  } else if (!hasHourlySchedule) {
    findings.push('missing_hourly_schedule');
  }
  if (!workflow.includes('permissions: {}')) findings.push('missing_zero_permissions');
  if (!workflow.includes('secrets.MIRAICHI_API_URL') || !workflow.includes('secrets.MIRAICHI_REFRESH_TOKEN')) {
    findings.push('missing_repository_secrets');
  }
  if (!workflow.includes('/api/v1/live/refresh?reason=hourly')) findings.push('missing_scoped_refresh_url');
  if (!workflow.includes('Authorization: Bearer ${MIRAICHI_REFRESH_TOKEN}')) findings.push('missing_bearer_auth');
  const boundedMarkers = ['--connect-timeout 15', '--max-time 90', '--retry 2', '--retry-all-errors'];
  if (boundedMarkers.some((marker) => !workflow.includes(marker))) findings.push('missing_bounded_curl');
  if (/\b(?:deploy|wrangler|koyeb)\b/iu.test(workflow)) findings.push('forbidden_deploy_command');
  if (/sportscore\.com|SPORTSCORE_|\/api\/v1\/(?:matches|match|fixtures)/iu.test(workflow)) {
    findings.push('forbidden_sportscore_access');
  }
  if (/pnpm\s+run\s+(?:data:|sportscore:|supabase:)|LOCAL_MATCH_SERVING_ROOT/iu.test(workflow)) {
    findings.push('forbidden_local_data_mutation');
  }
  return findings;
}

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replace(/\\/gu, '/')}`).href) {
  const main = async () => {
    if (process.argv.includes('--local-sql-smoke')) {
      const result = await runLocalEdgeSchedulerSmoke(createPostgresQueryClient(LOCAL_DATABASE_URL));
      console.log(JSON.stringify({ status: 'passed', ...result }));
      return;
    }
    const workflow = readFileSync('.github/workflows/hourly-live-refresh.yml', 'utf8');
    const findings = verifyHourlyLiveRefreshWorkflow(workflow);
    if (findings.length > 0) throw new Error(JSON.stringify({ status: 'failed', findings }));
    console.log(JSON.stringify({ status: 'passed', workflow: 'hourly-live-refresh-fallback-retained' }));
  };
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
