import { spawn } from 'child_process';
import fs from 'fs/promises';
import { createServer } from 'net';
import os from 'os';
import path from 'path';
import { buildServingMatchStore } from '../apps/api/src/repositories/serving-match-store.js';
import type { LocalMatch } from '../packages/shared/src/contracts/index.js';

console.log('[Test-Endpoints] Starting API server...');

const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs');
const integrationServingRoot = await prepareIntegrationServingStore();
const apiPort = await findOpenPort(3001);
const apiBaseUrl = `http://localhost:${apiPort}`;
const apiSpawnOptions = { stdio: 'inherit' as const, env: { ...process.env, APP_ENV: 'test', CLOUD_PERSISTENCE_MODE: 'memory', API_URL: apiBaseUrl, PORT: String(apiPort), LOCAL_MATCH_SERVING_ROOT: integrationServingRoot } };
const apiProcess = spawn(process.execPath, [tsxCli, 'apps/api/src/index.ts'], apiSpawnOptions);

function cleanupAndExit(exitCode: number) {
  console.log('[Test-Endpoints] Shutting down background processes...');
  
  try {
    apiProcess.kill();
  } catch (e) {
    console.error('Failed to kill API Gateway:', e);
  }
  
  void fs.rm(integrationServingRoot, { recursive: true, force: true });
  
  // Delay exit slightly to let libuv clean up handles on Windows
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

  console.log('\n=== Running Endpoint Boundary Integration Tests ===');

  try {
    await waitForEndpoint(`${apiBaseUrl}/api/v1/health`);
  } catch (err) {
    assert(false, `Servers did not become ready: ${err instanceof Error ? err.message : String(err)}`);
    cleanupAndExit(1);
    return;
  }

  // 1. GET /api/v1/health (Gateway Health Check)
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/health`);
    const data = await res.json();
    assert(res.ok && data.status === 'ok', 'GET /api/v1/health returns status ok');
  } catch (err) {
    assert(false, `GET /api/v1/health request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 2. GET /api/v1/matches (Gateway Matches list)
  let firstMatchId = '';
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/matches`);
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
      const res = await fetch(`${apiBaseUrl}/api/v1/matches/detail?id=${encodeURIComponent(firstMatchId)}`);
      const data = await res.json() as { match?: { id?: string }; events?: unknown[] };
      assert(res.ok && data && data.match?.id === firstMatchId, 'GET /api/v1/matches/detail returns detail for same local ID');
      assert(Array.isArray(data.events), 'GET /api/v1/matches/detail returns events array');
    } catch (err) {
      assert(false, `GET /api/v1/matches/detail request failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 2C. GET /api/v1/data-snapshot/status (Snapshot status)
  try {
    const res = await fetch(`${apiBaseUrl}/api/v1/data-snapshot/status`);
    const data = await res.json() as { matchCount?: number; freshness?: string };
    assert(res.ok && data && typeof data.matchCount === 'number' && data.matchCount > 0, 'GET /api/v1/data-snapshot/status returns status with matchCount > 0');
    assert(data.freshness === 'fresh' || data.freshness === 'stale', 'Status has valid freshness');
  } catch (err) {
    assert(false, `GET /api/v1/data-snapshot/status request failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 3. Removed AI compatibility routes stay absent.
  try {
    const removedRoutes = ['predictions', 'chat', 'mock/predict', 'mock/explain']
      .map((pathSegment) => `/api/v1/${pathSegment}`);
    for (const route of removedRoutes) {
      const res = await fetch(`${apiBaseUrl}${route}`);
      assert(res.status === 404, `GET ${route} remains removed`);
    }
  } catch (err) {
    assert(false, `Removed route boundary check failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  // 6. Phase 9 owner-only cloud persistence in memory integration mode
  try {
    const statusRes = await fetch(`${apiBaseUrl}/api/v1/cloud-persistence/status`);
    const status = await statusRes.json() as { state?: string };
    assert(statusRes.ok && status.state === 'ready', 'Cloud persistence status is ready in memory integration mode');

    const timestamp = '2026-07-02T00:00:00.000Z';
    const draft = { draftId: 'e2e-draft', matchGroupId: firstMatchId || 'match-e2e', marketType: '1X2', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, createdAt: timestamp, updatedAt: timestamp };
    const draftCreate = await fetch(`${apiBaseUrl}/api/v1/bet-drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft) });
    assert(draftCreate.status === 201, 'POST /api/v1/bet-drafts creates a draft');
    const draftList = await fetch(`${apiBaseUrl}/api/v1/bet-drafts`);
    assert(draftList.ok && (await draftList.json() as unknown[]).length === 1, 'GET /api/v1/bet-drafts lists drafts');

    const bet = { betId: 'e2e-bet', matchGroupId: firstMatchId || 'match-e2e', homeTeamName: 'Japan', awayTeamName: 'Vietnam', marketType: '1X2', selectionLabel: 'Japan', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'pending', createdAt: timestamp, updatedAt: timestamp };
    const betCreate = await fetch(`${apiBaseUrl}/api/v1/bets`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bet) });
    assert(betCreate.status === 201, 'POST /api/v1/bets creates a bet record');
    const betPatch = await fetch(`${apiBaseUrl}/api/v1/bets?id=e2e-bet`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: 'integration update' }) });
    assert(betPatch.ok, 'PATCH /api/v1/bets updates an allowed field');

    const accountCreate = await fetch(`${apiBaseUrl}/api/v1/bankroll/accounts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accountId: 'e2e-account', label: 'Integration', unit: 'points', openingBalancePoints: 100 }) });
    assert(accountCreate.status === 201, 'POST /api/v1/bankroll/accounts creates a points account');
    const ledgerCreate = await fetch(`${apiBaseUrl}/api/v1/bankroll/ledger`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId: 'e2e-entry', accountId: 'e2e-account', entryType: 'withdrawal', amountPoints: -10, occurredAt: timestamp }) });
    assert(ledgerCreate.status === 201, 'POST /api/v1/bankroll/ledger creates a signed manual entry');
    const backupExport = await fetch(`${apiBaseUrl}/api/v1/backups/export`, { method: 'POST' });
    const backup = await backupExport.json() as { schemaVersion?: string };
    assert(backupExport.ok && backup.schemaVersion === 'miraichi.cloud-backup.v1', 'POST /api/v1/backups/export returns a cloud backup');

    const draftDelete = await fetch(`${apiBaseUrl}/api/v1/bet-drafts?id=e2e-draft`, { method: 'DELETE' });
    assert(draftDelete.status === 204, 'DELETE /api/v1/bet-drafts removes the integration draft');
  } catch (err) {
    assert(false, `Phase 9 cloud persistence integration failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (failed) {
    console.error('\n❌ [Test-Endpoints] E2E boundary verification FAILED.');
    cleanupAndExit(1);
  } else {
    console.log('\n✅ [Test-Endpoints] E2E boundary verification PASSED successfully.');
    cleanupAndExit(0);
  }
})();

async function prepareIntegrationServingStore(): Promise<string> {
  const servingRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-e2e-serving-'));
  const importedAt = '2026-07-05T00:00:00.000Z';
  const match: LocalMatch = {
    id: 'match-e2e-world-cup-2026',
    competition: {
      id: 'world-cup-2026',
      name: 'FIFA World Cup',
      type: 'national-team',
      season: '2026'
    },
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: 'team-japan', name: 'Japan' },
    awayTeam: { id: 'team-vietnam', name: 'Vietnam' },
    score: { home: null, away: null },
    sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: 'e2e-fixture', importedAt }],
    updatedAt: importedAt
  };

  await buildServingMatchStore({
    servingRoot,
    version: 'e2e',
    snapshotId: 'serving-e2e',
    generatedAt: importedAt,
    importedAt,
    sources: [{ sourceId: 'manual-snapshot', importedAt }],
    matches: [match],
    scope: 'configured-competitions'
  });

  return servingRoot;
}

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
