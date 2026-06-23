import { spawn } from 'child_process';

console.log('[Test-Endpoints] Starting API Gateway and Local AI servers...');

// Spawn background processes for apps/api and apps/local-ai
const apiProcess = spawn('node', ['apps/api/src/index.js'], { stdio: 'inherit' });
const aiProcess = spawn('node', ['apps/local-ai/src/index.js'], { stdio: 'inherit' });

function cleanupAndExit(exitCode) {
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
  
  process.exit(exitCode);
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

  console.log('\n=== Running Endpoint Boundary Integration Tests ===');

  // 1. GET /api/v1/health (Gateway Health Check)
  try {
    const res = await fetch('http://localhost:3001/api/v1/health');
    const data = await res.json();
    assert(res.ok && data.status === 'ok', 'GET /api/v1/health returns status ok');
  } catch (err) {
    assert(false, `GET /api/v1/health request failed: ${err.message}`);
  }

  // 2. GET /api/v1/matches (Gateway Matches list)
  try {
    const res = await fetch('http://localhost:3001/api/v1/matches');
    const data = await res.json();
    assert(res.ok && Array.isArray(data) && data.length > 0, 'GET /api/v1/matches returns array of fixtures');
    assert(data[0].id === 'match_2026_001', 'Match format uses generic competition-agnostic schema');
  } catch (err) {
    assert(false, `GET /api/v1/matches request failed: ${err.message}`);
  }

  // 3. GET /api/v1/predictions?matchId=match_2026_001 (Proxies to local-ai statistics processor)
  try {
    const res = await fetch('http://localhost:3001/api/v1/predictions?matchId=match_2026_001');
    const data = await res.json();
    assert(res.ok && data.matchId === 'match_2026_001', 'GET /api/v1/predictions returns prediction object');
    assert(data.predictionOutcome === 'home_win', 'Prediction outcome is correct');
    assert(data.status === 'completed' && data.prediction_available === true, 'Output contains ADR-0006 enriched properties');
  } catch (err) {
    assert(false, `GET /api/v1/predictions request failed: ${err.message}`);
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
    assert(false, `POST /api/v1/chat sports query failed: ${err.message}`);
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
    assert(false, `POST /api/v1/chat out-of-scope query failed: ${err.message}`);
  }

  // 6. GET /api/v1/bets (Read-only bet log audits check)
  try {
    const res = await fetch('http://localhost:3001/api/v1/bets');
    const data = await res.json();
    assert(res.ok && Array.isArray(data), 'GET /api/v1/bets returns simulated bet logs array');
    assert(data[0].betId === 'bet_2026_1001', 'Bet log matches mock boundary contracts');
  } catch (err) {
    assert(false, `GET /api/v1/bets request failed: ${err.message}`);
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
    assert(false, `POST /ai/v1/predict request failed: ${err.message}`);
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
    assert(false, `POST /ai/v1/explain request failed: ${err.message}`);
  }

  if (failed) {
    console.error('\n❌ [Test-Endpoints] E2E boundary verification FAILED.');
    cleanupAndExit(1);
  } else {
    console.log('\n✅ [Test-Endpoints] E2E boundary verification PASSED successfully.');
    cleanupAndExit(0);
  }
}, 1500);
