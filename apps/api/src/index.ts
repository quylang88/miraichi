import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { handleHealth } from './routes/health.js';
import { handleMatches } from './routes/matches.js';
import { handlePredictions } from './routes/predictions.mock.js';
import { handleExplanations } from './routes/explanations.mock.js';
import { handleBetHistory } from './routes/bet-history.mock.js';
import { handleIngestionStatus } from './routes/ingestion-status.mock.js';
import { handleMockPredict } from './routes/mock-prediction.js';
import { handleMockExplain } from './routes/mock-explanation.js';

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
  const envFiles = ['.env', '.env.local'];
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

const PORT = process.env.PORT || 3001;

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url || '/', 'http://localhost');
  const pathname = parsedUrl.pathname;

  // Global CORS headers for dev frontend communication
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  console.log(`[API Gateway] Received ${req.method} ${req.url}`);

  if (pathname === '/api/v1/health') {
    handleHealth(req, res);
  } else if (pathname === '/api/v1/matches') {
    void handleMatches(req, res);
  } else if (pathname === '/api/v1/predictions') {
    handlePredictions(req, res);
  } else if (pathname === '/api/v1/chat') {
    handleExplanations(req, res);
  } else if (pathname === '/api/v1/bets') {
    handleBetHistory(req, res);
  } else if (pathname === '/api/v1/ingestion/status') {
    handleIngestionStatus(req, res);
  } else if (pathname === '/api/v1/mock/predict') {
    handleMockPredict(req, res);
  } else if (pathname === '/api/v1/mock/explain') {
    handleMockExplain(req, res);
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
  }
});

server.listen(PORT, () => {
  console.log(`[API Mediation Gateway] Running at http://localhost:${PORT}`);
});
