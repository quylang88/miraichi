import {
  access,
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  unlink,
  writeFile
} from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ServingMatchStoreRepository } from '../apps/api/src/repositories/serving-match-store-repository.js';
import {
  readServingMatchStoreManifest,
  readServingMatchStoreSnapshot
} from '../apps/api/src/repositories/serving-match-store.js';
import { SportScoreSourceLedger } from '../apps/worker/src/sources/sportscore/sportscore-source-ledger.js';
import { readCanonicalWarehouseRun } from './providers/shared/canonical-warehouse.js';
import { verifySportScoreOpenApiContract } from './sportscore-contract-drift.js';

const SMOKE_ROOT_SCHEMA_VERSION = 'miraichi.sportscore-smoke-root.v1' as const;
const SMOKE_ROOT_MARKER = '.miraichi-sportscore-smoke-root.json';
const TERMS_URL = 'https://sportscore.com/developers/terms/' as const;
const OPENAPI_URL = 'https://sportscore.com/developers/openapi.yaml' as const;
export const SPORTSCORE_ACTIVE_ROOT_CONFIRMATION = 'BOOTSTRAP_SPORTSCORE_ACTIVE_ROOT' as const;

interface SmokeRootMarker {
  schemaVersion: typeof SMOKE_ROOT_SCHEMA_VERSION;
  createdAt: string;
  realNetworkAuthorized: false;
}

function getWorkspaceRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function defaultActiveDataRoot(): string {
  return path.join(getWorkspaceRoot(), 'apps', 'api', 'data');
}

