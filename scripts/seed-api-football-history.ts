import { resolve } from 'node:path';
import { runApiFootballHydrationJob } from '../apps/worker/src/jobs/api-football-hydration-job.js';
import { API_FOOTBALL_COMPETITION_REGISTRY } from '../packages/config/src/index.js';
import { ApiFootballUsageLedger } from '../apps/worker/src/sources/api-football/api-football-usage-ledger.js';
import { ApiFootballClient } from '../apps/worker/src/sources/api-football/api-football-client.js';

// Auto-load .env if available
try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore if .env is missing
}

async function main(): Promise<void> {
  const apiKey = process.env.API_FOOTBALL_KEY?.trim();
  if (!apiKey) {
    console.error('Error: Missing API_FOOTBALL_KEY environment variable. Configure API_FOOTBALL_KEY in .env before running.');
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const limitArg = args.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const compArg = args.find((a) => a.startsWith('--competition='))?.split('=')[1];
  const catArg = args.find((a) => a.startsWith('--category='))?.split('=')[1];
  const dataRootArg = args.find((a) => a.startsWith('--data-root='))?.split('=')[1];

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
  const dataRoot = dataRootArg ? resolve(dataRootArg) : resolve(process.cwd(), 'apps/api/data');
  const ledger = new ApiFootballUsageLedger({ dataRoot });
  const client = new ApiFootballClient({ apiKey, ledger, dataRoot });

  const initialQuota = await ledger.getState();

  console.log(`=======================================================`);
  console.log(`⚽ API-FOOTBALL MULTI-SEASON HISTORICAL HYDRATION`);
  console.log(`=======================================================`);
  console.log(`- API Key: Configured`);
  console.log(`- Quota used today: ${initialQuota.dailyUsage.reserved}/${initialQuota.dailyUsage.limit}`);
  console.log(`- Total competitions registered: ${filteredRegistry.length}`);
  if (maxBatches) console.log(`- Max batches per run limit: ${maxBatches}`);
  console.log(`-------------------------------------------------------`);

  const result = await runApiFootballHydrationJob({
    dataRoot,
    registry: filteredRegistry,
    client,
    ...(maxBatches ? { maxBatchesPerRun: maxBatches } : {})
  });

  const finalQuota = await ledger.getState();

  console.log(`\n=======================================================`);
  console.log(`📊 HYDRATION PROGRESS REPORT:`);
  console.log(`=======================================================`);
  console.log(`- Status: ${result.status}`);
  console.log(`- Run ID: ${result.runId}`);
  console.log(`- Seasons hydrated this run: ${result.seasonsHydrated}`);
  console.log(`- Matches hydrated into Serving Store: ${result.matchesHydrated}`);
  console.log(`- Pending seasons remaining: ${result.pendingCount}`);
  console.log(`- Quota used today: ${finalQuota.dailyUsage.reserved}/${finalQuota.dailyUsage.limit}`);

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
