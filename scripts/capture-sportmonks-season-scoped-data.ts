import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createSportmonksClient } from './providers/sportmonks/client.js';
import { readSportmonksCaptureConfig } from './providers/sportmonks/config.js';
import {
  runSportmonksSeasonScopedCapture,
  type SportmonksSeasonScopedEndpointKey
} from './providers/sportmonks/season-scoped-capture.js';

export interface SportmonksSeasonScopedCaptureCliArgs {
  leagueIds: number[];
  seasonIds: number[];
  endpoints: SportmonksSeasonScopedEndpointKey[];
  maxRequests?: number;
  skipAlreadyCaptured: boolean;
}

const VALID_ENDPOINTS = new Set<SportmonksSeasonScopedEndpointKey>([
  'schedules.bySeasonId',
  'teams.bySeasonId',
  'standings.bySeasonId',
  'standings.correctionsBySeasonId'
]);

export function parseSportmonksSeasonScopedCaptureArgs(args: string[]): SportmonksSeasonScopedCaptureCliArgs {
  const parsed: SportmonksSeasonScopedCaptureCliArgs = {
    leagueIds: [],
    seasonIds: [],
    endpoints: [],
    skipAlreadyCaptured: true
  };

  for (const arg of args) {
    if (arg.startsWith('--league-id=')) {
      parsed.leagueIds.push(...parsePositiveIntegerList(arg.slice('--league-id='.length)));
    } else if (arg.startsWith('--season-id=')) {
      parsed.seasonIds.push(...parsePositiveIntegerList(arg.slice('--season-id='.length)));
    } else if (arg.startsWith('--endpoint=')) {
      const endpoint = arg.slice('--endpoint='.length).trim();
      if (isSeasonScopedEndpoint(endpoint)) {
        parsed.endpoints.push(endpoint);
      } else if (endpoint !== '') {
        throw new Error(`Unsupported Sportmonks season-scoped endpoint: ${endpoint}`);
      }
    } else if (arg.startsWith('--max-requests=')) {
      const maxRequests = parsePositiveInteger(arg.slice('--max-requests='.length));
      if (maxRequests !== undefined) {
        parsed.maxRequests = maxRequests;
      }
    } else if (arg === '--no-skip-existing') {
      parsed.skipAlreadyCaptured = false;
    }
  }

  parsed.leagueIds = dedupePositiveIds(parsed.leagueIds);
  parsed.seasonIds = dedupePositiveIds(parsed.seasonIds);
  parsed.endpoints = dedupeEndpoints(parsed.endpoints);
  return parsed;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  loadDotEnvIfPresent(resolve(process.cwd(), '.env'));
  const config = readSportmonksCaptureConfig(process.env);
  const cliArgs = parseSportmonksSeasonScopedCaptureArgs(args);
  const client = createSportmonksClient({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute
  });

  const result = await runSportmonksSeasonScopedCapture({
    captureRoot: config.captureRoot,
    client,
    ...(cliArgs.leagueIds.length === 0 ? {} : { leagueIds: cliArgs.leagueIds }),
    ...(cliArgs.seasonIds.length === 0 ? {} : { seasonIds: cliArgs.seasonIds }),
    ...(cliArgs.endpoints.length === 0 ? {} : { endpoints: cliArgs.endpoints }),
    ...(cliArgs.maxRequests === undefined ? {} : { maxRequests: cliArgs.maxRequests }),
    skipAlreadyCaptured: cliArgs.skipAlreadyCaptured,
    log: (message) => {
      console.log(message);
    }
  });

  console.log(JSON.stringify({
    provider: config.provider,
    captureRoot: config.captureRoot,
    filters: {
      leagueIds: cliArgs.leagueIds,
      seasonIds: cliArgs.seasonIds,
      endpoints: cliArgs.endpoints
    },
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

function parsePositiveIntegerList(value: string): number[] {
  return value.split(',')
    .map((item) => parsePositiveInteger(item))
    .filter((item): item is number => item !== undefined);
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function dedupePositiveIds(ids: number[]): number[] {
  const seen = new Set<number>();
  const output: number[] = [];
  for (const id of ids) {
    if (Number.isInteger(id) && id > 0 && !seen.has(id)) {
      seen.add(id);
      output.push(id);
    }
  }
  return output;
}

function dedupeEndpoints(endpoints: SportmonksSeasonScopedEndpointKey[]): SportmonksSeasonScopedEndpointKey[] {
  const seen = new Set<SportmonksSeasonScopedEndpointKey>();
  const output: SportmonksSeasonScopedEndpointKey[] = [];
  for (const endpoint of endpoints) {
    if (!seen.has(endpoint)) {
      seen.add(endpoint);
      output.push(endpoint);
    }
  }
  return output;
}

function isSeasonScopedEndpoint(value: string): value is SportmonksSeasonScopedEndpointKey {
  return VALID_ENDPOINTS.has(value as SportmonksSeasonScopedEndpointKey);
}
