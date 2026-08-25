import { resolve } from 'node:path';
import { runApiFootballHydrationJob } from '../apps/worker/src/jobs/api-football-hydration-job.js';
import { API_FOOTBALL_COMPETITION_REGISTRY } from '../packages/config/src/index.js';

async function main(): Promise<void> {
  const dataRoot = resolve(process.cwd(), 'apps/api/data');
  console.log(`Starting API-Football multi-season historical hydration...`);
  console.log(`Configured competitions count: ${API_FOOTBALL_COMPETITION_REGISTRY.length}`);

  const result = await runApiFootballHydrationJob({
    dataRoot,
    registry: API_FOOTBALL_COMPETITION_REGISTRY
  });

  console.log(`\nHydration Run Completed!`);
  console.log(`- Status: ${result.status}`);
  console.log(`- Run ID: ${result.runId}`);
  console.log(`- Seasons Hydrated: ${result.seasonsHydrated}`);
  console.log(`- Matches Hydrated: ${result.matchesHydrated}`);
  console.log(`- Pending Seasons Remaining: ${result.pendingCount}`);
  console.log(`- Quota Used Today: ${result.quotaUsedToday}`);
}

main().catch((err) => {
  console.error('Hydration failed:', err);
  process.exit(1);
});
