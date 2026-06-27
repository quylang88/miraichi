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
  'apps/web/src/index.js',
  'apps/web/src/mock-client.js',
  'apps/web/src/views/predictions-view.js',
  'apps/web/src/views/explanation-view.js',
  'apps/web/src/views/bet-history-placeholder-view.js',

  'apps/api/package.json',
  'apps/api/src/index.js',
  'apps/api/src/routes/health.js',
  'apps/api/src/routes/predictions.mock.js',
  'apps/api/src/routes/explanations.mock.js',
  'apps/api/src/routes/bet-history.mock.js',

  'apps/local-ai/package.json',
  'apps/local-ai/src/index.js',
  'apps/local-ai/src/routes/health.js',
  'apps/local-ai/src/routes/prediction-candidates.mock.js',

  'apps/worker/package.json',
  'apps/worker/src/index.js',
  'apps/worker/src/jobs/mock-ingestion-job.js',
  'apps/worker/src/fixtures/generic-matches.mock.json',

  'packages/shared/package.json',
  'packages/shared/src/index.js',
  'packages/shared/src/mock-contracts.js',

  'packages/config/package.json',
  'packages/config/src/index.js',
  'packages/config/src/competition-registry.mock.js',

  'packages/ui/package.json',
  'packages/ui/src/index.js',
  'packages/ui/src/primitives.js',

  'packages/agent-protocol/package.json',
  'packages/agent-protocol/src/index.js',
  'packages/agent-protocol/src/handoff-template.js'
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
