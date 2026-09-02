import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleHealth } from './routes/health.js';
import { handleMatches } from './routes/matches.js';
import { handleBets } from './routes/bets.js';
import { handleBetDrafts } from './routes/bet-drafts.js';
import { handleCloudPersistenceStatus } from './routes/cloud-persistence-status.js';
import { handleBankroll } from './routes/bankroll.js';
import { handleBackups } from './routes/backups.js';
import { handleDiscipline } from './routes/discipline.js';
import { handleBetSettlements } from './routes/bet-settlements.js';
import { handleBetReports } from './routes/bet-reports.js';
import { handleIngestionStatus } from './routes/ingestion-status.mock.js';
import { handleMatchDetail } from './routes/match-detail.js';
import { handleDataSnapshotStatus } from './routes/data-snapshot-status.js';
import { readCloudPersistenceConfig } from './config/cloud-persistence-config.js';
import { createCloudPersistenceAdapter } from './persistence/create-cloud-persistence-adapter.js';
import { ServingMatchStoreRepository } from './repositories/serving-match-store-repository.js';
import { CloudMatchSnapshotRepository } from './repositories/cloud-match-snapshot-repository.js';
import { FallbackMatchSnapshotRepository } from './repositories/fallback-match-snapshot-repository.js';
import { assertHostedWebReady, serveHostedWeb } from './hosted-static-server.js';
import { enforceOriginBoundary } from './http-origin-boundary.js';
import { readOwnerAuthConfig } from './auth/owner-auth.js';
import { enforceOwnerSession, handleOwnerAuthRoute, isOwnerAuthRoute } from './auth/owner-auth-boundary.js';
import { SportScoreWidgetClient, type SportScoreLiveSource } from './live/sportscore-widget-client.js';
import { LiveRefreshCoordinator } from './live/live-refresh-coordinator.js';
import { handleLiveMatches } from './routes/live-matches.js';
import {
  isAuthorizedHourlyLiveRefresh,
  readLiveRefreshServiceAuthConfig
} from './auth/live-refresh-service-auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRootDir(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return startDir;
}

const ROOT_DIR = findRootDir(__dirname);

