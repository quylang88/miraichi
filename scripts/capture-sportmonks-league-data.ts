import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createSportmonksClient } from './providers/sportmonks/client.js';
import { readSportmonksCaptureConfig } from './providers/sportmonks/config.js';
import { runSportmonksLeagueScopedCapture } from './providers/sportmonks/league-scoped-capture.js';
import type { SportmonksLeagueCaptureGroup } from './providers/sportmonks/league-capture-plan.js';

// ─── Public interfaces ────────────────────────────────────────────────────────

export interface SportmonksLeagueCaptureCliArgs {
  leagueId: number;
  seasonIds: number[];
  maxSeasons?: number;
  groups: SportmonksLeagueCaptureGroup[];
  maxRequests?: number;
  skipExisting: boolean;
}

// ─── Valid groups ─────────────────────────────────────────────────────────────

const VALID_GROUPS: ReadonlySet<SportmonksLeagueCaptureGroup> = new Set(['season', 'fixture', 'team', 'ai']);
const ALL_GROUPS: SportmonksLeagueCaptureGroup[] = ['season', 'fixture', 'team', 'ai'];

// ─── CLI argument parser ──────────────────────────────────────────────────────

export function parseSportmonksLeagueCaptureArgs(args: string[]): SportmonksLeagueCaptureCliArgs {
  let leagueId: number | undefined;
  const seasonIds: number[] = [];
  const groups: SportmonksLeagueCaptureGroup[] = [];
  let maxSeasons: number | undefined;
  let maxRequests: number | undefined;
  let skipExisting = true;

  for (const arg of args) {
    if (arg.startsWith('--league-id=')) {
      const raw = arg.slice('--league-id='.length);
      const parsed = parsePositiveInteger(raw);
      if (parsed === undefined) {
        throw new Error('--league-id must be a positive integer');
      }
      leagueId = parsed;
    } else if (arg.startsWith('--season-id=')) {
      const raw = arg.slice('--season-id='.length);
      const parsed = parsePositiveInteger(raw);
      if (parsed !== undefined) {
        seasonIds.push(parsed);
      }
    } else if (arg.startsWith('--max-seasons=')) {
      const raw = arg.slice('--max-seasons='.length);
      const parsed = parsePositiveInteger(raw);
      if (parsed === undefined) {
        throw new Error('--max-seasons must be a positive integer');
      }
      maxSeasons = parsed;
    } else if (arg.startsWith('--group=')) {
      const raw = arg.slice('--group='.length).trim();
      if (!VALID_GROUPS.has(raw as SportmonksLeagueCaptureGroup)) {
        throw new Error(`Invalid --group value: ${raw}`);
      }
      groups.push(raw as SportmonksLeagueCaptureGroup);
    } else if (arg.startsWith('--max-requests=')) {
      const raw = arg.slice('--max-requests='.length);
      const parsed = parsePositiveInteger(raw);
      if (parsed === undefined) {
        throw new Error('--max-requests must be a positive integer');
      }
      maxRequests = parsed;
    } else if (arg === '--no-skip-existing') {
      skipExisting = false;
    } else {
      throw new Error(`Unsupported Sportmonks league capture argument: ${arg}`);
    }
  }

  if (leagueId === undefined) {
    throw new Error('--league-id is required');
  }

  const result: SportmonksLeagueCaptureCliArgs = {
    leagueId,
    seasonIds: deduplicatePreservingOrder(seasonIds),
    groups: groups.length > 0 ? deduplicatePreservingOrder(groups) : [...ALL_GROUPS],
    skipExisting
  };

  if (maxSeasons !== undefined) result.maxSeasons = maxSeasons;
  if (maxRequests !== undefined) result.maxRequests = maxRequests;

  return result;
}

// ─── Main entry point ─────────────────────────────────────────────────────────

export async function main(args = process.argv.slice(2)): Promise<void> {
  loadDotEnvIfPresent(resolve(process.cwd(), '.env'));
  const config = readSportmonksCaptureConfig(process.env);
  const cliArgs = parseSportmonksLeagueCaptureArgs(args);
  const client = createSportmonksClient({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute,
    log: (message) => console.log(message)
  });

  const result = await runSportmonksLeagueScopedCapture({
    captureRoot: config.captureRoot,
    client,
    leagueId: cliArgs.leagueId,
    ...(cliArgs.seasonIds.length > 0 ? { seasonIds: cliArgs.seasonIds } : {}),
    ...(cliArgs.maxSeasons !== undefined ? { maxSeasons: cliArgs.maxSeasons } : {}),
    groups: cliArgs.groups,
    ...(cliArgs.maxRequests !== undefined ? { maxRequests: cliArgs.maxRequests } : {}),
    skipExisting: cliArgs.skipExisting,
    log: (message) => {
      console.log(message);
    }
  });

  console.log(JSON.stringify(result, null, 2));

  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

// ─── Module execution guard ───────────────────────────────────────────────────

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function loadDotEnvIfPresent(filePath: string): void {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line === '' || line.startsWith('#')) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (match === null) continue;
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
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function parsePositiveInteger(value: string | undefined): number | undefined {
  if (value === undefined || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function deduplicatePreservingOrder<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const result: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}
