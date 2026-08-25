import { createHash } from 'node:crypto';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalMatchStatus,
  CanonicalTeam,
  FieldProvenance,
  LocalMatch,
  LocalMatchDetail,
  LocalMatchEvent,
  LocalMatchTeamStats,
  LocalScoreBreakdown,
  ProviderLink
} from '@miraichi/shared';
import { toProviderNeutralLocalMatch } from '@miraichi/shared';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  type ApiFootballCompetitionEntry
} from '@miraichi/config';
import type {
  ApiFootballFixtureItem,
  ApiFootballEventItem,
  ApiFootballStatisticItem
} from './api-football-client.js';

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

export interface AdaptApiFootballMatchDetailInput {
  fixtureItem: ApiFootballFixtureItem;
  canonicalMatch: LocalMatch;
  observedAt: string;
}

export function mapApiFootballEventType(
  rawType: string | undefined | null,
  rawDetail?: string | undefined | null
): LocalMatchEvent['type'] {
  const normalized = (rawType || '').trim().toLowerCase();
  const normalizedDetail = (rawDetail || '').trim().toLowerCase();
  if (normalized === 'penalty' || normalizedDetail.includes('penalty')) {
    return 'penalty';
  }
  if (normalized === 'goal') {
    return 'goal';
  }
  if (normalized === 'card') {
    return 'card';
  }
  if (normalized === 'subst' || normalized === 'sub' || normalized === 'substitution') {
    return 'substitution';
  }
  return 'other';
}

function findStatValue(
  stats: Array<{ type: string; value: string | number | null }>,
  typeName: string
): string | number | null {
  const target = typeName.toLowerCase().trim();
  const item = stats.find((s) => s.type?.toLowerCase().trim() === target);
  return item ? item.value : null;
}

