import { resolve } from 'node:path';
import { runApiFootballHydrationJob } from '../apps/worker/src/jobs/api-football-hydration-job.js';
import { API_FOOTBALL_COMPETITION_REGISTRY } from '../packages/config/src/index.js';

// Auto-load .env if available
try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore if .env is missing
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const compArg = args.find((a) => a.startsWith('--competition='))?.split('=')[1];
  const catArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];

  let filteredRegistry = API_FOOTBALL_COMPETITION_REGISTRY;
  if (compArg) {
    filteredRegistry = filteredRegistry.filter((c) => c.competitionId === compArg || String(c.providerLeagueId) === compArg);
    if (filteredRegistry.length === 0) {
      console.error(`No registered competition matches: --competition=${compArg}`);
      process.exit(1);
    }
  } else if (catArg) {
    filteredRegistry = filteredRegistry.filter((c) => c.category === catArg);
    if (filteredRegistry.length === 0) {
      console.error(`No registered competition matches: --category=${catArg}`);
      process.exit(1);
    }
  }

  const maxBatches = limitArg ? parseInt(limitArg, 10) : undefined;
  const dataRoot = resolve(process.cwd(), 'apps/api/data');

  console.log(`=======================================================`);
  console.log(`⚽ API-FOOTBALL MULTI-SEASON HISTORICAL HYDRATION`);
  console.log(`=======================================================`);
  console.log(`- API Key: ${process.env.API_FOOTBALL_KEY ? 'Configured (.env)' : '⚠️ Not configured (Using mock mode)'}`);
  console.log(`- Total competitions registered: ${filteredRegistry.length}`);
  if (maxBatches) console.log(`- Max batches per run limit: ${maxBatches}`);
  console.log(`-------------------------------------------------------`);

  const result = await runApiFootballHydrationJob({
    dataRoot,
    registry: filteredRegistry,
    ...(maxBatches ? { maxBatchesPerRun: maxBatches } : {})
  });

  console.log(`\n=======================================================`);
  console.log(`📊 HYDRATION PROGRESS REPORT:`);
  console.log(`=======================================================`);
  console.log(`- Status: ${result.status}`);
  console.log(`- Run ID: ${result.runId}`);
  console.log(`- Seasons hydrated this run: ${result.seasonsHydrated}`);
  console.log(`- Matches hydrated into Serving Store: ${result.matchesHydrated}`);
  console.log(`- Pending seasons remaining: ${result.pendingCount}`);
  console.log(`- Quota used today: ${result.quotaUsedToday}/85`);

  if (result.pendingCount > 0 && result.status === 'partial') {
    console.log(`\n💡 NOTE: Progress saved to checkpoint (hydration-checkpoints.json).`);
    console.log(`👉 Re-run this command tomorrow when quota resets to continue hydrating remaining seasons.`);
  } else if (result.status === 'completed') {
    console.log(`\n🎉 ALL CONFIGURED SEASONS ARE FULLY HYDRATED!`);
  }
}

main().catch((err) => {
  console.error('\nHydration failed with error:', err);
  process.exit(1);
});