function assertNarrowDataRoot(value: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} must be a non-empty path.`);
  }
  const resolved = path.resolve(value);
  const volumeRoot = path.parse(resolved).root;
  const depth = path.relative(volumeRoot, resolved).split(path.sep).filter(Boolean).length;
  if (resolved === volumeRoot || resolved === getWorkspaceRoot() || depth < 2) {
    throw new Error(`${label} must not be a filesystem or workspace root.`);
  }
  return resolved;
}

function rootsOverlap(left: string, right: string): boolean {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  const isContained = (relative: string) => (
    relative === ''
    || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
  );
  return isContained(leftToRight) || isContained(rightToLeft);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readSmokeRootMarker(dataRoot: string): Promise<SmokeRootMarker> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(path.join(dataRoot, SMOKE_ROOT_MARKER), 'utf8'));
  } catch {
    throw new Error('Source root is not a prepared SportScore isolated smoke root.');
  }
  if (
    typeof parsed !== 'object'
    || parsed === null
    || Array.isArray(parsed)
    || (parsed as Partial<SmokeRootMarker>).schemaVersion !== SMOKE_ROOT_SCHEMA_VERSION
    || typeof (parsed as Partial<SmokeRootMarker>).createdAt !== 'string'
    || Number.isNaN(Date.parse((parsed as Partial<SmokeRootMarker>).createdAt ?? ''))
    || (parsed as Partial<SmokeRootMarker>).realNetworkAuthorized !== false
  ) {
    throw new Error('SportScore isolated smoke root marker is invalid.');
  }
  return parsed as SmokeRootMarker;
}

export async function assertPreparedSportScoreSmokeRoot(options: {
  dataRoot: string;
  activeDataRoot?: string;
}): Promise<string> {
  const dataRoot = assertNarrowDataRoot(options.dataRoot, 'SportScore smoke data root');
  const activeDataRoot = assertNarrowDataRoot(
    options.activeDataRoot ?? defaultActiveDataRoot(),
    'SportScore active data root'
  );
  if (rootsOverlap(dataRoot, activeDataRoot)) {
    throw new Error('SportScore smoke root must be isolated from the active data root.');
  }
  await readSmokeRootMarker(dataRoot);
  return dataRoot;
}

export async function inspectSportScoreSourceReview(): Promise<{
  termsScope: 'blocked';
  realNetworkAuthorized: false;
  termsUrl: typeof TERMS_URL;
  openApiUrl: typeof OPENAPI_URL;
  approvedFixtureReviewedAt: string;
  approvedFixtureSha256: string;
}> {
  const contract = await verifySportScoreOpenApiContract();
  return {
    termsScope: 'blocked',
    realNetworkAuthorized: false,
    termsUrl: TERMS_URL,
    openApiUrl: OPENAPI_URL,
    approvedFixtureReviewedAt: contract.reviewedAt,
    approvedFixtureSha256: contract.sha256
  };
}

export async function prepareSportScoreSmokeRoot(options: {
  dataRoot: string;
  activeDataRoot?: string;
  now?: () => Date;
}): Promise<{
  dataRoot: string;
  markerPath: string;
  realNetworkAuthorized: false;
}> {
  const dataRoot = assertNarrowDataRoot(options.dataRoot, 'SportScore smoke data root');
  const activeDataRoot = assertNarrowDataRoot(
    options.activeDataRoot ?? defaultActiveDataRoot(),
    'SportScore active data root'
  );
  if (rootsOverlap(dataRoot, activeDataRoot)) {
    throw new Error('SportScore smoke root must be isolated from the active data root.');
  }
  await mkdir(dataRoot, { recursive: true });
  const entries = await readdir(dataRoot);
  if (entries.length > 0) {
    throw new Error('SportScore smoke data root must be empty before preparation.');
  }
  const observedAt = (options.now ?? (() => new Date()))();
  if (Number.isNaN(observedAt.valueOf())) {
    throw new Error('SportScore smoke root timestamp is invalid.');
  }
  const markerPath = path.join(dataRoot, SMOKE_ROOT_MARKER);
  const marker: SmokeRootMarker = {
    schemaVersion: SMOKE_ROOT_SCHEMA_VERSION,
    createdAt: observedAt.toISOString(),
    realNetworkAuthorized: false
  };
  await writeFile(markerPath, `${JSON.stringify(marker, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  await Promise.all([
    mkdir(path.join(dataRoot, 'providers', 'sportscore', 'state'), { recursive: true }),
    mkdir(path.join(dataRoot, 'warehouse', 'versions'), { recursive: true }),
    mkdir(path.join(dataRoot, 'serving', 'versions'), { recursive: true }),
    mkdir(path.join(dataRoot, 'match-details'), { recursive: true }),
    mkdir(path.join(dataRoot, 'match-detail-refresh'), { recursive: true })
  ]);
  return { dataRoot, markerPath, realNetworkAuthorized: false };
}

export async function inspectSportScoreRuntimeStatus(options: {
  dataRoot: string;
  now?: () => Date;
}): Promise<{
  dataRoot: string;
  serving: { freshness: 'fresh' | 'stale' | 'missing'; matchCount: number; snapshotId: string };
  ledger: {
    revision: number;
    dailyCompleted: number;
    dailyDeferred: number;
    terminalPending: number;
    terminalCompleted: number;
    terminalExhausted: number;
  };
}> {
  const dataRoot = assertNarrowDataRoot(options.dataRoot, 'SportScore status data root');
  const now = options.now ?? (() => new Date());
  const repository = new ServingMatchStoreRepository({
    servingRoot: path.join(dataRoot, 'serving'),
    now
  });
  const [serving, ledger] = await Promise.all([
    repository.getStatus(),
    new SportScoreSourceLedger({ dataRoot, now }).getState()
  ]);
  const dailyCheckpoints = Object.values(ledger.daily);
  const terminalCheckpoints = Object.values(ledger.terminalWindows);
  return {
    dataRoot,
    serving: {
      freshness: serving.freshness,
      matchCount: serving.matchCount,
      snapshotId: serving.snapshotId
    },
    ledger: {
      revision: ledger.revision,
      dailyCompleted: dailyCheckpoints.filter((item) => item.completedAt !== undefined).length,
      dailyDeferred: dailyCheckpoints.filter((item) => (
        item.completedAt === undefined && item.nextAttemptAt !== undefined
      )).length,
      terminalPending: Object.keys(ledger.terminalSchedules).length,
      terminalCompleted: terminalCheckpoints.filter((item) => item.terminalAt !== undefined).length,
      terminalExhausted: terminalCheckpoints.filter((item) => item.exhaustedAt !== undefined).length
    }
  };
}

async function copyDirectoryExclusive(source: string, destination: string): Promise<void> {
  if (await exists(destination)) {
    throw new Error(`Bootstrap destination already exists: ${destination}`);
  }
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { recursive: true, errorOnExist: true, force: false });
}

