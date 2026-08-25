import { createHash } from 'node:crypto';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalMatchStatus,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import type { ApiFootballCompetitionEntry } from '@miraichi/config';
import type { ApiFootballFixtureItem } from './api-football-client.js';

export interface ApiFootballCanonicalBatch {
  matches: CanonicalMatch[];
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  links: ProviderLink[];
  provenance: FieldProvenance[];
  issues: Array<{ code: string; message: string; fixtureId?: number }>;
}

export interface AdaptApiFootballMatchesInput {
  competitionEntry?: ApiFootballCompetitionEntry;
  fixtures: readonly ApiFootballFixtureItem[];
  observedAt: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '');
}

export function mapApiFootballStatusToCanonical(shortStatus: string): CanonicalMatchStatus {
  switch (shortStatus) {
    case 'TBD':
    case 'NS':
      return 'scheduled';
    case '1H':
    case 'HT':
    case '2H':
    case 'ET':
    case 'BT':
    case 'P':
    case 'LIVE':
      return 'scheduled'; // Core serving contracts treat ongoing matches as scheduled until completed, or in_play context
    case 'FT':
    case 'AET':
    case 'PEN':
      return 'completed';
    case 'PST':
    case 'SUSP':
    case 'INT':
      return 'postponed';
    case 'CANC':
    case 'ABD':
    case 'WO':
      return 'cancelled';
    default:
      return 'unknown';
  }
}

