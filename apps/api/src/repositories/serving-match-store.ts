import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  LocalDataSourceId,
  LocalMatch,
  LocalMatchSourceRef,
  ProviderLink
} from '@miraichi/shared';
import { validateLocalMatch } from '@miraichi/shared';

export type ServingMatchScope = 'configured-competitions';

export interface LocalMatchSnapshot {
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  sources: LocalMatchSourceRef[];
  matches: LocalMatch[];
}

export interface ServingMatchStoreManifest {
  schemaVersion: 'miraichi.serving.match-store.v1';
  currentVersion: string;
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  sources: LocalMatchSourceRef[];
  scopes: Array<{
    scope: ServingMatchScope;
    matchCount: number;
    partitions: {
      byDate: string[];
      byCompetition: string[];
    };
    competitions: Array<{
      id: string;
      name: string;
      seasons: string[];
      matchCount: number;
    }>;
  }>;
  warnings: string[];
}

export interface ServingMatchPartition {
  schemaVersion: 'miraichi.serving.matches.partition.v1';
  version: string;
  scope: ServingMatchScope;
  partition: {
    type: 'date' | 'competition';
    key: string;
  };
  generatedAt: string;
  matches: LocalMatch[];
}

export interface ServingMatchIndex {
  schemaVersion: 'miraichi.serving.match-index.v1';
  version: string;
  generatedAt: string;
  entries: Record<string, {
    scope: ServingMatchScope;
    date: string;
    competitionId: string;
    season: string;
    partitionPath: string;
  }>;
}

export interface BuildServingMatchStoreOptions {
  servingRoot: string;
  version: string;
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  sources: LocalMatchSourceRef[];
  matches: LocalMatch[];
  scope?: ServingMatchScope;
  warnings?: string[];
}

export interface BuildServingMatchStoreResult {
  version: string;
  matchCount: number;
  partitionCount: number;
}

export interface BuildServingMatchesFromWarehouseOptions {
  warehouseRoot: string;
  importedAt?: string;
}

export interface WarehouseServingMatches {
  matches: LocalMatch[];
  sources: LocalMatchSourceRef[];
}

const STORE_SCHEMA_VERSION = 'miraichi.serving.match-store.v1';
const PARTITION_SCHEMA_VERSION = 'miraichi.serving.matches.partition.v1';
const INDEX_SCHEMA_VERSION = 'miraichi.serving.match-index.v1';

