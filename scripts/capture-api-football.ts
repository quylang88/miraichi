import { resolve } from 'node:path';
import { runApiFootballIngestionJob } from '../apps/worker/src/jobs/api-football-ingestion-job.js';
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
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] as 'daily_sync' | 'window_poll' | 'auto' | undefined;
  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];
  const dataRootArg = args.find((a) => a.startsWith('--data-root='))?.split('=')[1];

  const dataRoot = dataRootArg ? resolve(dataRootArg) : resolve(process.cwd(), 'apps/api/data');
  const ledger = new ApiFootballUsageLedger({ dataRoot });
  const client = new ApiFootballClient({ apiKey, ledger, dataRoot });

  const initialQuota = await ledger.getState();

  console.log(`=======================================================`);
  console.log(`⚽ API-FOOTBALL INGESTION (${modeArg || 'auto'})`);
  console.log(`=======================================================`);
  console.log(`- API Key: Configured`);
  console.log(`- Quota used today: ${initialQuota.dailyUsage.reserved}/${initialQuota.dailyUsage.limit}`);
  if (dateArg) console.log(`- Target date: ${dateArg}`);
  console.log(`-------------------------------------------------------`);

  const result = await runApiFootballIngestionJob({
    dataRoot,
    mode: modeArg || 'auto',
    ...(dateArg ? { date: dateArg } : {}),
    registry: API_FOOTBALL_COMPETITION_REGISTRY,
    client
  });

  const finalQuota = await ledger.getState();

  console.log(`\n=======================================================`);
  console.log(`📊 INGESTION RESULT:`);
  console.log(`=======================================================`);
  console.log(`- Status: ${result.status}`);
  console.log(`- Mode: ${result.mode}`);
  console.log(`- Run ID: ${result.runId}`);
  console.log(`- Matches processed: ${result.matchesProcessed}`);
  console.log(`- Matches completed (FT): ${result.matchesCompleted}`);
  console.log(`- Quota used today: ${finalQuota.dailyUsage.reserved}/${finalQuota.dailyUsage.limit}`);

  if (result.concludingWindows && result.concludingWindows.length > 0) {
    console.log(`- Active concluding windows: ${result.concludingWindows.length} matches`);
  }

  if (result.error) {
    console.error(`- Error: ${result.error}`);
  }
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
