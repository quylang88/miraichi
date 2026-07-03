import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSportmonksClient } from './providers/sportmonks/client.js';
import { readSportmonksCaptureConfig } from './providers/sportmonks/config.js';
import { runSportmonksFixtureEnrichmentBatch } from './providers/sportmonks/fixture-enrichment-probe.js';

loadDotEnvIfPresent(resolve(process.cwd(), '.env'));

try {
  const config = readSportmonksCaptureConfig(process.env);
  const args = parseEnrichmentArgs(process.argv.slice(2));
  const client = createSportmonksClient({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute
  });

  const maxFixtures = args.fixtureIds.length > 0
    ? undefined
    : args.all
      ? undefined
      : args.maxFixtures;

  const report = await runSportmonksFixtureEnrichmentBatch({
    captureRoot: config.captureRoot,
    client,
    ...(args.fixtureIds.length === 0 ? {} : { fixtureIds: args.fixtureIds }),
    ...(maxFixtures === undefined ? {} : { maxFixtures }),
    skipAlreadyCaptured: args.skipAlreadyCaptured,
    log: (message) => console.log(message)
  });

  console.log(JSON.stringify({
    provider: config.provider,
    captureRoot: config.captureRoot,
    mode: args.all ? 'all' : args.fixtureIds.length > 0 ? 'fixture-ids' : 'limited',
    skipAlreadyCaptured: args.skipAlreadyCaptured,
    report: {
      sourceFixtureCount: report.sourceFixtureCount,
      alreadyCapturedCount: report.alreadyCapturedCount,
      selectedFixtureCount: report.selectedFixtureCount,
      attempted: report.attempted,
      captured: report.captured,
      unavailable: report.unavailable,
      failed: report.failed,
      stoppedEarlyReason: report.stoppedEarlyReason,
      fields: report.fields,
      localMatchReadiness: report.localMatchReadiness
    }
  }, null, 2));

  if (report.failed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseEnrichmentArgs(args: string[]): {
  all: boolean;
  fixtureIds: number[];
  maxFixtures: number;
  skipAlreadyCaptured: boolean;
} {
  const parsed = {
    all: false,
    fixtureIds: [] as number[],
    maxFixtures: 100,
    skipAlreadyCaptured: true
  };

  for (const arg of args) {
    if (arg === '--all') {
      parsed.all = true;
    } else if (arg === '--no-skip-captured') {
      parsed.skipAlreadyCaptured = false;
    } else if (arg.startsWith('--fixture-id=')) {
      const id = parsePositiveInteger(arg.slice('--fixture-id='.length));
      if (id !== undefined) {
        parsed.fixtureIds.push(id);
      }
    } else if (arg.startsWith('--max-fixtures=')) {
      parsed.maxFixtures = parsePositiveInteger(arg.slice('--max-fixtures='.length)) ?? parsed.maxFixtures;
    }
  }

  if (parsed.all && parsed.fixtureIds.length > 0) {
    throw new Error('Use either --all or --fixture-id=<id>, not both.');
  }

  return parsed;
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
