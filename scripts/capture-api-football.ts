import { resolve } from 'node:path';
import { runApiFootballIngestionJob } from '../apps/worker/src/jobs/api-football-ingestion-job.js';
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
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] as 'daily_sync' | 'window_poll' | 'auto' | undefined;
  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];

  const dataRoot = resolve(process.cwd(), 'apps/api/data');
  console.log(`=======================================================`);
  console.log(`⚽ API-FOOTBALL INGESTION (${modeArg || 'auto'})`);
  console.log(`=======================================================`);
  console.log(`- API Key: ${process.env.API_FOOTBALL_KEY ? 'Configured' : '⚠️ Not configured (Using mock)'}`);
  if (dateArg) console.log(`- Target date: ${dateArg}`);
  console.log(`-------------------------------------------------------`);

  const result = await runApiFootballIngestionJob({
    dataRoot,
    mode: modeArg || 'auto',
    ...(dateArg ? { date: dateArg } : {}),
    registry: API_FOOTBALL_COMPETITION_REGISTRY
  });

  console.log(`\n=======================================================`);
  console.log(`📊 INGESTION RESULT:`);
  console.log(`=======================================================`);
  console.log(`- Status: ${result.status}`);
  console.log(`- Mode: ${result.mode}`);
  console.log(`- Run ID: ${result.runId}`);
  console.log(`- Matches processed: ${result.matchesProcessed}`);
  console.log(`- Matches completed (FT): ${result.matchesCompleted}`);
  console.log(`- Quota used today: ${result.quotaUsedToday}/85`);

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
