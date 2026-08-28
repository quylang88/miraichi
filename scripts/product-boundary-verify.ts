import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_PRODUCT_PATHS = [
  'apps/local-ai',
  'scripts/providers/sportmonks',
  'apps/api/data/providers/sportmonks',
  'apps/worker/src/sources/api-football',
  'apps/api/data/api-football',
  'apps/worker/src/jobs/api-football-hydration-job.ts',
  'apps/worker/src/jobs/api-football-hydration-job.test.ts',
  'apps/worker/src/jobs/api-football-ingestion-job.ts',
  'apps/worker/src/jobs/api-football-ingestion-job.test.ts',
  'apps/worker/src/jobs/api-football-match-detail-job.ts',
  'apps/worker/src/jobs/api-football-match-detail-job.test.ts',
  'packages/config/src/api-football-source-registry.ts',
  'packages/config/src/api-football-source-registry.test.ts',
  'scripts/capture-api-football.ts',
  'scripts/capture-api-football.test.ts',
  'scripts/quota-status-api-football.ts',
  'scripts/seed-api-football-history.ts',
  'scripts/seed-api-football-history.test.ts',
  'tests/integration/api-football-rapid-match-source.test.ts',
  'tests/integration/api-football-quota-resume.test.ts',
  'tests/integration/api-football-match-detail.test.ts',
  'scripts/sportscore-local-sync.ts',
  'scripts/sportscore-local-runtime.ts',
  'apps/worker/src/jobs/sportscore-hydration-job.ts',
  'apps/worker/src/sources/sportscore/sportscore-hydration-plan.ts',
  'apps/worker/src/sources/sportscore/sportscore-hydration-ledger.ts'
] as const;

