import { spawn } from 'child_process';
import path from 'path';

console.log('[Test-Endpoints] Starting API Gateway and Local AI servers...');

// Spawn background processes for apps/api and apps/local-ai
const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs');
const spawnOptions = { stdio: 'inherit' as const };
const apiProcess = spawn(process.execPath, [tsxCli, 'apps/api/src/index.ts'], spawnOptions);
const aiProcess = spawn(process.execPath, [tsxCli, 'apps/local-ai/src/index.ts'], spawnOptions);

function cleanupAndExit(exitCode: number) {
  console.log('[Test-Endpoints] Shutting down background processes...');
  
  try {
    apiProcess.kill();
  } catch (e) {
    console.error('Failed to kill API Gateway:', e);
  }
  
  try {
    aiProcess.kill();
  } catch (e) {
    console.error('Failed to kill Local AI:', e);
  }
  
  // Delay exit slightly to let libuv clean up handles on Windows
  setTimeout(() => {
    process.exit(exitCode);
  }, 200);
}

process.on('SIGINT', () => cleanupAndExit(1));
process.on('SIGTERM', () => cleanupAndExit(1));

// Wait for servers to spin up
setTimeout(async () => {
  let failed = false;

  function assert(condition: boolean, message: string) {
    if (!condition) {
      console.error(`  ❌ FAIL: ${message}`);
      failed = true;
    } else {
      console.log(`  ✅ PASS: ${message}`);
    }
  }

  console.log('\n=== Running Endpoint Boundary Integration Tests ===');

  // 1. GET /api/v1/health (Gateway Health Check)
  try {
    const res = await fetch('http://localhost:3001/api/v1/health');
    const data = await res.json();
    assert(res.ok && data.status === 'ok', 'GET /api/v1/health returns status ok');
  } catch (err) {
    assert(false, `GET /api/v1/health request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. GET /api/v1/matches (Gateway Matches list)
  let firstMatchId = '';
  try {
    const res = await fetch('http://localhost:3001/api/v1/matches');
    const data = await res.json() as { matches?: Record<string, unknown>[] };
    assert(res.ok && data && Array.isArray(data.matches) && data.matches.length > 0, 'GET /api/v1/matches returns match feed object with matches array');
    const firstMatch = data.matches?.[0] as { id?: string } | undefined;
    firstMatchId = firstMatch?.id || '';
    assert(firstMatchId.startsWith('match-'), 'Match ID starts with "match-"');

    const hasSourceProviderId = data.matches?.some(m => 'sourceProviderId' in m);
    const hasProviderFixtureId = data.matches?.some(m => 'providerFixtureId' in m);
    assert(!hasSourceProviderId, 'No matches contain sourceProviderId');
    assert(!hasProviderFixtureId, 'No matches contain providerFixtureId');
  } catch (err) {
    assert(false, `GET /api/v1/matches request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2B. GET /api/v1/matches/detail (Gateway Match Detail)
  if (firstMatchId) {
    try {
      const res = await fetch(`http://localhost:3001/api/v1/matches/detail?id=${encodeURIComponent(firstMatchId)}`);
      const data = await res.json() as { match?: { id?: string }; events?: unknown[] };
      assert(res.ok && data && data.match?.id === firstMatchId, 'GET /api/v1/matches/detail returns detail for same local ID');
      assert(Array.isArray(data.events), 'GET /api/v1/matches/detail returns events array');
    } catch (err) {
      assert(false, `GET /api/v1/matches/detail request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2C. GET /api/v1/data-snapshot/status (Snapshot status)
  try {
    const res = await fetch('http://localhost:3001/api/v1/data-snapshot/status');
    const data = await res.json() as { matchCount?: number; freshness?: string };
    assert(res.ok && data && typeof data.matchCount === 'number' && data.matchCount > 0, 'GET /api/v1/data-snapshot/status returns status with matchCount > 0');
    assert(data.freshness === 'fresh' || data.freshness === 'stale', 'Status has valid freshness');
  } catch (err) {
    assert(false, `GET /api/v1/data-snapshot/status request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. GET /api/v1/predictions?matchId=match_2026_001 (Proxies to local-ai statistics processor)
  try {
    const res = await fetch('http://localhost:3001/api/v1/predictions?matchId=match_2026_001');
    const data = await res.json();
    assert(res.ok && data.matchId === 'match_2026_001', 'GET /api/v1/predictions returns prediction object');
    assert(data.predictionOutcome === 'home_win', 'Prediction outcome is correct');
    assert(data.status === 'completed' && data.prediction_available === true, 'Output contains ADR-0006 enriched properties');
  } catch (err) {
    assert(false, `GET /api/v1/predictions request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 4. POST /api/v1/chat (Approved sports query explanation)
  try {
    const res = await fetch('http://localhost:3001/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictionId: 'pred_2026_9999', message: 'Explain team statistics ratios' })
    });
    const data = await res.json();
    assert(res.ok && data.predictionId === 'pred_2026_9999', 'POST /api/v1/chat accepts sports-related questions');
    assert(data.trace.refusalCheck.passed === true, 'Refusal check passes for approved query');
  } catch (err) {
    assert(false, `POST /api/v1/chat sports query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 5. POST /api/v1/chat (Out-of-scope query safety refusal check)
  try {
    const res = await fetch('http://localhost:3001/api/v1/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictionId: 'pred_2026_9999', message: 'What is the recipe for lasagna?' })
    });
    const data = await res.json();
    assert(res.ok && data.trace.refusalCheck.passed === false, 'Out-of-scope query fails refusal check (ADR-0007 compliance)');
    assert(data.reply.includes('football prediction'), 'Out-of-scope reply returns safety refusal disclaimer');
  } catch (err) {
    assert(false, `POST /api/v1/chat out-of-scope query failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. GET /api/v1/bets (Read-only bet log audits check)
  try {
    const res = await fetch('http://localhost:3001/api/v1/bets');
    const data = await res.json();
    assert(res.ok && Array.isArray(data), 'GET /api/v1/bets returns simulated bet logs array');
    assert(data[0].betId === 'bet_2026_1001', 'Bet log matches mock boundary contracts');
  } catch (err) {
    assert(false, `GET /api/v1/bets request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 7. POST /ai/v1/predict (Local AI stats calculator stub)
  try {
    const res = await fetch('http://localhost:3002/ai/v1/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: 'match_2026_001' })
    });
    const data = await res.json();
    assert(res.ok && data.status === 'completed', 'POST /ai/v1/predict returns statistics payload status completed');
  } catch (err) {
    assert(false, `POST /ai/v1/predict request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 8. POST /ai/v1/explain (Local AI chatbot stats processor)
  try {
    const res = await fetch('http://localhost:3002/ai/v1/explain', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ predictionId: 'pred_2026_9999', message: 'Why Team A?' })
    });
    const data = await res.json();
    assert(res.ok && data.trace.refusalCheck.passed === true, 'POST /ai/v1/explain parses approved chatbot queries');
  } catch (err) {
    assert(false, `POST /ai/v1/explain request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (failed) {
    console.error('\n❌ [Test-Endpoints] E2E boundary verification FAILED.');
    cleanupAndExit(1);
  } else {
    console.log('\n✅ [Test-Endpoints] E2E boundary verification PASSED successfully.');
    cleanupAndExit(0);
  }
}, 1500);