export function adaptApiFootballMatches(input: AdaptApiFootballMatchesInput): ApiFootballCanonicalBatch {
  const { fixtures, observedAt, competitionEntry } = input;
  const matches: CanonicalMatch[] = [];
  const teamsMap = new Map<string, CanonicalTeam>();
  const compsMap = new Map<string, CanonicalCompetition>();
  const links: ProviderLink[] = [];
  const provenance: FieldProvenance[] = [];
  const issues: ApiFootballCanonicalBatch['issues'] = [];

  for (const item of fixtures) {
    const { fixture, league, teams, goals, score } = item;

    if (!fixture || typeof fixture.id !== 'number') {
      issues.push({ code: 'missing_fixture_id', message: 'Fixture is missing a valid numeric ID' });
      continue;
    }

    if (!teams?.home?.name || !teams?.away?.name) {
      issues.push({ code: 'missing_team_names', message: 'Fixture is missing home or away team name', fixtureId: fixture.id });
      continue;
    }

    const compId = competitionEntry?.competitionId ?? `league-${league?.id ?? 'unknown'}`;
    const compName = competitionEntry?.competitionName ?? league?.name ?? 'Unknown Competition';
    const season = String(competitionEntry?.currentSeason ?? league?.season ?? '2026');

    // Canonical Competition
    if (!compsMap.has(compId)) {
      compsMap.set(compId, {
        competitionId: compId,
        name: compName,
        type: 'club',
        updatedAt: observedAt
      });
      links.push({
        entityType: 'competition',
        entityId: compId,
        provider: 'api-football',
        providerEntityType: 'league',
        providerEntityId: String(league?.id ?? compId),
        confidence: 1.0,
        linkedBy: 'api-football-adapter',
        linkedAt: observedAt
      });
    }

    // Canonical Teams
    const homeTeamSlug = slugify(teams.home.name);
    const awayTeamSlug = slugify(teams.away.name);
    const homeTeamId = `team-${homeTeamSlug}`;
    const awayTeamId = `team-${awayTeamSlug}`;

    if (!teamsMap.has(homeTeamId)) {
      const countryCode = league?.country ? slugify(league.country).slice(0, 3).toUpperCase() : undefined;
      teamsMap.set(homeTeamId, {
        teamId: homeTeamId,
        name: teams.home.name,
        ...(countryCode ? { countryCode } : {}),
        updatedAt: observedAt
      });
      links.push({
        entityType: 'team',
        entityId: homeTeamId,
        provider: 'api-football',
        providerEntityType: 'team',
        providerEntityId: String(teams.home.id),
        confidence: 1.0,
        linkedBy: 'api-football-adapter',
        linkedAt: observedAt
      });
    }

    if (!teamsMap.has(awayTeamId)) {
      const countryCode = league?.country ? slugify(league.country).slice(0, 3).toUpperCase() : undefined;
      teamsMap.set(awayTeamId, {
        teamId: awayTeamId,
        name: teams.away.name,
        ...(countryCode ? { countryCode } : {}),
        updatedAt: observedAt
      });
      links.push({
        entityType: 'team',
        entityId: awayTeamId,
        provider: 'api-football',
        providerEntityType: 'team',
        providerEntityId: String(teams.away.id),
        confidence: 1.0,
        linkedBy: 'api-football-adapter',
        linkedAt: observedAt
      });
    }

    // Kickoff date ISO
    let kickoffUtc = fixture.date;
    try {
      const parsedDate = new Date(kickoffUtc);
      if (Number.isNaN(parsedDate.getTime())) {
        kickoffUtc = new Date(fixture.timestamp * 1000).toISOString();
      } else {
        kickoffUtc = parsedDate.toISOString();
      }
    } catch {
      kickoffUtc = new Date(fixture.timestamp * 1000).toISOString();
    }

    const canonicalStatus = mapApiFootballStatusToCanonical(fixture.status?.short || '');
    const matchId = `match-${compId}-${season}-${fixture.id}`;

    // Score resolution
    let scoreHome: number | null = goals?.home ?? null;
    let scoreAway: number | null = goals?.away ?? null;

    if (canonicalStatus === 'completed') {
      if (scoreHome === null && score?.fulltime?.home !== null) scoreHome = score.fulltime.home;
      if (scoreAway === null && score?.fulltime?.away !== null) scoreAway = score.fulltime.away;
    } else if (canonicalStatus === 'scheduled') {
      scoreHome = null;
      scoreAway = null;
    }

    const canonicalMatch: CanonicalMatch = {
      matchId,
      competitionId: compId,
      season,
      kickoffUtc,
      status: canonicalStatus,
      homeTeamId,
      awayTeamId,
      scoreHome,
      scoreAway,
      ...(fixture.venue?.name ? { venue: fixture.venue.name } : {}),
      ...(league?.round ? { round: league.round } : {}),
      updatedAt: observedAt
    };

    matches.push(canonicalMatch);

    // Provider link for match
    links.push({
      entityType: 'match',
      entityId: matchId,
      provider: 'api-football',
      providerEntityType: 'fixture',
      providerEntityId: String(fixture.id),
      confidence: 1.0,
      linkedBy: 'api-football-adapter',
      linkedAt: observedAt
    });

    // Field Provenance
    provenance.push(
      {
        entityType: 'match',
        entityId: matchId,
        fieldPath: 'status',
        provider: 'api-football',
        providerEntityId: String(fixture.id),
        observedAt,
        confidence: 1.0,
        valueHash: sha256(canonicalStatus)
      },
      {
        entityType: 'match',
        entityId: matchId,
        fieldPath: 'kickoffUtc',
        provider: 'api-football',
        providerEntityId: String(fixture.id),
        observedAt,
        confidence: 1.0,
        valueHash: sha256(kickoffUtc)
      }
    );

    if (scoreHome !== null && scoreAway !== null) {
      provenance.push(
        {
          entityType: 'match',
          entityId: matchId,
          fieldPath: 'scoreHome',
          provider: 'api-football',
          providerEntityId: String(fixture.id),
          observedAt,
          confidence: 1.0,
          valueHash: sha256(String(scoreHome))
        },
        {
          entityType: 'match',
          entityId: matchId,
          fieldPath: 'scoreAway',
          provider: 'api-football',
          providerEntityId: String(fixture.id),
          observedAt,
          confidence: 1.0,
          valueHash: sha256(String(scoreAway))
        }
      );
    }
  }

  return {
    matches,
    teams: Array.from(teamsMap.values()),
    competitions: Array.from(compsMap.values()),
    links,
    provenance,
    issues
  };
}
