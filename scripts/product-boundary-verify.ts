import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FORBIDDEN_PRODUCT_PATHS = [
  'apps/local-ai',
  'scripts/providers/sportmonks',
  'apps/api/data/providers/sportmonks'
] as const;

const FORBIDDEN_SCRIPT = /(^dev:local-ai$|^phase4:|^phase8:|sportmonks)/i;
const FORBIDDEN_API_ROUTE = /\/api\/v1\/(predictions|chat|mock\/predict|mock\/explain)/g;
const EXPECTED_NAVIGATION_TABS = ['today', 'matches', 'bets', 'bankroll'] as const;
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
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
  }));
  return files.flat();
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
