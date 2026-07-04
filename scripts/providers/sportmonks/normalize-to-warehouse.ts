import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalMatchEvent,
  CanonicalMatchStatus,
  CanonicalMatchTeamStat,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink,
  RawProviderPayloadEnvelope
} from '../../../packages/shared/src/contracts/provider-ingestion-contracts.js';
import { appendCanonicalWarehouseRecord } from '../shared/canonical-warehouse.js';
import { buildCanonicalMatchId, normalizeTeamName } from '../shared/entity-resolution.js';
import { createFieldProvenance } from '../shared/provenance.js';

export const SPORTMONKS_NATIONAL_TEAM_LEAGUE_IDS = new Set<number>([
  732,  // World Cup
  1326, // European Championship
  1114, // Copa America
  1117, // Africa Cup of Nations
  1105, // AFC Asian Cup
  1112, // CONCACAF Gold Cup
  1538  // UEFA Nations League
]);

export type SportmonksFixtureSkipReason =
  | 'unsupported_competition'
  | 'live_status'
  | 'missing_required_field';

export type SportmonksFixtureNormalizationResult =
  | {
      status: 'normalized';
      match: CanonicalMatch;
      teams: CanonicalTeam[];
      competition: CanonicalCompetition;
      links: ProviderLink[];
      provenance: FieldProvenance[];
      events: CanonicalMatchEvent[];
      teamStats: CanonicalMatchTeamStat[];
    }
  | {
      status: 'skipped';
      reason: SportmonksFixtureSkipReason;
    };

export interface SportmonksWarehouseNormalizationReport {
  normalized: number;
  skipped: number;
  failed: number;
}

interface SportmonksParticipant {
  id: number;
  name: string;
  location?: string;
}

export function normalizeSportmonksFixtureToWarehouseRecords(
  fixture: unknown,
  observedAt: string
): SportmonksFixtureNormalizationResult {
  if (!isRecord(fixture)) {
    return { status: 'skipped', reason: 'missing_required_field' };
  }

  const fixtureId = readPositiveInteger(fixture, 'id');
  const leagueId = readPositiveInteger(fixture, 'league_id');
  if (fixtureId === undefined || leagueId === undefined) {
    return { status: 'skipped', reason: 'missing_required_field' };
  }
  if (!SPORTMONKS_NATIONAL_TEAM_LEAGUE_IDS.has(leagueId)) {
    return { status: 'skipped', reason: 'unsupported_competition' };
  }

  const status = normalizeFixtureStatus(readPositiveInteger(fixture, 'state_id'));
  if (status === undefined) {
    return { status: 'skipped', reason: 'live_status' };
  }

  const kickoffUtc = normalizeSportmonksDateTime(readString(fixture, 'starting_at'));
  const league = readRecord(fixture, 'league');
  const season = readRecord(fixture, 'season');
  const competitionName = readString(league, 'name');
  const seasonLabel = readString(season, 'name') ?? readPositiveInteger(fixture, 'season_id')?.toString();
  const participants = readSportmonksParticipants(fixture);
  const home = participants.find((participant) => participant.location === 'home') ?? participants[0];
  const away = participants.find((participant) => participant.location === 'away') ?? participants.find((participant) => participant.id !== home?.id);

  if (
    kickoffUtc === undefined
    || competitionName === undefined
    || seasonLabel === undefined
    || home === undefined
    || away === undefined
  ) {
    return { status: 'skipped', reason: 'missing_required_field' };
  }

  const homeTeamId = toCanonicalId('team', home.name);
  const awayTeamId = toCanonicalId('team', away.name);
  const competitionId = toCanonicalId('competition', competitionName);
  const matchId = buildCanonicalMatchId({
    kickoffUtc,
    homeTeamName: home.name,
    awayTeamName: away.name
  });
  const score = extractCurrentScore(fixture);
  const venue = readRecord(fixture, 'venue');
  const venueName = readString(venue, 'name');
  const stage = readRecord(fixture, 'stage');
  const round = readRecord(fixture, 'round');
  const stageName = readString(stage, 'name');
  const roundName = readString(round, 'name');

  const match: CanonicalMatch = {
    matchId,
    competitionId,
    season: seasonLabel,
    kickoffUtc,
    status,
    homeTeamId,
    awayTeamId,
    scoreHome: score.home,
    scoreAway: score.away,
    ...(venueName === undefined ? {} : { venueId: toCanonicalId('venue', venueName) }),
    ...(roundName === undefined ? {} : { round: roundName }),
    ...(stageName === undefined ? {} : { stage: stageName }),
    ...(typeof fixture.neutral_venue === 'boolean' ? { neutralVenue: fixture.neutral_venue } : {}),
    updatedAt: observedAt
  };
  const teams: CanonicalTeam[] = [
    { teamId: homeTeamId, name: home.name, updatedAt: observedAt },
    { teamId: awayTeamId, name: away.name, updatedAt: observedAt }
  ];
  const competition: CanonicalCompetition = {
    competitionId,
    name: competitionName,
    type: 'national-team',
    updatedAt: observedAt
  };
  const providerEntityId = String(fixtureId);
  const links: ProviderLink[] = [
    createProviderLink('match', matchId, 'fixture', providerEntityId, observedAt),
    createProviderLink('competition', competitionId, 'league', String(leagueId), observedAt),
    createProviderLink('team', homeTeamId, 'team', String(home.id), observedAt),
    createProviderLink('team', awayTeamId, 'team', String(away.id), observedAt)
  ];
  const participantTeamIds = new Map<number, string>([
    [home.id, homeTeamId],
    [away.id, awayTeamId]
  ]);

  return {
    status: 'normalized',
    match,
    teams,
    competition,
    links,
    provenance: createMatchProvenance(match, providerEntityId, observedAt),
    events: normalizeFixtureEvents(fixture, matchId, participantTeamIds),
    teamStats: normalizeFixtureTeamStats(fixture, matchId, participantTeamIds)
  };
}

