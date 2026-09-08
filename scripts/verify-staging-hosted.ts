import { runStagingOwnerFlow } from '../tests/e2e/staging-owner-flow.js';
import { localStagingEnvironment, requireStagingConfig } from './staging-hosted-config.js';
import { runStagingSchedulerSmoke } from './staging-scheduler-smoke.js';

async function main() {
  requireStagingConfig(localStagingEnvironment());
  await runStagingOwnerFlow();
  await runStagingSchedulerSmoke();
  console.log(JSON.stringify({ gate: 'verify:staging:hosted', status: 'passed', completedAt: new Date().toISOString() }));
}
void main().catch((error) => { console.error(error instanceof Error ? error.message : 'Hosted staging verification failed'); process.exitCode = 1; });
