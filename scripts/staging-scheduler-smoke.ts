import { spawnSync } from 'node:child_process';
import { gate } from './staging-hosted-config.js';

export function linkedStagingQuery(sql: string): Record<string, unknown>[] {
  const result = spawnSync(process.execPath, ['node_modules/supabase/dist/supabase.js', 'db', 'query', '--linked', '--output-format', 'json'], {
    input: sql, encoding: 'utf8', windowsHide: true, timeout: 45_000
  });
  gate(result.status === 0, 'linked Frankfurt query');
  const offset = result.stdout.indexOf('{');
  gate(offset >= 0, 'linked query response');
  const parsed = JSON.parse(result.stdout.slice(offset)) as { rows?: Record<string, unknown>[] };
  gate(Array.isArray(parsed.rows), 'linked query rows');
  return parsed.rows;
}

export async function runStagingSchedulerSmoke(): Promise<void> {
  const vault = linkedStagingQuery("select name from vault.secrets where name like 'miraichi_%' order by name").map((row) => row.name);
  const expectedVault = ['miraichi_edge_function_url','miraichi_edge_gateway_token','miraichi_live_refresh_token','miraichi_provider_refresh_token'];
  gate(JSON.stringify(vault) === JSON.stringify(expectedVault), 'exact four Vault names');
  const jobs = linkedStagingQuery("select jobname,schedule,command,active from cron.job where jobname like 'miraichi-%' order by jobname");
  gate(jobs.length === 3, 'exact three cron jobs');
  for (const kind of ['current','live','terminal']) {
    const job = jobs.find((row) => row.jobname === `miraichi-${kind}-refresh`);
    gate(job?.active === true && job.schedule === (kind === 'terminal' ? '* * * * *' : '*/5 * * * *')
      && job.command === `select miraichi_app.invoke_hosted_refresh('${kind}');`, 'exact active scheduler contract');
  }
  const outcomes: Record<string, string> = {};
  for (const kind of ['current','terminal','live']) {
    const before = linkedStagingQuery(`select (select revision from miraichi_app.provider_refresh_control where owner_profile_id='owner-primary') as revision,
      (select count(*)::int from miraichi_app.match_record) as matches,
      (select generated_at from miraichi_app.live_match_snapshot where owner_profile_id='owner-primary') as live_at`)[0];
    const invoked = linkedStagingQuery(`select miraichi_app.invoke_hosted_refresh('${kind}') as request_id`)[0];
    const id = Number(invoked.request_id);
    gate(Number.isSafeInteger(id) && id > 0, 'controlled scheduler request ID');
    let delivery: Record<string, unknown> | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      delivery = linkedStagingQuery(`select status_code,content,timed_out from net._http_response where id=${id}`)[0];
      if (delivery) break;
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    gate(delivery && Number(delivery.status_code) >= 200 && Number(delivery.status_code) < 300 && !delivery.timed_out, `scheduler ${kind} delivered 2xx`);
    const content = JSON.parse(String(delivery.content)) as { outcome?: string; requests?: number; publications?: number; refresh?: { outcome?: string }; snapshot?: { generatedAt?: string } };
    const outcome = kind === 'live' ? content.refresh?.outcome : content.outcome;
    gate(['fresh','refreshed'].includes(outcome ?? ''), `scheduler ${kind} completed or fresh (lease contention requires rerun)`);
    const after = linkedStagingQuery(`select (select revision from miraichi_app.provider_refresh_control where owner_profile_id='owner-primary') as revision,
      (select count(*)::int from miraichi_app.match_record) as matches,
      (select generated_at from miraichi_app.live_match_snapshot where owner_profile_id='owner-primary') as live_at`)[0];
    gate(Number(after.matches) >= Number(before.matches), 'last-good matches preserved');
    if (kind === 'live') gate(Boolean(after.live_at)
      && Date.now() - Date.parse(String(after.live_at)) < 10 * 60_000
      && (!before.live_at || Date.parse(String(after.live_at)) >= Date.parse(String(before.live_at))), 'live last-good freshness');
    else {
      gate(Number(after.revision) >= Number(before.revision ?? 0), 'durable checkpoint revision');
      gate(Number.isInteger(content.requests) && content.requests! <= (kind === 'current' ? 9 : 2), 'request cap');
      if (outcome === 'refreshed') gate(Number(after.revision) > Number(before.revision ?? 0), 'completed checkpoint progress');
    }
    outcomes[kind] = outcome!;
  }
  console.log(JSON.stringify({ gate: 'hosted-scheduler', status: 'passed', vaultNames: 4, jobs: 3, outcomes }));
}
