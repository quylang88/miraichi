import { createHash } from 'node:crypto';
import { Temporal } from '@js-temporal/polyfill';
import type { CompetitionSourceEntry } from '@miraichi/config';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import type { OpenFootballSeasonPayload } from './openfootball-client.js';

export interface OpenFootballAdapterIssue {
  code:
    | 'invalid_team_identity'
    | 'invalid_date'
    | 'missing_kickoff_time'
    | 'invalid_score'
    | 'canonical_match_collision';
  severity: 'ignored' | 'invalid';
  message: string;
  recordIndex: number;
}

export interface OpenFootballCanonicalBatch {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
  issues: OpenFootballAdapterIssue[];
}

export interface AdaptOpenFootballSeasonInput {
  competitionEntry: CompetitionSourceEntry;
  season: string;
  openFootballFile: string;
  rawPayload: OpenFootballSeasonPayload;
  observedAt: string;
}

export function adaptOpenFootballSeason(
  input: AdaptOpenFootballSeasonInput
): OpenFootballCanonicalBatch {
  if (Number.isNaN(Date.parse(input.observedAt))) {
    throw new Error('OpenFootball adapter observedAt must be a valid timestamp.');
  }
  const matches: CanonicalMatch[] = [];
  const teams = new Map<string, CanonicalTeam>();
  const links: ProviderLink[] = [];
  const provenance: FieldProvenance[] = [];
  const issues: OpenFootballAdapterIssue[] = [];
  const seenMatchIds = new Set<string>();
  const seenProviderEntityIds = new Set<string>();

  const competition: CanonicalCompetition = {
    competitionId: input.competitionEntry.competitionId,
    name: input.competitionEntry.competitionName,
    type: input.competitionEntry.competitionType,
    updatedAt: input.observedAt
  };

  const competitionLink: ProviderLink = {
    entityType: 'competition',
    entityId: input.competitionEntry.competitionId,
    provider: 'openfootball',
    providerEntityType: 'competition',
    providerEntityId: input.openFootballFile,
    confidence: 1,
    linkedBy: 'openfootball-adapter',
    linkedAt: input.observedAt
  };
  links.push(competitionLink);

  for (let recordIndex = 0; recordIndex < input.rawPayload.matches.length; recordIndex += 1) {
    const raw = input.rawPayload.matches[recordIndex]!;
    const homeName = normalizeTeamName(raw.team1);
    const awayName = normalizeTeamName(raw.team2);

    if (!homeName || !awayName || homeName.toLowerCase() === awayName.toLowerCase()) {
      issues.push({
        code: 'invalid_team_identity',
        severity: 'invalid',
        message: 'Match must contain two distinct non-empty team names.',
        recordIndex
      });
      continue;
    }

    if (!isRealCalendarDate(raw.date)) {
      issues.push({
        code: 'invalid_date',
        severity: 'invalid',
        message: 'Match must contain a valid calendar date.',
        recordIndex
      });
      continue;
    }
    if (typeof raw.time !== 'string' || !/^\d{2}:\d{2}$/u.test(raw.time)) {
      issues.push({
        code: 'missing_kickoff_time',
        severity: 'ignored',
        message: 'Match has a date but no exact kickoff time; no timestamp was invented.',
        recordIndex
      });
      continue;
    }
    const kickoffUtc = normalizeKickoff(
      raw.date,
      raw.time,
      input.competitionEntry.sourceTimezone
    );
    if (!kickoffUtc) {
      issues.push({
        code: 'invalid_date',
        severity: 'invalid',
        message: 'Match kickoff cannot be resolved in the configured competition timezone.',
        recordIndex
      });
      continue;
    }

    const homeTeamId = deriveTeamId(homeName);
    const awayTeamId = deriveTeamId(awayName);

    if (!teams.has(homeTeamId)) {
      const team: CanonicalTeam = {
        teamId: homeTeamId,
        name: homeName,
        updatedAt: input.observedAt
      };
      teams.set(homeTeamId, team);
      links.push({
        entityType: 'team',
        entityId: homeTeamId,
        provider: 'openfootball',
        providerEntityType: 'team',
        providerEntityId: homeName,
        confidence: 1,
        linkedBy: 'openfootball-adapter',
        linkedAt: input.observedAt
      });
    }

    if (!teams.has(awayTeamId)) {
      const team: CanonicalTeam = {
        teamId: awayTeamId,
        name: awayName,
        updatedAt: input.observedAt
      };
      teams.set(awayTeamId, team);
      links.push({
        entityType: 'team',
        entityId: awayTeamId,
        provider: 'openfootball',
        providerEntityType: 'team',
        providerEntityId: awayName,
        confidence: 1,
        linkedBy: 'openfootball-adapter',
        linkedAt: input.observedAt
      });
    }

    const scoreFt = raw.score?.ft;
    const hasFinalScore = scoreFt !== undefined;
    const isCompleted = Array.isArray(scoreFt) && scoreFt.length === 2
      && scoreFt.every((score) => Number.isSafeInteger(score) && score >= 0);
    if (hasFinalScore && !isCompleted) {
      issues.push({
        code: 'invalid_score',
        severity: 'invalid',
        message: 'Final score must contain two non-negative safe integers.',
        recordIndex
      });
      continue;
    }

    const scoreHome = isCompleted ? scoreFt[0]! : null;
    const scoreAway = isCompleted ? scoreFt[1]! : null;
    const status = isCompleted ? 'completed' : 'scheduled';

    const matchId = deriveMatchId({
      competitionId: input.competitionEntry.competitionId,
      season: input.season,
      date: raw.date,
      homeTeamId,
      awayTeamId
    });

    if (seenMatchIds.has(matchId)) {
      issues.push({
        code: 'canonical_match_collision',
        severity: 'invalid',
        message: 'Duplicate match identity detected in season payload.',
        recordIndex
      });
      continue;
    }
    seenMatchIds.add(matchId);

    const match: CanonicalMatch = {
      matchId,
      competitionId: input.competitionEntry.competitionId,
      season: input.season,
      kickoffUtc,
      status,
      homeTeamId,
      awayTeamId,
      scoreHome,
      scoreAway,
      ...(raw.round ? { round: raw.round } : {}),
      updatedAt: input.observedAt
    };
    matches.push(match);

    const providerEntityId = stableProviderMatchId({
      season: input.season,
      file: input.openFootballFile,
      ...(raw.round === undefined ? {} : { round: raw.round }),
      homeName,
      awayName
    });
    if (seenProviderEntityIds.has(providerEntityId)) {
      issues.push({
        code: 'canonical_match_collision',
        severity: 'invalid',
        message: 'Source rows produced a duplicate stable provider match identity.',
        recordIndex
      });
      continue;
    }
    seenProviderEntityIds.add(providerEntityId);
    links.push({
      entityType: 'match',
      entityId: matchId,
      provider: 'openfootball',
      providerEntityType: 'match',
      providerEntityId,
      confidence: 1,
      linkedBy: 'openfootball-adapter',
      linkedAt: input.observedAt
    });

    provenance.push(
      createProvenance(matchId, providerEntityId, 'status', status, input.observedAt),
      createProvenance(matchId, providerEntityId, 'kickoffUtc', kickoffUtc, input.observedAt)
    );
    if (isCompleted) {
      provenance.push(
        createProvenance(matchId, providerEntityId, 'scoreHome', scoreHome, input.observedAt),
        createProvenance(matchId, providerEntityId, 'scoreAway', scoreAway, input.observedAt)
      );
    }
  }

  return {
    matches,
    teams: Array.from(teams.values()),
    competitions: [competition],
    links,
    provenance,
    issues
  };
}

