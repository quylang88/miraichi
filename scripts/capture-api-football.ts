import { resolve } from 'node:path';
import { runApiFootballIngestionJob } from '../apps/worker/src/jobs/api-football-ingestion-job.js';
import { API_FOOTBALL_COMPETITION_REGISTRY } from '../packages/config/src/index.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const modeArg = args.find((a) => a.startsWith('--mode='))?.split('=')[1] as 'daily_sync' | 'window_poll' | 'auto' | undefined;
  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1];

  const dataRoot = resolve(process.cwd(), 'apps/api/data');
  console.log(`Starting API-Football Ingestion (${modeArg || 'auto'})...`);

  const result = await runApiFootballIngestionJob({
    dataRoot,
    mode: modeArg || 'auto',
    ...(dateArg ? { date: dateArg } : {}),
    registry: API_FOOTBALL_COMPETITION_REGISTRY
  });

  console.log(`\nAPI-Football Ingestion Result:`);
  console.log(`- Status: ${result.status}`);
  console.log(`- Mode: ${result.mode}`);
  console.log(`- Run ID: ${result.runId}`);
  console.log(`- Matches Processed: ${result.matchesProcessed}`);
  console.log(`- Matches Completed: ${result.matchesCompleted}`);
  console.log(`- Quota Used Today: ${result.quotaUsedToday}`);

  if (result.error) {
    console.error(`- Error: ${result.error}`);
  }
}

main().catch((err) => {
  console.error('Ingestion failed:', err);
  process.exit(1);
});