export async function normalizeSportmonksRawCaptureToWarehouse(options: {
  captureRoot: string;
  observedAt?: string;
}): Promise<SportmonksWarehouseNormalizationReport> {
  const report: SportmonksWarehouseNormalizationReport = {
    normalized: 0,
    skipped: 0,
    failed: 0
  };
  const rawRoot = join(options.captureRoot, 'providers', 'sportmonks', 'raw', 'fixtures.enrichedById');

  for (const filePath of await listJsonFiles(rawRoot)) {
    try {
      const envelope = JSON.parse(await readFile(filePath, 'utf8')) as RawProviderPayloadEnvelope;
      const fixture = readPayloadDataRecord(envelope.payload);
      const result = normalizeSportmonksFixtureToWarehouseRecords(
        fixture,
        options.observedAt ?? envelope.fetchedAt ?? new Date().toISOString()
      );
      if (result.status !== 'normalized') {
        report.skipped += 1;
        continue;
      }

      await appendWarehouseRecords(options.captureRoot, result);
      report.normalized += 1;
    } catch {
      report.failed += 1;
    }
  }

  return report;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const captureRoot = readCliValue(args, '--capture-root=')
    ?? process.env.PROVIDER_CAPTURE_ROOT
    ?? resolve(process.cwd(), 'apps/api/data');
  const report = await normalizeSportmonksRawCaptureToWarehouse({ captureRoot });
  console.log(JSON.stringify({ captureRoot, report }, null, 2));
  if (report.failed > 0) {
    process.exitCode = 1;
  }
}

async function appendWarehouseRecords(
  captureRoot: string,
  records: Extract<SportmonksFixtureNormalizationResult, { status: 'normalized' }>
): Promise<void> {
  await appendCanonicalWarehouseRecord(captureRoot, 'canonical-matches', records.match);
  for (const team of records.teams) {
    await appendCanonicalWarehouseRecord(captureRoot, 'canonical-teams', team);
  }
  await appendCanonicalWarehouseRecord(captureRoot, 'canonical-competitions', records.competition);
  for (const link of records.links) {
    await appendCanonicalWarehouseRecord(captureRoot, 'match-provider-links', link);
  }
  for (const event of records.events) {
    await appendCanonicalWarehouseRecord(captureRoot, 'match-events', event);
  }
  for (const stat of records.teamStats) {
    await appendCanonicalWarehouseRecord(captureRoot, 'match-team-stats', stat);
  }
  for (const item of records.provenance) {
    await appendCanonicalWarehouseRecord(captureRoot, 'field-provenance', item);
  }
}

