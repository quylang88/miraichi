import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSportmonksClient } from './providers/sportmonks/client.js';
import { readSportmonksCaptureConfig } from './providers/sportmonks/config.js';
import { runSportmonksRawCapture } from './providers/sportmonks/capture.js';
import { buildSportmonksEndpointCatalog } from './providers/sportmonks/endpoint-catalog.js';

loadDotEnvIfPresent(resolve(process.cwd(), '.env'));

try {
  const config = readSportmonksCaptureConfig(process.env);
  const client = createSportmonksClient({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute
  });
  const maxPagesPerEndpoint = parsePositiveInteger(process.env['SPORTMONKS_MAX_PAGES_PER_ENDPOINT']);

  const result = await runSportmonksRawCapture({
    captureRoot: config.captureRoot,
    allowGatedEndpoints: config.allowGatedEndpoints,
    catalog: buildSportmonksEndpointCatalog(),
    client,
    log: (message) => {
      console.log(message);
    },
    ...(maxPagesPerEndpoint === undefined ? {} : { maxPagesPerEndpoint })
  });

  console.log(JSON.stringify({
    provider: config.provider,
    captureRoot: config.captureRoot,
    allowGatedEndpoints: config.allowGatedEndpoints,
    result
  }, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function loadDotEnvIfPresent(filePath: string): void {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) {
      continue;
    }

    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) {
      continue;
    }

    const key = match[1];
    const value = unquoteEnvValue(match[2] ?? '');
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function unquoteEnvValue(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}
