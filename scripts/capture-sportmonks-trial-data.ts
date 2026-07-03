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
  const args = parseCaptureArgs(process.argv.slice(2));
  const maxPagesPerEndpoint = args.maxPagesPerEndpoint
    ?? parsePositiveInteger(process.env['SPORTMONKS_MAX_PAGES_PER_ENDPOINT']);
  const catalog = filterByEndpointKeys(buildSportmonksEndpointCatalog(), args.endpointKeys);

  const result = await runSportmonksRawCapture({
    captureRoot: config.captureRoot,
    allowLiveEndpoints: config.allowLiveEndpoints || args.allowLiveEndpoints,
    catalog,
    client,
    log: (message) => {
      console.log(message);
    },
    ...(maxPagesPerEndpoint === undefined ? {} : { maxPagesPerEndpoint })
  });

  console.log(JSON.stringify({
    provider: config.provider,
    captureRoot: config.captureRoot,
    allowLiveEndpoints: config.allowLiveEndpoints || args.allowLiveEndpoints,
    endpointCount: catalog.length,
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

function parseCaptureArgs(args: string[]): {
  allowLiveEndpoints: boolean;
  endpointKeys: string[];
  maxPagesPerEndpoint?: number;
} {
  const parsed: {
    allowLiveEndpoints: boolean;
    endpointKeys: string[];
    maxPagesPerEndpoint?: number;
  } = {
    allowLiveEndpoints: false,
    endpointKeys: []
  };

  for (const arg of args) {
    if (arg === '--allow-live') {
      parsed.allowLiveEndpoints = true;
    } else if (arg.startsWith('--endpoint=')) {
      const key = arg.slice('--endpoint='.length).trim();
      if (key !== '') {
        parsed.endpointKeys.push(key);
      }
    } else if (arg.startsWith('--max-pages=')) {
      const maxPages = parsePositiveInteger(arg.slice('--max-pages='.length));
      if (maxPages !== undefined) {
        parsed.maxPagesPerEndpoint = maxPages;
      }
    }
  }

  return parsed;
}

function filterByEndpointKeys<T extends { endpointKey: string }>(catalog: T[], endpointKeys: string[]): T[] {
  if (endpointKeys.length === 0) {
    return catalog;
  }
  const allowed = new Set(endpointKeys);
  return catalog.filter((entry) => allowed.has(entry.endpointKey));
}
