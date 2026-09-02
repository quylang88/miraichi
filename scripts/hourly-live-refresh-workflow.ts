import { readFileSync } from 'node:fs';

export function verifyHourlyLiveRefreshWorkflow(workflow: string): string[] {
  const findings: string[] = [];
  if (!/cron:\s*['"]17 \* \* \* \*['"]/u.test(workflow)) findings.push('missing_hourly_schedule');
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
  const workflow = readFileSync('.github/workflows/hourly-live-refresh.yml', 'utf8');
  const findings = verifyHourlyLiveRefreshWorkflow(workflow);
  if (findings.length > 0) {
    console.error(JSON.stringify({ status: 'failed', findings }, null, 2));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ status: 'passed', workflow: 'hourly-live-refresh' }, null, 2));
  }
}