export async function buildServingMatchStore(
  options: BuildServingMatchStoreOptions
): Promise<BuildServingMatchStoreResult> {
  const scope = options.scope ?? 'configured-competitions';
  const matches = normalizeAndValidateMatches(options.matches);
  const versionDir = path.join(options.servingRoot, 'versions', options.version);
  const scopedRoot = path.join(versionDir, `scope=${scope}`);
  const byDateRoot = path.join(scopedRoot, 'by-date');
  const byCompetitionRoot = path.join(scopedRoot, 'by-competition');
  const partitionsByDate = groupMatches(matches, (match) => match.kickoffUtc.slice(0, 10));
  const partitionsByCompetition = groupMatches(matches, (match) => `${match.competition.id}/${match.competition.season}`);
  const byDatePaths: string[] = [];
  const byCompetitionPaths: string[] = [];
  const index: ServingMatchIndex = {
    schemaVersion: INDEX_SCHEMA_VERSION,
    version: options.version,
    generatedAt: options.generatedAt,
    entries: {}
  };

  await fs.mkdir(byDateRoot, { recursive: true });
  await fs.mkdir(byCompetitionRoot, { recursive: true });

  for (const [date, partitionMatches] of [...partitionsByDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const partitionPath = `scope=${scope}/by-date/${date}.json`;
    byDatePaths.push(partitionPath);
    await writeJson(path.join(versionDir, partitionPath), {
      schemaVersion: PARTITION_SCHEMA_VERSION,
      version: options.version,
      scope,
      partition: { type: 'date', key: date },
      generatedAt: options.generatedAt,
      matches: sortMatchesForStorage(partitionMatches)
    } satisfies ServingMatchPartition);
  }

  for (const [key, partitionMatches] of [...partitionsByCompetition.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const [competitionId, season] = key.split('/');
    if (!competitionId || !season) {
      throw new Error(`Invalid competition partition key: ${key}`);
    }
    const partitionPath = `scope=${scope}/by-competition/${competitionId}/${season}.json`;
    byCompetitionPaths.push(partitionPath);
    await writeJson(path.join(versionDir, partitionPath), {
      schemaVersion: PARTITION_SCHEMA_VERSION,
      version: options.version,
      scope,
      partition: { type: 'competition', key },
      generatedAt: options.generatedAt,
      matches: sortMatchesForStorage(partitionMatches)
    } satisfies ServingMatchPartition);
  }

  for (const match of matches) {
    index.entries[match.id] = {
      scope,
      date: match.kickoffUtc.slice(0, 10),
      competitionId: match.competition.id,
      season: match.competition.season,
      partitionPath: `scope=${scope}/by-date/${match.kickoffUtc.slice(0, 10)}.json`
    };
  }

  await writeJson(path.join(versionDir, 'indexes', 'match-id.json'), index);

  const manifest: ServingMatchStoreManifest = {
    schemaVersion: STORE_SCHEMA_VERSION,
    currentVersion: options.version,
    snapshotId: options.snapshotId,
    generatedAt: options.generatedAt,
    importedAt: options.importedAt,
    sources: dedupeSourceRefs(options.sources),
    scopes: [
      {
        scope,
        matchCount: matches.length,
        partitions: {
          byDate: byDatePaths,
          byCompetition: byCompetitionPaths
        },
        competitions: summarizeCompetitions(matches)
      }
    ],
    warnings: options.warnings ?? []
  };
  await writeJson(path.join(options.servingRoot, 'manifest.json'), manifest);

  return {
    version: options.version,
    matchCount: matches.length,
    partitionCount: byDatePaths.length + byCompetitionPaths.length
  };
}

export async function readServingMatchStoreSnapshot(servingRoot: string): Promise<LocalMatchSnapshot> {
  const manifest = await readManifest(servingRoot);
  const versionDir = path.join(servingRoot, 'versions', manifest.currentVersion);
  const byId = new Map<string, LocalMatch>();

  for (const scope of manifest.scopes) {
    for (const partitionPath of scope.partitions.byDate) {
      const partition = await readPartition(path.join(versionDir, partitionPath));
      for (let i = 0; i < partition.matches.length; i++) {
        const match = partition.matches[i];
        const validation = validateLocalMatch(match);
        if (!validation.ok) {
          throw servingError(
            'serving_match_store_invalid',
            500,
            `Invalid serving match in ${partitionPath} at index ${i}: ${validation.errors.join(', ')}`
          );
        }
        byId.set(match.id, match);
      }
    }
  }

  return {
    snapshotId: manifest.snapshotId,
    generatedAt: manifest.generatedAt,
    importedAt: manifest.importedAt,
    sources: manifest.sources,
    matches: sortMatchesForStorage([...byId.values()])
  };
}

export async function buildServingMatchesFromWarehouse(
  options: BuildServingMatchesFromWarehouseOptions
): Promise<WarehouseServingMatches> {
  const importedAt = options.importedAt ?? new Date().toISOString();
  const [matches, teams, competitions, links] = await Promise.all([
    readJsonl<CanonicalMatch>(path.join(options.warehouseRoot, 'canonical-matches.jsonl')),
    readJsonl<CanonicalTeam>(path.join(options.warehouseRoot, 'canonical-teams.jsonl')),
    readJsonl<CanonicalCompetition>(path.join(options.warehouseRoot, 'canonical-competitions.jsonl')),
    readJsonl<ProviderLink>(path.join(options.warehouseRoot, 'match-provider-links.jsonl'))
  ]);
  const teamById = new Map(teams.map((team) => [team.teamId, team]));
  const competitionById = new Map(competitions.map((competition) => [competition.competitionId, competition]));
  const linksByMatch = new Map<string, ProviderLink[]>();
  for (const link of links) {
    if (link.entityType !== 'match') continue;
    const current = linksByMatch.get(link.entityId) ?? [];
    current.push(link);
    linksByMatch.set(link.entityId, current);
  }

  const localMatches = matches.map((match): LocalMatch => {
    const competition = competitionById.get(match.competitionId);
    const homeTeam = teamById.get(match.homeTeamId);
    const awayTeam = teamById.get(match.awayTeamId);
    if (!competition) {
      throw new Error(`Missing canonical competition ${match.competitionId} for match ${match.matchId}`);
    }
    if (!homeTeam) {
      throw new Error(`Missing canonical home team ${match.homeTeamId} for match ${match.matchId}`);
    }
    if (!awayTeam) {
      throw new Error(`Missing canonical away team ${match.awayTeamId} for match ${match.matchId}`);
    }
    return {
      id: match.matchId,
      competition: {
        id: competition.competitionId,
        name: competition.name,
        type: competition.type,
        season: match.season
      },
      kickoffUtc: match.kickoffUtc,
      status: match.status,
      homeTeam: {
        id: homeTeam.teamId,
        name: homeTeam.name,
        ...(homeTeam.countryCode === undefined ? {} : { countryCode: homeTeam.countryCode })
      },
      awayTeam: {
        id: awayTeam.teamId,
        name: awayTeam.name,
        ...(awayTeam.countryCode === undefined ? {} : { countryCode: awayTeam.countryCode })
      },
      score: {
        home: match.scoreHome,
        away: match.scoreAway
      },
      ...(match.round === undefined ? {} : { round: match.round }),
      ...(match.stage === undefined ? {} : { stage: match.stage }),
      ...(match.neutralVenue === undefined ? {} : { neutralVenue: match.neutralVenue }),
      sourceRefs: providerLinksToSourceRefs(linksByMatch.get(match.matchId) ?? [], importedAt),
      updatedAt: match.updatedAt
    };
  });

  const sources = dedupeSourceRefs(localMatches.flatMap((match) => match.sourceRefs));
  return {
    matches: normalizeAndValidateMatches(localMatches),
    sources
  };
}

async function readManifest(servingRoot: string): Promise<ServingMatchStoreManifest> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(path.join(servingRoot, 'manifest.json'), 'utf8'));
  } catch (error) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'ENOENT') {
      throw servingError('serving_match_store_missing', 503, `Serving match store manifest not found at ${path.join(servingRoot, 'manifest.json')}`);
    }
    throw servingError('serving_match_store_invalid', 500, `Malformed serving match store manifest: ${err.message ?? String(error)}`);
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== STORE_SCHEMA_VERSION) {
    throw servingError('serving_match_store_invalid', 500, 'Serving match store manifest has an invalid schemaVersion');
  }
  if (typeof parsed.currentVersion !== 'string' || parsed.currentVersion.trim() === '') {
    throw servingError('serving_match_store_invalid', 500, 'Serving match store manifest currentVersion is invalid');
  }
  if (!Array.isArray(parsed.scopes)) {
    throw servingError('serving_match_store_invalid', 500, 'Serving match store manifest scopes must be an array');
  }
  return parsed as unknown as ServingMatchStoreManifest;
}

