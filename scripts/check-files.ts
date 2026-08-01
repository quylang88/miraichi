import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '../');

const REQUIRED_FILES = [
  'package.json',
  'pnpm-workspace.yaml',
  
  'apps/web/package.json',
  'apps/web/src/index.ts',
  'apps/web/src/config/navigation-tabs.ts',
  'apps/web/src/components/app-shell.ts',

  'apps/api/package.json',
  'apps/api/src/index.ts',
  'apps/api/src/routes/health.ts',
  'apps/api/src/routes/matches.ts',
  'apps/api/src/routes/bets.ts',
  'apps/api/src/routes/bankroll.ts',

  'apps/worker/package.json',
  'apps/worker/src/index.ts',
  'apps/worker/src/jobs/mock-ingestion-job.ts',
  'apps/worker/src/fixtures/generic-matches.mock.json',

  'packages/shared/package.json',
  'packages/shared/src/index.ts',
  'packages/shared/src/contracts/local-match-contracts.ts',

  'packages/config/package.json',
  'packages/config/src/index.ts',
  'packages/config/src/competition-registry.mock.ts',

  'packages/ui/package.json',
  'packages/ui/src/index.ts',
  'packages/ui/src/primitives.ts',

  'packages/agent-protocol/package.json',
  'packages/agent-protocol/src/index.ts',
  'packages/agent-protocol/src/handoff-template.ts'
];

console.log('[Check-Files] Verifying skeleton scaffolding files exist...');
let missingCount = 0;

for (const relPath of REQUIRED_FILES) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`  ❌ Missing: ${relPath}`);
    missingCount++;
  } else {
    console.log(`  ✅ Exists:  ${relPath}`);
  }
}

if (missingCount > 0) {
  console.error(`\n[Check-Files] Verification FAILED: ${missingCount} files are missing.`);
  process.exit(1);
} else {
  console.log('\n[Check-Files] Verification PASSED: All required files exist.');
}
