import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[Phase 4 Integration Verify] Starting integration tests...');

const filesToCheck = [
  'apps/api/src/routes/mock-prediction.ts',
  'apps/api/src/routes/mock-explanation.ts',
  'apps/web/src/views/prediction-envelope-view.ts',
  'apps/web/src/views/mock-explanation-refusal-view.ts'
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

// 2. Spawn background API and Local AI servers
console.log('[Phase 4 Integration Verify] Starting API Gateway and Local AI servers in background...');
const tsxCli = path.join(__dirname, '..', 'node_modules/tsx/dist/cli.mjs');
const spawnOptions = { stdio: 'inherit' as const };
const apiProcess = spawn(process.execPath, [tsxCli, 'apps/api/src/index.ts'], spawnOptions);
const aiProcess = spawn(process.execPath, [tsxCli, 'apps/local-ai/src/index.ts'], spawnOptions);

function cleanupAndExit(exitCode) {
  console.log('[Phase 4 Integration Verify] Shutting down background processes...');
  try {
    apiProcess.kill();
  } catch {}
  try {
    aiProcess.kill();
  } catch {}
  setTimeout(() => {
    process.exit(exitCode);
  }, 200);
}

process.on('SIGINT', () => cleanupAndExit(1));
process.on('SIGTERM', () => cleanupAndExit(1));

// Wait for servers to spin up
setTimeout(async () => {
  let failed = false;

  function assert(condition, message) {
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`  ✅ PASS: ${message}`);
    }
  }

  // A generic mock candidate
  const mockCandidate = {
    inputCandidateId: 'input-candidate-alpha-001',
    matchId: 'match-alpha-001',
    competitionId: 'competition-alpha',
    seasonId: 'season-alpha-2026',
    sourceProviderId: 'provider-mock-alpha',
    ingestedAt: new Date().toISOString(),
    freshnessStatus: 'fresh',
    validationStatus: 'passed',
    availableMarkets: ['1X2'],
    dataQualityIssues: [],
    trace: {
      workerRunId: 'run-alpha-001',
      adapterVersion: '1.0.0-mock'
    }
  };

  // Test POST /api/v1/mock/predict (Gateway to Local-AI proxy)
  try {
    console.log('[Phase 4 Integration Verify] Testing POST /api/v1/mock/predict...');
    const res = await fetch('http://localhost:3001/api/v1/mock/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockCandidate)
    });
    
    const envelope = await res.json();
    assert(res.ok, 'Response status is 200 OK');
    assert(envelope.predictionAvailable === false, 'predictionAvailable is false');
    assert(envelope.engineMode === 'mock', 'engineMode is "mock"');
    assert(envelope.confidenceLabel === 'not_available', 'confidenceLabel is "not_available"');
    assert(envelope.trace.inputCandidateId === 'input-candidate-alpha-001', 'Trace propagates inputCandidateId');
    assert(envelope.trace.workerRunId === 'run-alpha-001', 'Trace propagates workerRunId');

    // Forbidden check
    const forbiddenLabels = ['home_win', 'draw', 'away_win', 'over_under', 'btts', 'recommended_pick', 'recommended_bet'];
    const serializedEnvelope = JSON.stringify(envelope).toLowerCase();
    for (const label of forbiddenLabels) {
      assert(!serializedEnvelope.includes(label), `Envelope does not contain forbidden outcome keyword "${label}"`);
    }
  } catch (err) {
    assert(false, `POST /api/v1/mock/predict failed: ${err.message}`);
  }

  // Test POST /api/v1/mock/explain (Gateway to Local-AI proxy)
  try {
    console.log('[Phase 4 Integration Verify] Testing POST /api/v1/mock/explain...');
    const mockEnvelope = {
      predictionId: 'pred-mock-test-id-123',
      matchId: 'match-alpha-001',
      predictionAvailable: false,
      trace: {
        inputCandidateId: 'input-candidate-alpha-001'
      }
    };

    const res = await fetch('http://localhost:3001/api/v1/mock/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockEnvelope)
    });

    const explanation = await res.json();
    assert(res.ok, 'Explanation response is 200 OK');
    assert(explanation.explanationAvailable === false, 'explanationAvailable is false');
    assert(explanation.text.includes('No prediction data is available'), 'Returns correct refusal text');
    assert(explanation.references.predictionId === 'pred-mock-test-id-123', 'Propagates correct prediction references');
  } catch (err) {
    assert(false, `POST /api/v1/mock/explain failed: ${err.message}`);
  }

  if (failed) {
    console.error('\n❌ [Phase 4 Integration Verify] Tests FAILED.');
    cleanupAndExit(1);
  } else {
    console.log('\n✅ [Phase 4 Integration Verify] All integration tests PASSED.');
    cleanupAndExit(0);
  }
}, 1500);