async function readPartition(filePath: string): Promise<ServingMatchPartition> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    const err = error as { message?: string };
    throw servingError('serving_match_store_invalid', 500, `Malformed serving match partition ${filePath}: ${err.message ?? String(error)}`);
  }
  if (!isRecord(parsed) || parsed.schemaVersion !== PARTITION_SCHEMA_VERSION || !Array.isArray(parsed.matches)) {
    throw servingError('serving_match_store_invalid', 500, `Serving match partition ${filePath} has an invalid schema`);
  }
  return parsed as unknown as ServingMatchPartition;
}

function normalizeAndValidateMatches(matches: LocalMatch[]): LocalMatch[] {
  for (let i = 0; i < matches.length; i++) {
    const validation = validateLocalMatch(matches[i]);
    if (!validation.ok) {
      throw new Error(`Invalid serving match at index ${i}: ${validation.errors.join(', ')}`);
    }
  }
  const byId = new Map<string, LocalMatch>();
  for (const match of matches) {
    const existing = byId.get(match.id);
    if (!existing) {
      byId.set(match.id, { ...match, sourceRefs: dedupeSourceRefs(match.sourceRefs) });
      continue;
    }
    const mergedSourceRefs = dedupeSourceRefs([...existing.sourceRefs, ...match.sourceRefs]);
    const existingTime = new Date(existing.updatedAt).getTime();
    const matchTime = new Date(match.updatedAt).getTime();
    const chosen = matchTime >= existingTime ? match : existing;
    byId.set(match.id, { ...chosen, sourceRefs: mergedSourceRefs });
  }
  return sortMatchesForStorage([...byId.values()]);
}

