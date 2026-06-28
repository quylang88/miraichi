import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMockIngestionJob } from '../apps/worker/src/jobs/mock-ingestion-job.js';
import { memoryIngestionRepository } from '../apps/worker/src/repositories/memory-ingestion-repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function verifyPhase3() {
  console.log('[Phase 3 Verify] Starting Phase 3 Ingestion verification tests...');

  const filesToCheck = [
    'packages/shared/src/contracts/normalized-match-contract.ts',
    'packages/shared/src/contracts/normalized-market-contract.ts',
    'packages/shared/src/contracts/ingestion-run-contract.ts',
    'apps/worker/src/fixtures/provider-mock-alpha-fixtures.json',
    'apps/worker/src/fixtures/provider-mock-alpha-markets.json',
    'apps/worker/src/validators/ingestion-validator.ts',
    'apps/worker/src/adapters/mock-provider-adapter.ts',
    'apps/worker/src/repositories/memory-ingestion-repository.ts',
    'apps/worker/src/jobs/mock-ingestion-job.ts',
    'apps/api/src/routes/ingestion-status.mock.ts'
  ];

  // 1. Verify files exist
  for (const file of filesToCheck) {
    const filePath = path.join(__dirname, '..', file);
    try {
      await fs.access(filePath);
      console.log(`  ✅ Exists: ${file}`);
    } catch {
      console.error(`  ❌ Missing: ${file}`);
      process.exit(1);
    }
  }

  // 2. Audit files for forbidden keywords (real tournaments, DB clients, ORMs, secrets)
  const forbiddenKeywords = ['prisma', 'mongoose', 'sequelize', 'drizzle', 'postgresql', 'mysql', 'api_key', 'api-key', 'secret_key', 'world cup', 'fifa', 'premier league'];
  const srcDirs = ['apps/worker/src', 'packages/shared/src/contracts'];

  for (const dir of srcDirs) {
    const dirPath = path.join(__dirname, '..', dir);
    await scanDir(dirPath, forbiddenKeywords);
  }
  console.log('  ✅ Guardrail Audit: Zero database client, API secrets, or hardcoded tournament violations found.');

  // 3. Execute Mock Ingestion Job
  console.log('[Phase 3 Verify] Running simulated ingestion job loop...');
  memoryIngestionRepository.clear();
  await runMockIngestionJob();

  const matches = memoryIngestionRepository.listMatches();
  const markets = memoryIngestionRepository.listMarkets();
  const runs = memoryIngestionRepository.listRuns();

  if (matches.length === 0) {
    console.error('  ❌ Failure: In-memory repository contains 0 matches after run.');
    process.exit(1);
  }
  console.log(`  ✅ Match Ingestion: Processed and saved ${matches.length} matches.`);

  if (markets.length === 0) {
    console.error('  ❌ Failure: In-memory repository contains 0 markets after run.');
    process.exit(1);
  }
  console.log(`  ✅ Market Ingestion: Processed and saved ${markets.length} markets.`);

  if (runs.length === 0) {
    console.error('  ❌ Failure: In-memory repository contains 0 runs reports after execution.');
    process.exit(1);
  }
  console.log(`  ✅ Run Logging: Recorded run report successfully. Status: ${runs[0]?.status}.`);

  console.log('\n[Phase 3 Verify] Phase 3 Ingestion verification tests PASSED successfully.');
}

async function scanDir(dirPath: string, keywords: string[]) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await scanDir(fullPath, keywords);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
      const content = await fs.readFile(fullPath, 'utf-8');
      const lowerContent = content.toLowerCase();

      for (const keyword of keywords) {
        if (lowerContent.includes(keyword)) {
          console.error(`  ❌ Violation in file ${fullPath}: Found forbidden keyword "${keyword}"`);
          process.exit(1);
        }
      }
    }
  }
}

verifyPhase3().catch((err) => {
  console.error('[Phase 3 Verify] Critical failure during execution:', err);
  process.exit(1);
});
