import { createHash } from 'node:crypto';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalMatchStatus,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry
} from '@miraichi/config';
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
  expectedSeason?: number;
  registry?: readonly ApiFootballCompetitionEntry[];
  fixtures: readonly ApiFootballFixtureItem[];
  observedAt: string;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
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
      return 'scheduled';
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
  const { fixtures, observedAt } = input;
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

    let entry: ApiFootballCompetitionEntry | undefined = input.competitionEntry;
    if (entry) {
      if (typeof league?.id === 'number' && league.id !== entry.providerLeagueId) {
        issues.push({
          code: 'league_id_mismatch',
          message: `Fixture league ID ${league.id} does not match expected entry provider league ID ${entry.providerLeagueId}`,
          fixtureId: fixture.id
        });
        continue;
      }
    } else {
      const registry = input.registry ?? API_FOOTBALL_COMPETITION_REGISTRY;
      entry = registry.find((r) => r.providerLeagueId === league?.id);
      if (!entry) {
        issues.push({
          code: 'unregistered_league',
          message: `Fixture league ID ${league?.id} is not registered in competition registry`,
          fixtureId: fixture.id
        });
        continue;
      }
    }

    if (input.expectedSeason !== undefined && league?.season !== input.expectedSeason) {
      issues.push({
        code: 'season_mismatch',
        message: `Fixture season ${String(league?.season)} does not match expected season ${input.expectedSeason}`,
        fixtureId: fixture.id
      });
      continue;
    }

    const compId = entry.competitionId;
    const compName = entry.competitionName;
    const compType = entry.competitionType;
    const season = String(league?.season ?? input.expectedSeason ?? entry.currentSeason);

    // Canonical Competition
    if (!compsMap.has(compId)) {
      compsMap.set(compId, {
        competitionId: compId,
        name: compName,
        type: compType,
        updatedAt: observedAt
      });
      links.push({
        entityType: 'competition',
        entityId: compId,
        provider: 'api-football',
        providerEntityType: 'league',
        providerEntityId: String(entry.providerLeagueId),
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
    const normalizedRound = slugify(league?.round || '');
    const matchHash = sha256(`${compId}|${season}|${normalizedRound}|${homeTeamId}|${awayTeamId}`).slice(0, 16);
    const matchId = `match-${matchHash}`;

    // Score resolution
    let scoreHome: number | null = null;
    let scoreAway: number | null = null;

    if (canonicalStatus === 'completed') {
      scoreHome = goals?.home ?? null;
      scoreAway = goals?.away ?? null;

      if (scoreHome === null) {
        if (score?.fulltime?.home !== null && score?.fulltime?.home !== undefined) {
          scoreHome = score.fulltime.home;
        } else if (score?.halftime?.home !== null && score?.halftime?.home !== undefined) {
          scoreHome = score.halftime.home;
        }
      }
      if (scoreAway === null) {
        if (score?.fulltime?.away !== null && score?.fulltime?.away !== undefined) {
          scoreAway = score.fulltime.away;
        } else if (score?.halftime?.away !== null && score?.halftime?.away !== undefined) {
          scoreAway = score.halftime.away;
        }
      }
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
