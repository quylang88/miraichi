import { resolve } from 'node:path';
import { ApiFootballUsageLedger } from '../apps/worker/src/sources/api-football/api-football-usage-ledger.js';
import { API_FOOTBALL_QUOTA_CONFIG } from '../packages/config/src/index.js';

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
  const dataRootArg = args.find((a) => a.startsWith('--data-root='))?.split('=')[1];
  const dataRoot = dataRootArg ? resolve(dataRootArg) : resolve(process.cwd(), 'apps/api/data');

  const ledger = new ApiFootballUsageLedger({ dataRoot });
  const state = await ledger.getState();

  const normalCeiling = state.dailyUsage.limit;
  const totalLimit = API_FOOTBALL_QUOTA_CONFIG.dailyLimit;
  const remainingNormal = Math.max(0, normalCeiling - state.dailyUsage.reserved);
  const remainingTotal = Math.max(0, totalLimit - state.dailyUsage.reserved);

  console.log(`=======================================================`);
  console.log(`📊 API-FOOTBALL DURABLE QUOTA STATUS`);
  console.log(`=======================================================`);
  console.log(`- Ledger file: ${ledger.getStoragePath()}`);
  console.log(`- Schema version: ${state.schemaVersion}`);
  console.log(`- Provider day (UTC): ${state.dayKey}`);
  console.log(`-------------------------------------------------------`);
  console.log(`📈 DAILY USAGE COUNTERS:`);
  console.log(`- Reserved requests:  ${state.dailyUsage.reserved}`);
  console.log(`- Confirmed requests: ${state.dailyUsage.confirmed}`);
  console.log(`- Normal ceiling:     ${normalCeiling}`);
  console.log(`- Provider-plan limit: ${totalLimit}`);
  console.log(`- Remaining (Normal): ${remainingNormal}`);
  console.log(`- Remaining (Total):  ${remainingTotal}`);
  console.log(`-------------------------------------------------------`);
  console.log(`⏱️ ROLLING RATE LIMIT (60-second window):`);
  console.log(`- Active requests in window: ${state.rollingRequests.length}/10`);
  console.log(`-------------------------------------------------------`);
  console.log(`📡 LAST PROVIDER-REPORTED HEADERS:`);
  console.log(`- Provider limit:     ${state.lastReportedHeader.limit ?? 'None recorded'}`);
  console.log(`- Provider remaining: ${state.lastReportedHeader.remaining ?? 'None recorded'}`);
  console.log(`- Resets in (s):      ${state.lastReportedHeader.resetsInSeconds ?? 'N/A'}`);
  console.log(`- Observed at:        ${state.lastReportedHeader.observedAt ?? 'Never'}`);
  console.log(`- Ledger updated at:  ${state.updatedAt}`);
  console.log(`=======================================================`);
}

main().catch((err) => {
  console.error('Failed to read quota status:', err);
  process.exit(1);
});
