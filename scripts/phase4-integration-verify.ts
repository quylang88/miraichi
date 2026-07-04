import { spawn } from 'child_process';
import fs from 'fs/promises';
import { createServer } from 'net';
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
const apiPort = await findOpenPort(3001);
const localAiPort = await findOpenPort(3002);
const apiBaseUrl = `http://localhost:${apiPort}`;
const localAiBaseUrl = `http://localhost:${localAiPort}`;
const apiSpawnOptions = { stdio: 'inherit' as const, env: { ...process.env, APP_ENV: 'test', CLOUD_PERSISTENCE_MODE: 'memory', API_URL: apiBaseUrl, LOCAL_AI_URL: localAiBaseUrl, PORT: String(apiPort) } };
const aiSpawnOptions = { stdio: 'inherit' as const, env: { ...process.env, APP_ENV: 'test', CLOUD_PERSISTENCE_MODE: 'memory', API_URL: apiBaseUrl, LOCAL_AI_URL: localAiBaseUrl, PORT: String(localAiPort) } };
const apiProcess = spawn(process.execPath, [tsxCli, 'apps/api/src/index.ts'], apiSpawnOptions);
const aiProcess = spawn(process.execPath, [tsxCli, 'apps/local-ai/src/index.ts'], aiSpawnOptions);

function cleanupAndExit(exitCode: number) {
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

void (async () => {
  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`  ✅ PASS: ${message}`);
    }
  }

  try {
    await waitForEndpoint(`${apiBaseUrl}/api/v1/health`);
    await waitForEndpoint(`${localAiBaseUrl}/ai/v1/health`);
  } catch (err) {
    assert(false, `Servers did not become ready: ${err instanceof Error ? err.message : String(err)}`);
    cleanupAndExit(1);
    return;
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
    const res = await fetch(`${apiBaseUrl}/api/v1/mock/predict`, {
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
    assert(false, `POST /api/v1/mock/predict failed: ${err instanceof Error ? err.message : String(err)}`);
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

    const res = await fetch(`${apiBaseUrl}/api/v1/mock/explain`, {
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
    assert(false, `POST /api/v1/mock/explain failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (failed) {
    console.error('\n❌ [Phase 4 Integration Verify] Tests FAILED.');
    cleanupAndExit(1);
  } else {
    console.log('\n✅ [Phase 4 Integration Verify] All integration tests PASSED.');
    cleanupAndExit(0);
  }
})();

async function waitForEndpoint(url: string, timeoutMs = 15000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError = '';
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${url} did not become ready within ${timeoutMs}ms. Last error: ${lastError}`);
}

async function findOpenPort(preferredPort: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code !== 'EADDRINUSE') {
        reject(error);
        return;
      }
      const fallback = createServer();
      fallback.once('error', reject);
      fallback.listen(0, () => {
        const address = fallback.address();
        fallback.close(() => {
          if (typeof address === 'object' && address !== null) {
            resolve(address.port);
          } else {
            reject(new Error('Could not allocate fallback port.'));
          }
        });
      });
    });
    server.listen(preferredPort, () => {
      server.close(() => resolve(preferredPort));
    });
  });
}
