import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSportmonksClient } from './providers/sportmonks/client.js';
import { readSportmonksCaptureConfig } from './providers/sportmonks/config.js';
import {
  isSportmonksExpectedEndpointKey,
  runSportmonksExpectedCapture,
  type SportmonksExpectedEndpointKey
} from './providers/sportmonks/expected-capture.js';

export interface SportmonksExpectedCaptureCliArgs {
  endpointKeys: SportmonksExpectedEndpointKey[];
  includeRelations: boolean;
  maxPagesPerEndpoint?: number;
}

export function parseSportmonksExpectedCaptureArgs(args: string[]): SportmonksExpectedCaptureCliArgs {
  const parsed: SportmonksExpectedCaptureCliArgs = {
    endpointKeys: [],
    includeRelations: true
  };

  for (const arg of args) {
    if (arg === '--no-include-relations') {
      parsed.includeRelations = false;
    } else if (arg.startsWith('--endpoint=')) {
      const key = arg.slice('--endpoint='.length).trim();
      if (!isSportmonksExpectedEndpointKey(key)) {
        throw new Error(`Unsupported Sportmonks expected endpoint: ${key}`);
      }
      parsed.endpointKeys.push(key);
    } else if (arg.startsWith('--max-pages=')) {
      const maxPages = parsePositiveInteger(arg.slice('--max-pages='.length));
      if (maxPages !== undefined) {
        parsed.maxPagesPerEndpoint = maxPages;
      }
    }
  }

  parsed.endpointKeys = dedupeEndpointKeys(parsed.endpointKeys);
  return parsed;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  loadDotEnvIfPresent(resolve(process.cwd(), '.env'));
  const config = readSportmonksCaptureConfig(process.env);
  const cliArgs = parseSportmonksExpectedCaptureArgs(args);
  const client = createSportmonksClient({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute
  });

  const result = await runSportmonksExpectedCapture({
    captureRoot: config.captureRoot,
    client,
    ...(cliArgs.endpointKeys.length === 0 ? {} : { endpointKeys: cliArgs.endpointKeys }),
    includeRelations: cliArgs.includeRelations,
    ...(cliArgs.maxPagesPerEndpoint === undefined ? {} : { maxPagesPerEndpoint: cliArgs.maxPagesPerEndpoint }),
    log: (message) => console.log(message)
  });

  console.log(JSON.stringify({
    provider: config.provider,
    captureRoot: config.captureRoot,
    endpointKeys: cliArgs.endpointKeys,
    includeRelations: cliArgs.includeRelations,
    result
  }, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
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

    const key = match[1]!;
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

function dedupeEndpointKeys(keys: SportmonksExpectedEndpointKey[]): SportmonksExpectedEndpointKey[] {
  const seen = new Set<SportmonksExpectedEndpointKey>();
  const output: SportmonksExpectedEndpointKey[] = [];
  for (const key of keys) {
    if (!seen.has(key)) {
      seen.add(key);
      output.push(key);
    }
  }
  return output;
}