const FORBIDDEN_SCRIPT = /(^dev:local-ai$|^phase4:|^phase8:|^sportscore:local:|sportmonks|api-football)/i;
const FORBIDDEN_API_ROUTE = /\/api\/v1\/(predictions|chat|mock\/predict|mock\/explain)/g;
const EXPECTED_NAVIGATION_TABS = ['today', 'matches', 'bets', 'bankroll'] as const;
const RETIRED_PROVIDER_MARKER = /api[-_ ]football|apifootball/i;
const RETIRED_PROVIDER_SCAN_ROOTS = ['apps', 'packages', 'scripts'] as const;
const RETIRED_PROVIDER_SCAN_EXTENSIONS = new Set(['.ts', '.js', '.json', '.md', '.yaml', '.yml']);
const RETIRED_PROVIDER_SCAN_EXCLUSIONS = new Set([
  'scripts/product-boundary-verify.ts',
  'scripts/product-boundary-verify.test.ts'
]);
const SKIPPED_SCAN_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'data']);
const FORBIDDEN_WEB_RUNTIME_URLS = [
  /https?:\/\/raw\.githubusercontent\.com\/[^\s"'`]+/gi,
  /https?:\/\/github\.com\/openfootball(?:\/[^\s"'`]*)?/gi,
  /https?:\/\/[^\s"'`]*openfootball[^\s"'`]*/gi
] as const;

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readRequiredFile(rootDir: string, relativePath: string, errors: string[]): Promise<string> {
  try {
    return await readFile(path.join(rootDir, relativePath), 'utf8');
  } catch {
    errors.push(`Required boundary file is missing: ${relativePath}`);
    return '';
  }
}

function readNavigationTabIds(source: string): string[] | null {
  const assignment = source.match(/PRODUCTION_NAVIGATION_TAB_IDS\s*=\s*Object\.freeze\(\s*\[([\s\S]*?)\]\s*as const\s*\)/);
  if (!assignment?.[1]) return null;
  return [...assignment[1].matchAll(/['"]([^'"]+)['"]/g)].map((match) => match[1]!);
}

async function listFiles(rootDir: string): Promise<string[]> {
  const entries = await readdir(rootDir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_SCAN_DIRECTORIES.has(entry.name) ? [] : listFiles(entryPath);
    }
    return [entryPath];
  }));
  return files.flat();
}

async function reportRetiredProviderMarkers(rootDir: string, errors: string[]): Promise<void> {
  const scanTargets: string[] = [];
  for (const relativeRoot of RETIRED_PROVIDER_SCAN_ROOTS) {
    const absoluteRoot = path.join(rootDir, relativeRoot);
    if (await exists(absoluteRoot)) {
      scanTargets.push(...await listFiles(absoluteRoot));
    }
  }

  const envExample = path.join(rootDir, '.env.example');
  if (await exists(envExample)) {
    scanTargets.push(envExample);
  }

  for (const filePath of scanTargets) {
    const relativePath = path.relative(rootDir, filePath).replaceAll('\\', '/');
    if (
      RETIRED_PROVIDER_SCAN_EXCLUSIONS.has(relativePath) ||
      (relativePath !== '.env.example' && !RETIRED_PROVIDER_SCAN_EXTENSIONS.has(path.extname(filePath)))
    ) {
      continue;
    }
    const source = await readFile(filePath, 'utf8');
    if (RETIRED_PROVIDER_MARKER.test(source)) {
      errors.push(`Forbidden retired provider marker in ${relativePath}`);
    }
  }
}

export async function auditProductBoundary(rootDir: string): Promise<string[]> {
  const errors: string[] = [];

  for (const relativePath of FORBIDDEN_PRODUCT_PATHS) {
    if (await exists(path.join(rootDir, relativePath))) {
      errors.push(`Forbidden path exists: ${relativePath}`);
    }
  }

  const packageSource = await readRequiredFile(rootDir, 'package.json', errors);
  if (packageSource) {
    try {
      const packageJson = JSON.parse(packageSource) as { scripts?: Record<string, unknown> };
      for (const scriptName of Object.keys(packageJson.scripts ?? {})) {
        if (FORBIDDEN_SCRIPT.test(scriptName)) {
          errors.push(`Forbidden package script: ${scriptName}`);
        }
      }
    } catch {
      errors.push('Invalid JSON: package.json');
    }
  }

  const apiSource = await readRequiredFile(rootDir, 'apps/api/src/index.ts', errors);
  for (const match of apiSource.matchAll(FORBIDDEN_API_ROUTE)) {
    errors.push(`Forbidden API route: ${match[0]}`);
  }

  const navigationSource = await readRequiredFile(rootDir, 'apps/web/src/config/navigation-tabs.ts', errors);
  const navigationTabIds = readNavigationTabIds(navigationSource);
  if (
    !navigationTabIds ||
    navigationTabIds.length !== EXPECTED_NAVIGATION_TABS.length ||
    navigationTabIds.some((tabId, index) => tabId !== EXPECTED_NAVIGATION_TABS[index])
  ) {
    errors.push(`Navigation tabs must be exactly: ${EXPECTED_NAVIGATION_TABS.join(', ')}`);
  }

  const webSourceRoot = path.join(rootDir, 'apps/web/src');
  if (await exists(webSourceRoot)) {
    for (const filePath of await listFiles(webSourceRoot)) {
      const source = await readFile(filePath, 'utf8');
      const urls = new Set(FORBIDDEN_WEB_RUNTIME_URLS.flatMap((pattern) => [...source.matchAll(pattern)].map((match) => match[0]!)));
      for (const url of urls) {
        errors.push(`Forbidden web runtime source URL in ${path.relative(rootDir, filePath).replaceAll('\\', '/')}: ${url}`);
      }
    }
  }

  await reportRetiredProviderMarkers(rootDir, errors);

  return errors;
}

async function main(): Promise<void> {
  const errors = await auditProductBoundary(process.cwd());
  if (errors.length > 0) {
    for (const error of errors) console.error(`[Product Boundary] ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log('[Product Boundary] PASSED');
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  await main();
}