export async function bootstrapSportScoreActiveRoot(options: {
  fromDataRoot: string;
  toDataRoot: string;
  confirmation: string;
}): Promise<{
  sourceSnapshotId: string;
  sourceWarehouseRunId: string;
  sourceServingVersion: string;
  matchCount: number;
  targetDataRoot: string;
}> {
  if (options.confirmation !== SPORTSCORE_ACTIVE_ROOT_CONFIRMATION) {
    throw new Error(`Active-root bootstrap requires confirmation ${SPORTSCORE_ACTIVE_ROOT_CONFIRMATION}.`);
  }
  const fromDataRoot = assertNarrowDataRoot(options.fromDataRoot, 'SportScore bootstrap source root');
  const toDataRoot = assertNarrowDataRoot(options.toDataRoot, 'SportScore bootstrap target root');
  if (rootsOverlap(fromDataRoot, toDataRoot)) {
    throw new Error('SportScore bootstrap source and target roots must be isolated from each other.');
  }
  await readSmokeRootMarker(fromDataRoot);
  const targetManifestPath = path.join(toDataRoot, 'serving', 'manifest.json');
  if (await exists(targetManifestPath)) {
    throw new Error('Target active root already has a serving manifest; bootstrap will not overwrite it.');
  }
  const sourceServingRoot = path.join(fromDataRoot, 'serving');
  const manifest = await readServingMatchStoreManifest(sourceServingRoot);
  const snapshot = await readServingMatchStoreSnapshot(sourceServingRoot);
  if (snapshot.matches.length === 0 || !snapshot.sources.some((source) => source.sourceId === 'sportscore')) {
    throw new Error('Isolated root has no validated SportScore serving snapshot to bootstrap.');
  }
  if (!manifest.warehouseRunId) {
    throw new Error('Isolated SportScore serving manifest does not reference a warehouse run.');
  }
  await readCanonicalWarehouseRun(fromDataRoot, manifest.warehouseRunId);

  const sourceWarehouseVersion = path.join(
    fromDataRoot,
    'warehouse',
    'versions',
    manifest.warehouseRunId
  );
  const targetWarehouseVersion = path.join(
    toDataRoot,
    'warehouse',
    'versions',
    manifest.warehouseRunId
  );
  const sourceServingVersion = path.join(sourceServingRoot, 'versions', manifest.currentVersion);
  const targetServingVersion = path.join(
    toDataRoot,
    'serving',
    'versions',
    manifest.currentVersion
  );
  const sourceLedger = path.join(
    fromDataRoot,
    'providers',
    'sportscore',
    'state',
    'source-ledger.json'
  );
  const targetLedger = path.join(
    toDataRoot,
    'providers',
    'sportscore',
    'state',
    'source-ledger.json'
  );
  const sourceLedgerExists = await exists(sourceLedger);
  if (sourceLedgerExists) {
    await new SportScoreSourceLedger({ dataRoot: fromDataRoot }).getState();
  }
  const conflictingTargets = [targetWarehouseVersion, targetServingVersion];
  if (sourceLedgerExists) conflictingTargets.push(targetLedger);
  for (const target of conflictingTargets) {
    if (await exists(target)) {
      throw new Error(`Bootstrap destination already exists: ${target}`);
    }
  }

  await copyDirectoryExclusive(sourceWarehouseVersion, targetWarehouseVersion);
  await copyDirectoryExclusive(sourceServingVersion, targetServingVersion);
  if (sourceLedgerExists) {
    await mkdir(path.dirname(targetLedger), { recursive: true });
    await copyFile(sourceLedger, targetLedger, constants.COPYFILE_EXCL);
  }

  await mkdir(path.dirname(targetManifestPath), { recursive: true });
  const temporaryManifest = `${targetManifestPath}.bootstrap-${process.pid}`;
  try {
    await writeFile(temporaryManifest, await readFile(path.join(sourceServingRoot, 'manifest.json')), {
      flag: 'wx'
    });
    await copyFile(temporaryManifest, targetManifestPath, constants.COPYFILE_EXCL);
  } finally {
    await unlink(temporaryManifest).catch(() => undefined);
  }
  return {
    sourceSnapshotId: snapshot.snapshotId,
    sourceWarehouseRunId: manifest.warehouseRunId,
    sourceServingVersion: manifest.currentVersion,
    matchCount: snapshot.matches.length,
    targetDataRoot: toDataRoot
  };
}

function readArgValue(args: readonly string[], name: string): string | undefined {
  const prefix = `${name}=`;
  const direct = args.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function requireArg(args: readonly string[], name: string): string {
  const value = readArgValue(args, name);
  if (!value) throw new Error(`Missing required argument ${name}.`);
  return value;
}

async function main(args = process.argv.slice(2)): Promise<void> {
  const command = args[0];
  let result: unknown;
  if (command === 'review-source') {
    result = await inspectSportScoreSourceReview();
  } else if (command === 'status') {
    result = await inspectSportScoreRuntimeStatus({
      dataRoot: readArgValue(args, '--data-root') ?? defaultActiveDataRoot()
    });
  } else if (command === 'prepare-smoke-root') {
    result = await prepareSportScoreSmokeRoot({
      dataRoot: requireArg(args, '--data-root')
    });
  } else if (command === 'bootstrap-active-root') {
    result = await bootstrapSportScoreActiveRoot({
      fromDataRoot: requireArg(args, '--from-data-root'),
      toDataRoot: requireArg(args, '--to-data-root'),
      confirmation: requireArg(args, '--confirm')
    });
  } else {
    throw new Error('Command must be review-source, status, prepare-smoke-root, or bootstrap-active-root.');
  }
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
