import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  buildServingMatchStore,
  buildServingMatchesFromWarehouse,
  readServingMatchStoreSnapshot,
  type BuildServingMatchStoreResult
} from '../apps/api/src/repositories/serving-match-store.js';
import { resolveCanonicalWarehouseRun } from './providers/shared/canonical-warehouse.js';

export interface BuildServingMatchStoreCommandOptions {
  dataRoot?: string;
  warehouseRoot?: string;
  warehouseRunId?: string;
  servingRoot?: string;
  version?: string;
  now?: () => Date;
  log?: (message: string) => void;
}

export async function runBuildServingMatchStoreFromWarehouse(
  options: BuildServingMatchStoreCommandOptions = {}
): Promise<BuildServingMatchStoreResult> {
  const now = options.now ?? (() => new Date());
  const generatedAt = now().toISOString();
  const dataRoot = options.dataRoot ?? path.resolve(findWorkspaceRoot(), 'apps/api/data');
  if (options.warehouseRunId !== undefined && options.warehouseRoot !== undefined) {
    throw new Error('Specify either warehouseRunId or warehouseRoot, not both');
  }
  const warehouseRoot = options.warehouseRunId === undefined
    ? options.warehouseRoot ?? path.join(dataRoot, 'warehouse')
    : await resolveCanonicalWarehouseRun(dataRoot, options.warehouseRunId);
  const servingRoot = options.servingRoot ?? path.join(dataRoot, 'serving');
  const version = options.version ?? generatedAt.replace(/[:.]/g, '-');
  const servingMatches = await buildServingMatchesFromWarehouse({
    warehouseRoot,
    importedAt: generatedAt
  });
  const result = await buildServingMatchStore({
    servingRoot,
    version,
    snapshotId: `serving-${version}`,
    generatedAt,
    importedAt: generatedAt,
    sources: servingMatches.sources,
    matches: servingMatches.matches,
    scope: 'configured-competitions',
    ...(options.warehouseRunId === undefined ? {} : { warehouseRunId: options.warehouseRunId })
  });
  (options.log ?? console.log)(`Built serving match store ${result.version}: ${result.matchCount} matches -> ${servingRoot}`);
  return result;
}

export async function runValidateServingMatchStore(
  options: Pick<BuildServingMatchStoreCommandOptions, 'dataRoot' | 'servingRoot' | 'log'> = {}
): Promise<{ snapshotId: string; matchCount: number }> {
  const dataRoot = options.dataRoot ?? path.resolve(findWorkspaceRoot(), 'apps/api/data');
  const servingRoot = options.servingRoot ?? path.join(dataRoot, 'serving');
  const snapshot = await readServingMatchStoreSnapshot(servingRoot);
  const result = {
    snapshotId: snapshot.snapshotId,
    matchCount: snapshot.matches.length
  };
  (options.log ?? console.log)(`Validated serving match store ${result.snapshotId}: ${result.matchCount} matches -> ${servingRoot}`);
  return result;
}

function findWorkspaceRoot(): string {
  return process.cwd().includes(`${path.sep}scripts`)
    ? path.resolve(process.cwd(), '..')
    : process.cwd();
}

function readArgValue(args: string[], key: string): string | undefined {
  const prefix = `${key}=`;
  const direct = args.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = args.indexOf(key);
  if (index >= 0) return args[index + 1];
  return undefined;
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const dataRoot = readArgValue(args, '--data-root');
  const warehouseRoot = readArgValue(args, '--warehouse-root');
  const warehouseRunId = readArgValue(args, '--warehouse-run');
  const servingRoot = readArgValue(args, '--serving-root');
  const version = readArgValue(args, '--version');
  const validateOnly = args.includes('--validate-only');

  if (validateOnly) {
    const validateOptions: Pick<BuildServingMatchStoreCommandOptions, 'dataRoot' | 'servingRoot'> = {};
    if (dataRoot !== undefined) validateOptions.dataRoot = dataRoot;
    if (servingRoot !== undefined) validateOptions.servingRoot = servingRoot;
    await runValidateServingMatchStore(validateOptions);
    return;
  }

  const buildOptions: BuildServingMatchStoreCommandOptions = {};
  if (dataRoot !== undefined) buildOptions.dataRoot = dataRoot;
  if (warehouseRoot !== undefined) buildOptions.warehouseRoot = warehouseRoot;
  if (warehouseRunId !== undefined) buildOptions.warehouseRunId = warehouseRunId;
  if (servingRoot !== undefined) buildOptions.servingRoot = servingRoot;
  if (version !== undefined) buildOptions.version = version;
  await runBuildServingMatchStoreFromWarehouse(buildOptions);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