function normalizeFixtureStatus(stateId: number | undefined): CanonicalMatchStatus | undefined {
  if (stateId === undefined) {
    return 'unknown';
  }
  if ([2, 3, 4, 6, 9, 21, 22, 23, 25].includes(stateId)) {
    return undefined;
  }
  if ([1, 13, 26].includes(stateId)) {
    return 'scheduled';
  }
  if ([5, 7, 8, 14, 17].includes(stateId)) {
    return 'completed';
  }
  if ([10, 11, 15, 16, 18, 19].includes(stateId)) {
    return 'postponed';
  }
  if ([12, 20].includes(stateId)) {
    return 'cancelled';
  }
  return 'unknown';
}

function normalizeSportmonksDateTime(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function extractCurrentScore(fixture: Record<string, unknown>): { home: number | null; away: number | null } {
  const scores = readArray(fixture, 'scores');
  const currentScores = scores.filter((score) => readString(score, 'description') === 'CURRENT');
  const source = currentScores.length > 0 ? currentScores : scores;
  let home: number | null = null;
  let away: number | null = null;

  for (const item of source) {
    const score = readRecord(item, 'score');
    const goals = readNumber(score, 'goals');
    const participant = readString(score, 'participant');
    if (goals === undefined) {
      continue;
    }
    if (participant === 'home') {
      home = goals;
    } else if (participant === 'away') {
      away = goals;
    }
  }

  return { home, away };
}

function normalizeFixtureEvents(
  fixture: Record<string, unknown>,
  matchId: string,
  participantTeamIds: Map<number, string>
): CanonicalMatchEvent[] {
  return readArray(fixture, 'events').map((event, index) => {
    const minute = readNumber(event, 'minute') ?? null;
    const eventType = mapEventType(readString(readRecord(event, 'type'), 'name') ?? readString(event, 'type') ?? readString(event, 'result'));
    const participantId = readPositiveInteger(event, 'participant_id');
    const teamId = participantId === undefined ? undefined : participantTeamIds.get(participantId);
    const stoppageMinute = readNumber(event, 'extra_minute');
    const playerName = readString(event, 'player_name');
    const label = readString(event, 'player_name')
      ?? readString(readRecord(event, 'player'), 'name')
      ?? readString(readRecord(event, 'type'), 'name')
      ?? eventType;

    return {
      eventId: `event-${matchId}-${index + 1}-${normalizeTeamName(label) || 'unknown'}`,
      matchId,
      eventType,
      minute,
      ...(stoppageMinute === undefined ? {} : { stoppageMinute }),
      ...(teamId === undefined ? {} : { teamId }),
      ...(playerName === undefined ? {} : { playerName }),
      label,
      occurredAtKnown: minute !== null
    };
  });
}

function normalizeFixtureTeamStats(
  fixture: Record<string, unknown>,
  matchId: string,
  participantTeamIds: Map<number, string>
): CanonicalMatchTeamStat[] {
  return readArray(fixture, 'statistics')
    .map((stat, index): CanonicalMatchTeamStat | undefined => {
      const participantId = readPositiveInteger(stat, 'participant_id');
      const teamId = participantId === undefined ? undefined : participantTeamIds.get(participantId);
      if (teamId === undefined) {
        return undefined;
      }
      const typeName = readString(readRecord(stat, 'type'), 'name') ?? readPositiveInteger(stat, 'type_id')?.toString() ?? `stat-${index + 1}`;
      const value = readStatValue(stat);
      return {
        statId: `stat-${matchId}-${teamId}-${normalizeTeamName(typeName)}`,
        matchId,
        teamId,
        statType: typeName,
        value
      };
    })
    .filter((item): item is CanonicalMatchTeamStat => item !== undefined);
}

function createMatchProvenance(match: CanonicalMatch, providerEntityId: string, observedAt: string): FieldProvenance[] {
  const fields: Array<keyof CanonicalMatch> = [
    'competitionId',
    'season',
    'kickoffUtc',
    'status',
    'homeTeamId',
    'awayTeamId',
    'scoreHome',
    'scoreAway',
    'venueId',
    'round',
    'stage',
    'neutralVenue'
  ];
  return fields
    .filter((field) => match[field] !== undefined && match[field] !== null)
    .map((field) => createFieldProvenance({
      entityType: 'match',
      entityId: match.matchId,
      fieldPath: field,
      provider: 'sportmonks',
      providerEntityId,
      value: match[field],
      observedAt,
      confidence: 0.95
    }));
}

function createProviderLink(
  entityType: ProviderLink['entityType'],
  entityId: string,
  providerEntityType: string,
  providerEntityId: string,
  linkedAt: string
): ProviderLink {
  return {
    entityType,
    entityId,
    provider: 'sportmonks',
    providerEntityType,
    providerEntityId,
    confidence: 0.98,
    linkedBy: 'sportmonks-fixture-normalizer',
    linkedAt
  };
}

function readSportmonksParticipants(fixture: Record<string, unknown>): SportmonksParticipant[] {
  return readArray(fixture, 'participants')
    .map((participant): SportmonksParticipant | undefined => {
      const id = readPositiveInteger(participant, 'id');
      const name = readString(participant, 'name');
      if (id === undefined || name === undefined) {
        return undefined;
      }
      const meta = readRecord(participant, 'meta');
      const location = readString(meta, 'location')?.toLowerCase();
      return {
        id,
        name,
        ...(location === undefined ? {} : { location })
      };
    })
    .filter((participant): participant is SportmonksParticipant => participant !== undefined);
}

function mapEventType(value: string | undefined): CanonicalMatchEvent['eventType'] {
  const normalized = value?.toLowerCase() ?? '';
  if (normalized.includes('goal')) {
    return 'goal';
  }
  if (normalized.includes('card')) {
    return 'card';
  }
  if (normalized.includes('substitution') || normalized.includes('substitute')) {
    return 'substitution';
  }
  if (normalized.includes('penalty')) {
    return 'penalty';
  }
  return 'other';
}

function readStatValue(stat: unknown): CanonicalMatchTeamStat['value'] {
  const data = readRecord(stat, 'data');
  if (data !== undefined && 'value' in data) {
    const value = data.value;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean' || value === null) {
      return value;
    }
  }
  const directValue = isRecord(stat) ? stat.value : undefined;
  if (typeof directValue === 'number' || typeof directValue === 'string' || typeof directValue === 'boolean' || directValue === null) {
    return directValue;
  }
  return null;
}

function readPayloadDataRecord(payload: unknown): unknown {
  if (!isRecord(payload)) {
    return undefined;
  }
  return payload.data;
}

function toCanonicalId(prefix: string, label: string): string {
  return `${prefix}-${normalizeTeamName(label)}`;
}

async function listJsonFiles(root: string): Promise<string[]> {
  const files: string[] = [];
  async function visit(dir: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json')) {
        files.push(fullPath);
      }
    }
  }
  await visit(root);
  return files.sort();
}

function readCliValue(args: string[], prefix: string): string | undefined {
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    return [];
  }
  return value[key];
}

function readRecord(value: unknown, key: string): Record<string, unknown> | undefined {
  if (!isRecord(value) || !isRecord(value[key])) {
    return undefined;
  }
  return value[key];
}

function readString(value: unknown, key: string): string | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const raw = value[key];
  return typeof raw === 'string' && raw.trim() !== '' ? raw : undefined;
}

function readNumber(value: unknown, key: string): number | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const raw = value[key];
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : undefined;
}

function readPositiveInteger(value: unknown, key: string): number | undefined {
  const raw = readNumber(value, key);
  return raw !== undefined && Number.isInteger(raw) && raw > 0 ? raw : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
