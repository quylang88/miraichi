import { mkdir, appendFile, access, lstat, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import {
  validateCanonicalMatch,
  validateFieldProvenance,
  validateProviderLink,
  type ValidationResult,
  type CanonicalCompetition,
  type CanonicalMatch,
  type CanonicalTeam,
  type FieldProvenance,
  type ProviderLink
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
  assertValidCanonicalWarehouseSnapshot(snapshot);
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

/**
 * Reads one complete immutable canonical warehouse snapshot from
 * `<root>/warehouse/versions/<runId>`.
 */
export async function readCanonicalWarehouseRun(
  dataRoot: string,
  runId: string
): Promise<CanonicalWarehouseSnapshot> {
  const runDir = await resolveCanonicalWarehouseRun(dataRoot, runId);
  const [matches, teams, competitions, links, provenance] = await Promise.all([
    readRequiredJsonlFile<CanonicalMatch>(
      join(runDir, 'canonical-matches.jsonl'),
      'canonical-matches.jsonl',
      validateCanonicalMatch
    ),
    readRequiredJsonlFile<CanonicalTeam>(
      join(runDir, 'canonical-teams.jsonl'),
      'canonical-teams.jsonl',
      validateCanonicalTeam
    ),
    readRequiredJsonlFile<CanonicalCompetition>(
      join(runDir, 'canonical-competitions.jsonl'),
      'canonical-competitions.jsonl',
      validateCanonicalCompetition
    ),
    readRequiredJsonlFile<ProviderLink>(
      join(runDir, 'match-provider-links.jsonl'),
      'match-provider-links.jsonl',
      validateProviderLink
    ),
    readRequiredJsonlFile<FieldProvenance>(
      join(runDir, 'field-provenance.jsonl'),
      'field-provenance.jsonl',
      validateFieldProvenance
    )
  ]);
  return { matches, teams, competitions, links, provenance };
}

async function readRequiredJsonlFile<T>(
  filePath: string,
  collectionName: string,
  validate: (value: unknown) => ValidationResult
): Promise<T[]> {
  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`Canonical warehouse run is incomplete: missing ${collectionName}`);
    }
    throw error;
  }

  const records: T[] = [];
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || line.trim() === '') continue;

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (error) {
      throw new Error(
        `Canonical warehouse run is corrupt: ${collectionName}:${index + 1}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    const validation = validate(value);
    if (!validation.ok) {
      throw new Error(
        `Canonical warehouse run is corrupt: ${collectionName}:${index + 1}: ${validation.errors.join('; ')}`
      );
    }
    records.push(value as T);
  }
  return records;
}

function validateCanonicalTeam(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['team must be an object'] };
  }
  const team = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof team.teamId !== 'string' || team.teamId.trim() === '') errors.push('teamId must be non-empty');
  if (typeof team.name !== 'string' || team.name.trim() === '') errors.push('name must be non-empty');
  if (team.countryCode !== undefined && typeof team.countryCode !== 'string') errors.push('countryCode must be a string');
  if (typeof team.updatedAt !== 'string' || Number.isNaN(Date.parse(team.updatedAt))) errors.push('updatedAt must be valid');
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateCanonicalCompetition(value: unknown): ValidationResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ok: false, errors: ['competition must be an object'] };
  }
  const competition = value as Record<string, unknown>;
  const errors: string[] = [];
  if (typeof competition.competitionId !== 'string' || competition.competitionId.trim() === '') errors.push('competitionId must be non-empty');
  if (typeof competition.name !== 'string' || competition.name.trim() === '') errors.push('name must be non-empty');
  if (competition.type !== 'club' && competition.type !== 'national-team') errors.push('type must be club or national-team');
  if (typeof competition.updatedAt !== 'string' || Number.isNaN(Date.parse(competition.updatedAt))) errors.push('updatedAt must be valid');
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function assertValidCanonicalWarehouseSnapshot(snapshot: CanonicalWarehouseSnapshot): void {
  const collections: Array<{
    name: string;
    records: readonly unknown[];
    key: (record: unknown) => string;
    validate: (record: unknown) => ValidationResult;
  }> = [
    { name: 'matches', records: snapshot.matches, key: (record) => (record as CanonicalMatch).matchId, validate: validateCanonicalMatch },
    { name: 'teams', records: snapshot.teams, key: (record) => (record as CanonicalTeam).teamId, validate: validateCanonicalTeam },
    { name: 'competitions', records: snapshot.competitions, key: (record) => (record as CanonicalCompetition).competitionId, validate: validateCanonicalCompetition },
    {
      name: 'links',
      records: snapshot.links,
      key: (record) => {
        const link = record as ProviderLink;
        return [link.entityType, link.entityId, link.provider, link.providerEntityType, link.providerEntityId].join('|');
      },
      validate: validateProviderLink
    },
    {
      name: 'provenance',
      records: snapshot.provenance,
      key: (record) => {
        const provenance = record as FieldProvenance;
        return [provenance.entityType, provenance.entityId, provenance.fieldPath, provenance.provider, provenance.providerEntityId].join('|');
      },
      validate: validateFieldProvenance
    }
  ];

  for (const collection of collections) {
    const seenKeys = new Set<string>();
    for (let index = 0; index < collection.records.length; index += 1) {
      const record = collection.records[index];
      const validation = collection.validate(record);
      if (!validation.ok) {
        throw new Error(
          `Canonical warehouse snapshot is invalid: ${collection.name}[${index}]: ${validation.errors.join('; ')}`
        );
      }
      const key = collection.key(record);
      if (seenKeys.has(key)) {
        throw new Error(`Canonical warehouse snapshot is invalid: duplicate ${collection.name} key ${key}`);
      }
      seenKeys.add(key);
    }
  }
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
