import { createHash } from 'node:crypto';
import type { SportScoreCompetitionEntry } from '@miraichi/config';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalMatchStatus,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';

export type SportScoreMappedStatus = CanonicalMatchStatus | 'in_play' | null;

export interface SportScoreAdapterIssue {
  code:
    | 'in_play_ignored'
    | 'invalid_team_identity'
    | 'invalid_match_slug'
    | 'invalid_kickoff'
    | 'unsupported_status'
    | 'invalid_completed_score'
    | 'duplicate_match_slug'
    | 'canonical_team_collision'
    | 'canonical_match_collision';
  severity: 'ignored' | 'invalid';
  message: string;
  recordIndex: number;
  providerMatchSlug?: string;
}

export interface SportScoreCanonicalBatch {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
  issues: SportScoreAdapterIssue[];
  ignoredInPlayCount: number;
}

export interface AdaptSportScoreFixturesInput {
  competitionEntry: SportScoreCompetitionEntry;
  season: string;
  fixtures: readonly Record<string, unknown>[];
  observedAt: string;
}

const SCHEDULED_STATUSES = new Set([
  'scheduled',
  'not_started',
  'notstarted',
  'upcoming',
  'ns',
  'tbd'
]);
const COMPLETED_STATUSES = new Set(['finished', 'completed', 'ft', 'aet', 'pen']);
const POSTPONED_STATUSES = new Set([
  'postponed',
  'pst',
  'suspended',
  'susp',
  'interrupted',
  'int',
  'delayed'
]);
const CANCELLED_STATUSES = new Set([
  'cancelled',
  'canceled',
  'abandoned',
  'abd',
  'walkover',
  'wo'
]);
const IN_PLAY_STATUSES = new Set([
  'live',
  'in_play',
  'inplay',
  'first_half',
  '1st_half',
  'halftime',
  'half_time',
  'second_half',
  '2nd_half',
  'extra_time',
  'penalties'
]);
const MATCH_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export function mapSportScoreStatus(value: unknown): SportScoreMappedStatus {
  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/gu, '_');
  if (SCHEDULED_STATUSES.has(normalized)) return 'scheduled';
  if (COMPLETED_STATUSES.has(normalized)) return 'completed';
  if (POSTPONED_STATUSES.has(normalized)) return 'postponed';
  if (CANCELLED_STATUSES.has(normalized)) return 'cancelled';
  if (IN_PLAY_STATUSES.has(normalized)) return 'in_play';
  return null;
}

