import { isAbsolute, relative, resolve, sep } from 'node:path';
import { runApiFootballHydrationJob, type ApiFootballHydrationRunResult } from '../apps/worker/src/jobs/api-football-hydration-job.js';
import {
  API_FOOTBALL_COMPETITION_CATEGORIES,
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry,
  type CompetitionCategory
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

const VALID_CATEGORIES: ReadonlySet<string> = new Set<CompetitionCategory>(
  API_FOOTBALL_COMPETITION_CATEGORIES
);

export interface ParsedSeedHistoryArgs {
  limit?: number | undefined;
  competition?: string | undefined;
  category?: CompetitionCategory | undefined;
  season?: 'current' | 'previous' | 'older' | number | undefined;
  dataRoot: string;
}

export interface SeedHistoryCliOptions {
  args?: string[] | undefined;
  apiKey?: string | undefined;
  registry?: readonly ApiFootballCompetitionEntry[] | undefined;
  client?: ApiFootballClient | undefined;
  cwd?: string | undefined;
  logFn?: ((message: string) => void) | undefined;
}

export function parseSeedHistoryArgs(args: string[], cwd: string = process.cwd()): ParsedSeedHistoryArgs {
  let limit: number | undefined;
  let competition: string | undefined;
  let category: CompetitionCategory | undefined;
  let season: 'current' | 'previous' | 'older' | number | undefined;
  const workspaceRoot = resolve(cwd);
  let dataRoot = resolve(workspaceRoot, 'apps/api/data');

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      const val = arg.slice('--limit='.length).trim();
      const num = Number(val);
      if (!Number.isInteger(num) || num <= 0) {
        throw new Error(`limit must be a positive integer: ${arg}`);
      }
      limit = num;
    } else if (arg.startsWith('--competition=')) {
      const val = arg.slice('--competition='.length).trim();
      if (!val) {
        throw new Error(`competition must be a non-empty string: ${arg}`);
      }
      competition = val;
    } else if (arg.startsWith('--category=')) {
      const val = arg.slice('--category='.length).trim();
      if (!VALID_CATEGORIES.has(val as CompetitionCategory)) {
        throw new Error(`invalid --category option: ${val}`);
      }
      category = val as CompetitionCategory;
    } else if (arg.startsWith('--season=')) {
      const val = arg.slice('--season='.length).trim().toLowerCase();
      const isLayer = val === 'current' || val === 'previous' || val === 'older';
      const isYear = /^\d{4}$/u.test(val) && Number(val) >= 1900;
      if (!isLayer && !isYear) {
        throw new Error(`invalid --season option: ${val}`);
      }
      season = isYear ? Number(val) : val as 'current' | 'previous' | 'older';
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

  if (competition !== undefined && category !== undefined) {
    throw new Error('--competition and --category cannot be combined');
  }

  return { limit, competition, category, season, dataRoot };
}

export async function runSeedApiFootballHistoryCli(
  options: SeedHistoryCliOptions = {}
): Promise<ApiFootballHydrationRunResult> {
  const log = options.logFn || console.log;
  const parsed = parseSeedHistoryArgs(options.args || process.argv.slice(2), options.cwd);
  const apiKey = (options.apiKey || process.env.API_FOOTBALL_KEY)?.trim();

  if (!apiKey) {
    throw new Error('Missing API_FOOTBALL_KEY environment variable. Configure API_FOOTBALL_KEY in .env before running.');
  }

  const effectiveDataRoot = parsed.dataRoot;

  let filteredRegistry = options.registry || API_FOOTBALL_COMPETITION_REGISTRY;
  if (parsed.competition) {
    const compKey = parsed.competition;
    filteredRegistry = filteredRegistry.filter((c) => c.competitionId === compKey || String(c.providerLeagueId) === compKey);
    if (filteredRegistry.length === 0) {
      throw new Error(`No registered competition matches: --competition=${compKey}`);
    }
  } else if (parsed.category) {
    filteredRegistry = filteredRegistry.filter((c) => c.category === parsed.category);
    if (filteredRegistry.length === 0) {
      throw new Error(`No registered competition matches: --category=${parsed.category}`);
    }
  }

  const ledger = options.client?.ledger || new ApiFootballUsageLedger({ dataRoot: effectiveDataRoot });
  const client = options.client || new ApiFootballClient({ apiKey, ledger, dataRoot: effectiveDataRoot });

  const initialQuota = await ledger.getState();

  log(`=======================================================`);
  log(`⚽ API-FOOTBALL MULTI-SEASON HISTORICAL HYDRATION`);
  log(`=======================================================`);
  log(`- API Key: Configured`);
  log(`- Quota used today: ${initialQuota.dailyUsage.reserved}/${initialQuota.dailyUsage.limit}`);
  log(`- Total competitions registered: ${filteredRegistry.length}`);
  if (parsed.limit) log(`- Max batches per run limit: ${parsed.limit}`);
  if (parsed.season) log(`- Season layer filter: ${parsed.season}`);
  log(`-------------------------------------------------------`);

  const result = await runApiFootballHydrationJob({
    dataRoot: effectiveDataRoot,
    registry: filteredRegistry,
    client,
    ...(parsed.limit !== undefined ? { maxBatchesPerRun: parsed.limit } : {}),
    ...(parsed.season !== undefined ? { seasonLayer: parsed.season } : {})
  });

  const finalQuota = await ledger.getState();

  log(`\n=======================================================`);
  log(`📊 HYDRATION PROGRESS REPORT:`);
  log(`=======================================================`);
  log(`- Status: ${result.status}`);
  log(`- Run ID: ${result.runId}`);
  log(`- Completed targets: ${result.seasonsHydrated}`);
  log(`- Matches hydrated into Serving Store: ${result.matchesHydrated}`);
  log(`- Empty responses: ${result.emptyCount}`);
  log(`- Failed targets: ${result.failedCount}`);
  log(`- Pending selected targets: ${result.pendingCount}`);
  log(`- Quota used today: ${finalQuota.dailyUsage.reserved}/${finalQuota.dailyUsage.limit}`);

  if (result.pendingCount > 0 && result.status === 'partial') {
    log(`\n💡 NOTE: Progress saved to checkpoint (hydration-checkpoints.json).`);
    log(`👉 Re-run this command tomorrow when quota resets to continue hydrating remaining seasons.`);
  } else if (result.status === 'completed') {
    log(`\n🎉 ALL SELECTED HYDRATION TARGETS ARE COMPLETE!`);
  }

  return result;
}

// Direct invocation check
if (process.argv[1] && (
  process.argv[1].endsWith('seed-api-football-history.ts') ||
  process.argv[1].endsWith('seed-api-football-history.js')
)) {
  runSeedApiFootballHistoryCli().catch((err) => {
    console.error('\nHydration failed with error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