function deriveTeamId(name: string): string {
  const slug = slugify(name);
  return `team-${slug || sha256Hex(name).slice(0, 16)}`;
}

function deriveMatchId(options: {
  competitionId: string;
  season: string;
  date: string;
  homeTeamId: string;
  awayTeamId: string;
}): string {
  const rawKey = `${options.competitionId}:${options.season}:${options.date}:${options.homeTeamId}:${options.awayTeamId}`;
  return `match-${sha256Hex(rawKey).slice(0, 24)}`;
}

function normalizeTeamName(name: unknown): string {
  if (typeof name !== 'string') return '';
  return name.trim().replace(/\s+/gu, ' ');
}

function normalizeKickoff(date: string, time: string, timeZone: string): string | null {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  try {
    const zoned = Temporal.ZonedDateTime.from({
      timeZone,
      year: year!,
      month: month!,
      day: day!,
      hour: hour!,
      minute: minute!
    });
    return new Date(Number(zoned.epochMilliseconds)).toISOString();
  } catch {
    return null;
  }
}

function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function stableProviderMatchId(options: {
  season: string;
  file: string;
  round?: string;
  homeName: string;
  awayName: string;
}): string {
  const identity = [
    options.round?.trim() ?? '',
    options.homeName.toLocaleLowerCase('en-US'),
    options.awayName.toLocaleLowerCase('en-US')
  ].join('|');
  return `${options.season}/${options.file}/${sha256Hex(identity).slice(0, 24)}`;
}

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
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
    provider: 'openfootball',
    providerEntityId,
    observedAt,
    confidence: 1,
    valueHash: sha256Hex(JSON.stringify(value))
  };
}