export function adaptSportScoreFixtures(
  input: AdaptSportScoreFixturesInput
): SportScoreCanonicalBatch {
  assertAdapterInput(input);
  const matches: CanonicalMatch[] = [];
  const teams = new Map<string, CanonicalTeam>();
  const links: ProviderLink[] = [];
  const provenance: FieldProvenance[] = [];
  const issues: SportScoreAdapterIssue[] = [];
  const seenProviderSlugs = new Set<string>();
  const seenMatchIds = new Set<string>();
  let ignoredInPlayCount = 0;

  for (let recordIndex = 0; recordIndex < input.fixtures.length; recordIndex += 1) {
    const raw = input.fixtures[recordIndex]!;
    const providerMatchSlug = typeof raw.slug === 'string' ? raw.slug : undefined;
    const homeName = normalizedDisplayName(raw.home);
    const awayName = normalizedDisplayName(raw.away);
    if (!homeName || !awayName || homeName === awayName) {
      issues.push(issue(
        'invalid_team_identity',
        'invalid',
        'Fixture must contain two distinct non-empty team names.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }

    if (!providerMatchSlug || !MATCH_SLUG_PATTERN.test(providerMatchSlug)) {
      issues.push(issue(
        'invalid_match_slug',
        'invalid',
        'Fixture must contain a lowercase provider match slug.',
        recordIndex
      ));
      continue;
    }
    const kickoffUtc = normalizeKickoff(raw.time);
    if (!kickoffUtc) {
      issues.push(issue(
        'invalid_kickoff',
        'invalid',
        'Fixture must contain a timezone-qualified ISO kickoff.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }

    const status = mapSportScoreStatus(raw.status) ?? mapSportScoreStatus(raw.status_text);
    if (status === null) {
      issues.push(issue(
        'unsupported_status',
        'invalid',
        'Fixture status is outside the accepted terminal-only status map.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }
    if (status === 'in_play') {
      ignoredInPlayCount += 1;
      issues.push(issue(
        'in_play_ignored',
        'ignored',
        'In-play fixture was intentionally excluded from canonical publication.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }

    const scoreHome = status === 'completed' ? completedScore(raw.home_score) : null;
    const scoreAway = status === 'completed' ? completedScore(raw.away_score) : null;
    if (status === 'completed' && (scoreHome === null || scoreAway === null)) {
      issues.push(issue(
        'invalid_completed_score',
        'invalid',
        'Completed fixture must contain two non-negative integer scores.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }
    if (seenProviderSlugs.has(providerMatchSlug)) {
      issues.push(issue(
        'duplicate_match_slug',
        'invalid',
        'Fixture response contains a duplicate provider match slug.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }
    seenProviderSlugs.add(providerMatchSlug);

    const homeTeamId = canonicalTeamId(homeName);
    const awayTeamId = canonicalTeamId(awayName);
    if (
      !upsertTeam(teams, homeTeamId, homeName, input.observedAt)
      || !upsertTeam(teams, awayTeamId, awayName, input.observedAt)
    ) {
      issues.push(issue(
        'canonical_team_collision',
        'invalid',
        'Distinct team names collapsed to the same canonical team identity.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }

    const matchId = canonicalMatchId({
      competitionId: input.competitionEntry.competitionId,
      season: input.season,
      kickoffDate: kickoffUtc.slice(0, 10),
      homeTeamId,
      awayTeamId
    });
    if (seenMatchIds.has(matchId)) {
      issues.push(issue(
        'canonical_match_collision',
        'invalid',
        'Distinct source fixtures collapsed to the same canonical match identity.',
        recordIndex,
        providerMatchSlug
      ));
      continue;
    }
    seenMatchIds.add(matchId);

    matches.push({
      matchId,
      competitionId: input.competitionEntry.competitionId,
      season: input.season,
      kickoffUtc,
      status,
      homeTeamId,
      awayTeamId,
      scoreHome,
      scoreAway,
      updatedAt: input.observedAt
    });
    links.push({
      entityType: 'match',
      entityId: matchId,
      provider: 'sportscore',
      providerEntityType: 'match',
      providerEntityId: providerMatchSlug,
      confidence: 1,
      linkedBy: 'sportscore-fixture-adapter',
      linkedAt: input.observedAt
    });
    provenance.push(
      createProvenance(matchId, providerMatchSlug, 'status', status, input.observedAt),
      createProvenance(matchId, providerMatchSlug, 'kickoffUtc', kickoffUtc, input.observedAt)
    );
    if (status === 'completed') {
      provenance.push(
        createProvenance(matchId, providerMatchSlug, 'scoreHome', scoreHome, input.observedAt),
        createProvenance(matchId, providerMatchSlug, 'scoreAway', scoreAway, input.observedAt)
      );
    }
  }

  const competitions: CanonicalCompetition[] = matches.length === 0 ? [] : [{
    competitionId: input.competitionEntry.competitionId,
    name: input.competitionEntry.competitionName,
    type: input.competitionEntry.competitionType,
    updatedAt: input.observedAt
  }];
  if (matches.length > 0) {
    links.push({
      entityType: 'competition',
      entityId: input.competitionEntry.competitionId,
      provider: 'sportscore',
      providerEntityType: 'competition',
      providerEntityId: input.competitionEntry.providerCompetitionId,
      confidence: 1,
      linkedBy: 'sportscore-registry',
      linkedAt: input.observedAt
    });
  }

  const referencedTeamIds = new Set(matches.flatMap((match) => [
    match.homeTeamId,
    match.awayTeamId
  ]));

  return {
    matches,
    teams: [...teams.values()].filter((team) => referencedTeamIds.has(team.teamId)),
    competitions,
    links,
    provenance,
    issues,
    ignoredInPlayCount
  };
}

function assertAdapterInput(input: AdaptSportScoreFixturesInput): void {
  if (!input.season.trim()) {
    throw new Error('SportScore adapter season is required.');
  }
  if (Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error('SportScore adapter observedAt must be a valid timestamp.');
  }
}

function normalizedDisplayName(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().replace(/\s+/gu, ' ');
  return normalized === '' || normalized.length > 200 ? null : normalized;
}

function normalizeKickoff(value: unknown): string | null {
  if (typeof value !== 'string' || !ISO_DATETIME_PATTERN.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function completedScore(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
    ? value
    : null;
}

function canonicalTeamId(name: string): string {
  const slug = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
  return slug === ''
    ? `team-${sha256(name.toLocaleLowerCase('en-US')).slice(0, 24)}`
    : `team-${slug}`;
}

function canonicalMatchId(input: {
  competitionId: string;
  season: string;
  kickoffDate: string;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  return `match-${sha256([
    input.competitionId,
    input.season,
    input.kickoffDate,
    input.homeTeamId,
    input.awayTeamId
  ].join('|')).slice(0, 24)}`;
}

function upsertTeam(
  teams: Map<string, CanonicalTeam>,
  teamId: string,
  name: string,
  updatedAt: string
): boolean {
  const existing = teams.get(teamId);
  if (existing && existing.name !== name) return false;
  teams.set(teamId, { teamId, name, updatedAt });
  return true;
}

function createProvenance(
  entityId: string,
  providerEntityId: string,
  fieldPath: string,
  value: unknown,
  observedAt: string
): FieldProvenance {
  return {
    entityType: 'match',
    entityId,
    fieldPath,
    provider: 'sportscore',
    providerEntityId,
    observedAt,
    confidence: 1,
    valueHash: sha256(JSON.stringify(value))
  };
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function issue(
  code: SportScoreAdapterIssue['code'],
  severity: SportScoreAdapterIssue['severity'],
  message: string,
  recordIndex: number,
  providerMatchSlug?: string
): SportScoreAdapterIssue {
  return {
    code,
    severity,
    message,
    recordIndex,
    ...(providerMatchSlug === undefined ? {} : { providerMatchSlug })
  };
}