function loadEnv(rootDir: string) {
  const envFiles = ['.env'];
  for (const file of envFiles) {
    const filePath = path.join(rootDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const index = trimmed.indexOf('=');
        if (index > 0) {
          const key = trimmed.slice(0, index).trim();
          const value = trimmed.slice(index + 1).trim();
          const unquoted = value.replace(/^['"]|['"]$/g, '');
          if (key && process.env[key] === undefined) {
            process.env[key] = unquoted;
          }
        }
      }
    }
  }
}

loadEnv(ROOT_DIR);
const cloudConfig = readCloudPersistenceConfig();
const ownerAuthConfig = readOwnerAuthConfig();
const liveRefreshServiceAuthConfig = readLiveRefreshServiceAuthConfig();
const cloudDependencies = { adapter: createCloudPersistenceAdapter(cloudConfig), ownerProfileId: cloudConfig.ownerProfileId };
const hostedWebMode = process.env.HOSTED_WEB_MODE?.trim() || 'disabled';
if (hostedWebMode !== 'disabled' && hostedWebMode !== 'required') {
  throw new Error('HOSTED_WEB_MODE must be disabled or required');
}
const hostedWebRoot = path.resolve(ROOT_DIR, process.env.HOSTED_WEB_ROOT?.trim() || 'apps/web/dist');
if (hostedWebMode === 'required') assertHostedWebReady(hostedWebRoot);
const matchRepository = new FallbackMatchSnapshotRepository(
  new ServingMatchStoreRepository(),
  new CloudMatchSnapshotRepository(cloudDependencies.adapter, cloudConfig.ownerProfileId)
);
const sportScoreLiveMode = process.env.SPORTSCORE_LIVE_MODE?.trim() || 'disabled';
if (sportScoreLiveMode !== 'disabled' && sportScoreLiveMode !== 'widget') {
  throw new Error('SPORTSCORE_LIVE_MODE must be disabled or widget');
}
const disabledLiveSource: SportScoreLiveSource = {
  listMatches: async () => { throw new Error('SportScore live widget is disabled'); },
  getMatch: async () => { throw new Error('SportScore live widget is disabled'); }
};
const widgetTimeoutMs = Number(process.env.SPORTSCORE_WIDGET_TIMEOUT_MS?.trim() || 8_000);
const liveCoordinator = new LiveRefreshCoordinator({
  ownerProfileId: cloudConfig.ownerProfileId,
  persistence: cloudDependencies.adapter,
  repository: matchRepository,
  source: sportScoreLiveMode === 'widget'
    ? new SportScoreWidgetClient({ timeoutMs: widgetTimeoutMs })
    : disabledLiveSource
});

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname;

  if (enforceOriginBoundary(req, res, process.env.CORS_ALLOWED_ORIGIN?.trim()) === 'handled') return;

  console.log(`[API Gateway] Received ${req.method} ${req.url}`);

  if (isOwnerAuthRoute(pathname)) {
    void handleOwnerAuthRoute(req, res, ownerAuthConfig);
  } else if (!isAuthorizedHourlyLiveRefresh(req, liveRefreshServiceAuthConfig)
    && enforceOwnerSession(req, res, ownerAuthConfig) === 'handled') {
    return;
  } else if (pathname === '/api/v1/health') {
    handleHealth(req, res);
  } else if (pathname === '/api/v1/live' || pathname === '/api/v1/live/refresh') {
    void handleLiveMatches(req, res, { coordinator: liveCoordinator });
  } else if (pathname === '/api/v1/matches/detail') {
    void handleMatchDetail(req, res, { repository: matchRepository });
  } else if (pathname === '/api/v1/data-snapshot/status') {
    void handleDataSnapshotStatus(req, res, { repository: matchRepository });
  } else if (pathname === '/api/v1/matches') {
    void handleMatches(req, res, { repository: matchRepository });
  } else if (/^\/api\/v1\/bets\/[^/]+\/settlements$/.test(pathname)) {
    void handleBetSettlements(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/bets') {
    void handleBets(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/discipline-config' || pathname === '/api/v1/discipline-challenges') {
    void handleDiscipline(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/bet-reports') {
    void handleBetReports(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/bet-drafts') {
    void handleBetDrafts(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/cloud-persistence/status') {
    void handleCloudPersistenceStatus(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/bankroll/setup' || pathname === '/api/v1/bankroll/accounts' || pathname === '/api/v1/bankroll/ledger' || pathname === '/api/v1/bankroll/summary' || pathname === '/api/v1/bankroll/transfers') {
    void handleBankroll(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/backups/export' || pathname === '/api/v1/backups/import' || pathname === '/api/v1/backups/log') {
    void handleBackups(req, res, cloudDependencies);
  } else if (pathname === '/api/v1/ingestion/status') {
    handleIngestionStatus(req, res);
  } else if (pathname === '/api' || pathname.startsWith('/api/')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
  } else if (hostedWebMode === 'required') {
    void serveHostedWeb(req, res, hostedWebRoot).then((handled) => {
      if (handled) return;
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(`404 Not Found: ${pathname}`);
    }).catch(() => {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: { code: 'hosted_web_unavailable', message: 'Hosted web artifact is unavailable.' } }));
    });
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
  }
});

const configuredApiUrl = process.env.API_URL?.trim();
const configuredApiPort = configuredApiUrl ? new URL(configuredApiUrl).port : '';
const configuredPort = process.env.PORT?.trim() || configuredApiPort;
if (!configuredPort) {
  throw new Error('PORT or port in API_URL must be defined in .env');
}

const PORT = Number(configuredPort);
if (!Number.isSafeInteger(PORT) || PORT < 1 || PORT > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[API Mediation Gateway] Running at ${configuredApiUrl || `http://0.0.0.0:${PORT}`}`);
});
