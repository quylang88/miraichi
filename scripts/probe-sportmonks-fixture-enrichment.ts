import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSportmonksClient } from './providers/sportmonks/client.js';
import { readSportmonksCaptureConfig } from './providers/sportmonks/config.js';
import {
  extractFixtureIdsFromRawCapture,
  runSportmonksFixtureEnrichmentProbe,
  runSportmonksSubscriptionProbe
} from './providers/sportmonks/fixture-enrichment-probe.js';

loadDotEnvIfPresent(resolve(process.cwd(), '.env'));

try {
  const config = readSportmonksCaptureConfig(process.env);
  const args = parseProbeArgs(process.argv.slice(2));
  const footballClient = createSportmonksClient({
    apiBaseUrl: config.apiBaseUrl,
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute
  });
  const coreClient = createSportmonksClient({
    apiBaseUrl: toCoreApiBaseUrl(config.apiBaseUrl),
    apiToken: config.apiToken,
    maxRequestsPerMinute: config.maxRequestsPerMinute
  });

  const subscription = args.skipSubscription
    ? { captured: 0, unavailable: 0, failed: 0 }
    : await runSportmonksSubscriptionProbe({
        captureRoot: config.captureRoot,
        client: coreClient,
        log: (message) => console.log(message)
      });

  const fixtureIds = args.fixtureIds.length > 0
    ? args.fixtureIds
    : await extractFixtureIdsFromRawCapture(config.captureRoot, args.maxFixtures);

  if (fixtureIds.length === 0) {
    throw new Error('No fixture IDs found. Run data:capture:sportmonks for fixtures.all first, or pass --fixture-id=<id>.');
  }

  const report = await runSportmonksFixtureEnrichmentProbe({
    captureRoot: config.captureRoot,
    client: footballClient,
    fixtureIds,
    log: (message) => console.log(message)
  });

  console.log(JSON.stringify({
    provider: config.provider,
    captureRoot: config.captureRoot,
    subscription,
    fixtureIds,
    report: {
      fixtureCount: report.fixtureCount,
      captured: report.captured,
      unavailable: report.unavailable,
      failed: report.failed,
      fields: report.fields,
      localMatchReadiness: report.localMatchReadiness
    }
  }, null, 2));

  if (subscription.failed > 0 || report.failed > 0) {
    process.exitCode = 1;
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

function parseProbeArgs(args: string[]): {
  fixtureIds: number[];
  maxFixtures: number;
  skipSubscription: boolean;
} {
  const parsed = {
    fixtureIds: [] as number[],
    maxFixtures: 10,
    skipSubscription: false
  };

  for (const arg of args) {
    if (arg === '--skip-subscription') {
      parsed.skipSubscription = true;
    } else if (arg.startsWith('--fixture-id=')) {
      const id = parsePositiveInteger(arg.slice('--fixture-id='.length));
      if (id !== undefined) {
        parsed.fixtureIds.push(id);
      }
    } else if (arg.startsWith('--max-fixtures=')) {
      parsed.maxFixtures = parsePositiveInteger(arg.slice('--max-fixtures='.length)) ?? parsed.maxFixtures;
    }
  }

  return parsed;
}

function toCoreApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/football\/?$/, '');
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
