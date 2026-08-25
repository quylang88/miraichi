import { isAbsolute, relative, resolve, sep } from 'node:path';
import {
  runApiFootballIngestionJob,
  type ApiFootballIngestionRunResult
} from '../apps/worker/src/jobs/api-football-ingestion-job.js';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry
} from '../packages/config/src/index.js';
import { ApiFootballUsageLedger } from '../apps/worker/src/sources/api-football/api-football-usage-ledger.js';
import { ApiFootballClient } from '../apps/worker/src/sources/api-football/api-football-client.js';

// Auto-load .env if available
try {
  if (typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    (process as unknown as { loadEnvFile: () => void }).loadEnvFile();
  }
} catch {
  // Ignore if .env is missing
}

export type IngestionCliMode = 'daily_sync' | 'window_poll' | 'auto';

const VALID_MODES: ReadonlySet<string> = new Set<IngestionCliMode>([
  'daily_sync',
  'window_poll',
  'auto'
]);

export interface ParsedCaptureArgs {
  mode?: IngestionCliMode | undefined;
  date?: string | undefined;
  dataRoot: string;
}

export interface CaptureCliOptions {
  args?: string[] | undefined;
  apiKey?: string | undefined;
  registry?: readonly ApiFootballCompetitionEntry[] | undefined;
  client?: ApiFootballClient | undefined;
  cwd?: string | undefined;
  logFn?: ((message: string) => void) | undefined;
  now?: (() => Date) | undefined;
}

export function parseCaptureArgs(args: string[], cwd: string = process.cwd()): ParsedCaptureArgs {
  let mode: IngestionCliMode | undefined;
  let date: string | undefined;
  const workspaceRoot = resolve(cwd);
  let dataRoot = resolve(workspaceRoot, 'apps/api/data');

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const val = arg.slice('--mode='.length).trim();
      if (!VALID_MODES.has(val as IngestionCliMode)) {
        throw new Error(`invalid --mode option: ${val}`);
      }
      mode = val as IngestionCliMode;
    } else if (arg.startsWith('--date=')) {
      const val = arg.slice('--date='.length).trim();
      if (!isCalendarDate(val)) {
        throw new Error(`invalid --date option: ${val}`);
      }
      date = val;
    } else if (arg.startsWith('--data-root=')) {
      const val = arg.slice('--data-root='.length).trim();
      if (!val || !isAbsolute(val)) {
        throw new Error(`--data-root must be an absolute path: ${val}`);
      }
      const normalizedDataRoot = resolve(val);
      const relativePath = relative(workspaceRoot, normalizedDataRoot);
      const isContainedChild = relativePath !== '' &&
        relativePath !== '..' &&
        !relativePath.startsWith(`..${sep}`) &&
        !isAbsolute(relativePath);
      if (!isContainedChild) {
        throw new Error(`--data-root must be a contained child path of ${workspaceRoot}: ${val}`);
      }
      dataRoot = normalizedDataRoot;
    } else {
      throw new Error(`unknown argument: ${arg}`);
    }
  }

  return { mode, date, dataRoot };
}

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(Date.UTC(year!, month! - 1, day!));
  return parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month! - 1 &&
    parsed.getUTCDate() === day;
}

export async function runCaptureApiFootballCli(
  options: CaptureCliOptions = {}
): Promise<ApiFootballIngestionRunResult> {
  const log = options.logFn || console.log;
  const parsed = parseCaptureArgs(options.args || process.argv.slice(2), options.cwd);
  const apiKey = (options.apiKey !== undefined ? options.apiKey : process.env.API_FOOTBALL_KEY)?.trim();

  if (!apiKey) {
    throw new Error('Missing API_FOOTBALL_KEY environment variable. Configure API_FOOTBALL_KEY in .env before running.');
  }

  const effectiveDataRoot = parsed.dataRoot;
  const registry = options.registry || API_FOOTBALL_COMPETITION_REGISTRY;
  const ledger = options.client?.ledger || new ApiFootballUsageLedger({ dataRoot: effectiveDataRoot });
  const client = options.client || new ApiFootballClient({
    apiKey,
    ledger,
    dataRoot: effectiveDataRoot,
    ...(options.now ? { now: options.now } : {})
  });

  const initialQuota = await ledger.getState(options.now ? options.now() : undefined);

  log(`=======================================================`);
  log(`⚽ API-FOOTBALL INGESTION (${parsed.mode || 'auto'})`);
  log(`=======================================================`);
  log(`- API Key: Configured`);
  log(`- Quota used today: ${initialQuota.dailyUsage.reserved}/${initialQuota.dailyUsage.limit}`);
  if (parsed.date) log(`- Target date: ${parsed.date}`);
  log(`-------------------------------------------------------`);

  const result = await runApiFootballIngestionJob({
    dataRoot: effectiveDataRoot,
    mode: parsed.mode || 'auto',
    ...(parsed.date ? { date: parsed.date } : {}),
    registry,
    client,
    ...(options.now ? { now: options.now } : {})
  });

  const finalQuota = await ledger.getState(options.now ? options.now() : undefined);

  log(`\n=======================================================`);
  log(`📊 INGESTION RESULT:`);
  log(`=======================================================`);
  log(`- Status: ${result.status}`);
  log(`- Mode: ${result.mode}`);
  log(`- Run ID: ${result.runId}`);
  log(`- Matches processed: ${result.matchesProcessed}`);
  log(`- Matches completed (FT): ${result.matchesCompleted}`);
  log(`- Quota used today: ${finalQuota.dailyUsage.reserved}/${finalQuota.dailyUsage.limit}`);

  if (result.concludingWindows && result.concludingWindows.length > 0) {
    log(`- Active concluding windows: ${result.concludingWindows.length} matches`);
  }

  if (result.error) {
    log(`- Error: ${result.error}`);
  }

  return result;
}

// Direct invocation check
if (process.argv[1] && (
  process.argv[1].endsWith('capture-api-football.ts') ||
  process.argv[1].endsWith('capture-api-football.js')
)) {
  runCaptureApiFootballCli().catch((err) => {
    console.error('\nIngestion failed with error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
