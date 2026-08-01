import { mkdir, appendFile, access, lstat, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '../../../packages/shared/src/index.js';

export type WarehouseCollection =
  | 'canonical-matches'
  | 'canonical-teams'
  | 'canonical-competitions'
  | 'match-provider-links'
  | 'match-events'
  | 'match-team-stats'
  | 'field-provenance'
  | 'conflicts';

export interface CanonicalWarehouseSnapshot {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
}

const SAFE_RUN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/u;

interface WarehouseFile<T> {
  fileName: string;
  records: readonly T[];
  key: (record: T) => string;
}

/**
 * Append a canonical record to the provider-neutral warehouse at:
 *   <root>/warehouse/<collection>.jsonl
 *
 * Each line is a compact JSON object. Provider-specific adapters may write to
 * it; the warehouse survives adapter replacement.
 */
export async function appendCanonicalWarehouseRecord(
  root: string,
  collection: WarehouseCollection,
  record: unknown
): Promise<void> {
  const dir = join(root, 'warehouse');
  await mkdir(dir, { recursive: true });
  const filePath = join(dir, `${collection}.jsonl`);
  await appendFile(filePath, JSON.stringify(record) + '\n', 'utf8');
}

/**
 * Creates one complete, immutable canonical snapshot under
 * `<root>/warehouse/versions/<runId>`. There is deliberately no warehouse
 * current pointer: only the serving manifest publishes an operational run.
 */
export async function writeCanonicalWarehouseRun(
  dataRoot: string,
  runId: string,
  snapshot: CanonicalWarehouseSnapshot
): Promise<string> {
  assertSafeRunId(runId);
  const versionsRoot = resolve(dataRoot, 'warehouse', 'versions');
  await mkdir(versionsRoot, { recursive: true });
  const verifiedVersionsRoot = await realpath(versionsRoot);
  const target = resolveContainedPath(verifiedVersionsRoot, runId);
  await assertRunDoesNotExist(target, runId);

  const staging = resolveContainedPath(verifiedVersionsRoot, `.tmp-${runId}-${process.pid}-${Date.now()}`);
  await mkdir(staging);
  try {
    const files: WarehouseFile<unknown>[] = [
      { fileName: 'canonical-matches.jsonl', records: snapshot.matches, key: (record) => (record as CanonicalMatch).matchId },
      { fileName: 'canonical-teams.jsonl', records: snapshot.teams, key: (record) => (record as CanonicalTeam).teamId },
      { fileName: 'canonical-competitions.jsonl', records: snapshot.competitions, key: (record) => (record as CanonicalCompetition).competitionId },
      { fileName: 'match-provider-links.jsonl', records: snapshot.links, key: (record) => {
        const link = record as ProviderLink;
        return [link.entityType, link.entityId, link.provider, link.providerEntityType, link.providerEntityId].join('|');
      } },
      { fileName: 'field-provenance.jsonl', records: snapshot.provenance, key: (record) => {
        const provenance = record as FieldProvenance;
        return [provenance.entityType, provenance.entityId, provenance.fieldPath, provenance.provider, provenance.providerEntityId].join('|');
      } }
    ];
    await Promise.all(files.map(async ({ fileName, records, key }) => {
      const content = [...records]
        .sort((left, right) => key(left).localeCompare(key(right)))
        .map((record) => JSON.stringify(record))
        .join('\n');
      await writeFile(join(staging, fileName), content === '' ? '' : `${content}\n`, 'utf8');
    }));
    await assertRunDoesNotExist(target, runId);
    await rename(staging, target);
    return join(dataRoot, 'warehouse', 'versions', runId);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

/** Resolves only an immutable run directory beneath the configured data root. */
export async function resolveCanonicalWarehouseRun(dataRoot: string, runId: string): Promise<string> {
  assertSafeRunId(runId);
  const versionsRoot = resolve(dataRoot, 'warehouse', 'versions');
  let verifiedVersionsRoot: string;
  try {
    verifiedVersionsRoot = await realpath(versionsRoot);
  } catch {
    throw new Error(`Canonical warehouse run does not exist: ${runId}`);
  }
  const target = resolveContainedPath(verifiedVersionsRoot, runId);
  let metadata: Awaited<ReturnType<typeof lstat>>;
  try {
    metadata = await lstat(target);
  } catch {
    throw new Error(`Canonical warehouse run does not exist: ${runId}`);
  }
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    throw new Error(`Canonical warehouse run must be a non-symlink directory: ${runId}`);
  }
  const verifiedTarget = await realpath(target);
  assertContainedPath(verifiedVersionsRoot, verifiedTarget);
  return join(dataRoot, 'warehouse', 'versions', runId);
}

function assertSafeRunId(runId: string): void {
  if (!SAFE_RUN_ID.test(runId)) {
    throw new Error('Canonical warehouse run ID must be a safe run ID');
  }
}

async function assertRunDoesNotExist(target: string, runId: string): Promise<void> {
  try {
    await access(target);
  } catch {
    return;
  }
  throw new Error(`Canonical warehouse run already exists: ${runId}`);
}

function resolveContainedPath(root: string, ...segments: string[]): string {
  const candidate = resolve(root, ...segments);
  assertContainedPath(root, candidate);
  return candidate;
}

function assertContainedPath(root: string, candidate: string): void {
  const relativePath = relative(root, candidate);
  if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) || relativePath.includes(':')) {
    throw new Error('Canonical warehouse run path escaped warehouse versions');
  }
}
