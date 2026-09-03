import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApiHandler } from './api-router.js';
import { assertHostedWebReady, serveHostedWeb } from './hosted-static-server.js';
import { createNodeApiListener } from './runtime/node-api-adapter.js';
import { createNodeRuntimeComposition } from './runtime/node-runtime-composition.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findRootDir(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    dir = path.dirname(dir);
  }
  return startDir;
}

function loadEnv(rootDir: string): void {
  const filePath = path.join(rootDir, '.env');
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

const rootDir = findRootDir(__dirname);
loadEnv(rootDir);
const composition = createNodeRuntimeComposition({ rootDir });
if (composition.hostedWebMode === 'required') assertHostedWebReady(composition.hostedWebRoot);

const listener = createNodeApiListener(
  createApiHandler(composition.runtime),
  async (request, response) => {
    if (composition.hostedWebMode === 'required') {
      try {
        if (await serveHostedWeb(request, response, composition.hostedWebRoot)) return;
      } catch {
        response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({
          error: { code: 'hosted_web_unavailable', message: 'Hosted web artifact is unavailable.' }
        }));
        return;
      }
    }
    const pathname = new URL(request.url || '/', 'http://localhost').pathname;
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end(`404 Not Found: ${pathname}`);
  }
);

const configuredApiUrl = process.env.API_URL?.trim();
const configuredApiPort = configuredApiUrl ? new URL(configuredApiUrl).port : '';
const configuredPort = process.env.PORT?.trim() || configuredApiPort;
if (!configuredPort) throw new Error('PORT or port in API_URL must be defined in .env');

const port = Number(configuredPort);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

http.createServer(listener).listen(port, '0.0.0.0', () => {
  console.log(`[API Mediation Gateway] Running at ${configuredApiUrl || `http://0.0.0.0:${port}`}`);
});