function parseNullableInt(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  if (typeof val === 'number') {
    return Number.isInteger(val) && val >= 0 ? val : null;
  }
  const normalized = String(val).trim();
  if (!/^\d+$/u.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function parseNullablePossession(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') {
    return null;
  }
  if (typeof val === 'number') {
    if (Number.isNaN(val) || val < 0 || val > 100) return null;
    return val;
  }
  const str = String(val).trim();
  const match = str.match(/^(\d+(?:\.\d+)?)%?$/u);
  if (!match) return null;
  const num = Number(match[1]);
  if (Number.isNaN(num) || num < 0 || num > 100) {
    return null;
  }
  return num;
}

export function adaptApiFootballMatchDetail(input: AdaptApiFootballMatchDetailInput): LocalMatchDetail {
  const { fixtureItem, canonicalMatch, observedAt } = input;
  const status = canonicalMatch.status;
  const detailMatch = toProviderNeutralLocalMatch(canonicalMatch);
  const referee = fixtureItem.fixture?.referee ?? null;
  const elapsedMinute = fixtureItem.fixture?.status?.elapsed ?? null;

  const scoreBreakdown: LocalScoreBreakdown = {
    halftime: {
      home: fixtureItem.score?.halftime?.home ?? null,
      away: fixtureItem.score?.halftime?.away ?? null
    },
    fulltime: {
      home: fixtureItem.score?.fulltime?.home ?? null,
      away: fixtureItem.score?.fulltime?.away ?? null
    },
    extratime: {
      home: fixtureItem.score?.extratime?.home ?? null,
      away: fixtureItem.score?.extratime?.away ?? null
    },
    penalty: {
      home: fixtureItem.score?.penalty?.home ?? null,
      away: fixtureItem.score?.penalty?.away ?? null
    }
  };

  let eventsPartial = false;
  const events: LocalMatchEvent[] = (fixtureItem.events ?? []).map((event) => {
    const minute = parseNullableInt(event.time?.elapsed);
    const extraMinute = parseNullableInt(event.time?.extra);
    if ((event.time?.elapsed !== null && event.time?.elapsed !== undefined && minute === null) ||
      (event.time?.extra !== null && event.time?.extra !== undefined && extraMinute === null)) {
      eventsPartial = true;
    }

    let teamId: string | undefined;
    if (fixtureItem.teams?.home?.id !== undefined && event.team?.id === fixtureItem.teams.home.id) {
      teamId = canonicalMatch.homeTeam.id;
    } else if (fixtureItem.teams?.away?.id !== undefined && event.team?.id === fixtureItem.teams.away.id) {
      teamId = canonicalMatch.awayTeam.id;
    } else {
      eventsPartial = true;
    }

    const type = mapApiFootballEventType(event.type, event.detail);
    const detail = event.detail ?? null;
    const player = event.player?.name ?? null;
    const assist = event.assist?.name ?? null;

    const timeStr = minute !== null && minute !== undefined ? `${minute}${extraMinute ? `+${extraMinute}` : ''}'` : '';
    const desc = detail || type || 'Event';
    const playerDesc = player || 'Unknown';
    const assistDesc = assist
      ? type === 'substitution' ? ` (In: ${assist})` : ` (Assist: ${assist})`
      : '';
    const label = timeStr ? `${timeStr} ${desc} - ${playerDesc}${assistDesc}` : `${desc} - ${playerDesc}${assistDesc}`;

    return {
      minute,
      ...(extraMinute !== null ? { extraMinute } : {}),
      ...(teamId !== undefined ? { teamId } : {}),
      type,
      detail,
      player,
      assist,
      label
    };
  });

  const providerStats = fixtureItem.statistics ?? [];
  let statisticsPartial = providerStats.length > 0 && providerStats.some((row) => (
    row.team.id !== fixtureItem.teams.home.id && row.team.id !== fixtureItem.teams.away.id
  ));
  const teamStats: LocalMatchTeamStats[] = [
    {
      providerTeamId: fixtureItem.teams.home.id,
      teamId: canonicalMatch.homeTeam.id,
      teamName: canonicalMatch.homeTeam.name
    },
    {
      providerTeamId: fixtureItem.teams.away.id,
      teamId: canonicalMatch.awayTeam.id,
      teamName: canonicalMatch.awayTeam.name
    }
  ].map(({ providerTeamId, teamId, teamName }) => {
      const statItem = providerStats.find((row) => row.team.id === providerTeamId);
      const stats = statItem?.statistics ?? [];
      const cornerKicks = parseNullableInt(findStatValue(stats, 'Corner Kicks'));
      const yellowCards = parseNullableInt(findStatValue(stats, 'Yellow Cards'));
      const redCards = parseNullableInt(findStatValue(stats, 'Red Cards'));
      const totalShots = parseNullableInt(findStatValue(stats, 'Total Shots'));
      const shotsOnGoal = parseNullableInt(findStatValue(stats, 'Shots on Goal'));
      const possessionPercentage = parseNullablePossession(findStatValue(stats, 'Ball Possession'));

      if (!statItem || [cornerKicks, yellowCards, redCards, totalShots, shotsOnGoal, possessionPercentage].some((value) => value === null)) {
        statisticsPartial = true;
      }

      return {
        teamId,
        teamName,
        cornerKicks,
        yellowCards,
        redCards,
        totalShots,
        shotsOnGoal,
        possessionPercentage
      };
    });

  const warnings: string[] = [];
  if (status === 'completed') {
    if (!fixtureItem.statistics || fixtureItem.statistics.length === 0) {
      warnings.push('statistics_unavailable');
    } else if (statisticsPartial) {
      warnings.push('statistics_partial');
    }
    if (!fixtureItem.events || fixtureItem.events.length === 0) {
      warnings.push('events_unavailable');
    } else if (eventsPartial) {
      warnings.push('events_partial');
    }
  }

  return {
    match: detailMatch,
    status,
    elapsedMinute,
    referee,
    scoreBreakdown,
    events,
    teamStats,
    warnings,
    notes: [],
    updatedAt: observedAt
  };
}