function providerLinksToSourceRefs(links: ProviderLink[], fallbackImportedAt: string): LocalMatchSourceRef[] {
  return dedupeSourceRefs(links.map((link) => ({
    sourceId: link.provider as LocalDataSourceId,
    sourceMatchId: link.providerEntityId,
    importedAt: link.linkedAt || fallbackImportedAt
  })));
}

function dedupeSourceRefs(sourceRefs: LocalMatchSourceRef[]): LocalMatchSourceRef[] {
  const byKey = new Map<string, LocalMatchSourceRef>();
  for (const sourceRef of sourceRefs) {
    const key = [
      sourceRef.sourceId,
      sourceRef.sourceMatchId ?? '',
      sourceRef.sourceUrl ?? ''
    ].join('|');
    const existing = byKey.get(key);
    if (!existing || sourceRef.importedAt.localeCompare(existing.importedAt) > 0) {
      byKey.set(key, sourceRef);
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const sourceCompare = a.sourceId.localeCompare(b.sourceId);
    if (sourceCompare !== 0) return sourceCompare;
    return (a.sourceMatchId ?? '').localeCompare(b.sourceMatchId ?? '');
  });
}

function groupMatches(matches: LocalMatch[], keyFn: (match: LocalMatch) => string): Map<string, LocalMatch[]> {
  const grouped = new Map<string, LocalMatch[]>();
  for (const match of matches) {
    const key = keyFn(match);
    const current = grouped.get(key) ?? [];
    current.push(match);
    grouped.set(key, current);
  }
  return grouped;
}

function summarizeCompetitions(matches: LocalMatch[]): ServingMatchStoreManifest['scopes'][number]['competitions'] {
  const byCompetition = new Map<string, { id: string; name: string; seasons: Set<string>; matchCount: number }>();
  for (const match of matches) {
    const current = byCompetition.get(match.competition.id) ?? {
      id: match.competition.id,
      name: match.competition.name,
      seasons: new Set<string>(),
      matchCount: 0
    };
    current.seasons.add(match.competition.season);
    current.matchCount += 1;
    byCompetition.set(current.id, current);
  }
  return [...byCompetition.values()]
    .map((item) => ({
      id: item.id,
      name: item.name,
      seasons: [...item.seasons].sort(),
      matchCount: item.matchCount
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function sortMatchesForStorage(matches: LocalMatch[]): LocalMatch[] {
  return [...matches].sort((a, b) => {
    const kickoffCompare = a.kickoffUtc.localeCompare(b.kickoffUtc);
    if (kickoffCompare !== 0) return kickoffCompare;
    return a.id.localeCompare(b.id);
  });
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content
      .split(/\r?\n/)
      .filter((line) => line.trim() !== '')
      .map((line) => JSON.parse(line) as T);
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function servingError(code: 'serving_match_store_missing' | 'serving_match_store_invalid', statusCode: number, message: string): Error {
  const error = new Error(message) as Error & { code: string; statusCode: number };
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
