import { SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE } from './fixture-enrichment-probe.js';
import type { SportmonksLeagueCaptureInventory } from './league-capture-inventory.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export type SportmonksLeagueCaptureGroup = 'season' | 'fixture' | 'team' | 'ai';

export interface SportmonksLeagueCaptureRequest {
  endpointKey: string;
  group: SportmonksLeagueCaptureGroup;
  urlPath: string;
  query: Record<string, string>;
  paginated: boolean;
  fixtureId?: number;
  teamId?: number;
  seasonId?: number;
}

// ─── Non-paginated endpoint keys ─────────────────────────────────────────────

const NON_PAGINATED_KEYS = new Set([
  'fixtures.enrichedById',
  'commentaries.byFixtureId',
  'squads.bySeasonAndTeamId',
  'venues.bySeasonId'
]);

// ─── Main exported function ───────────────────────────────────────────────────

/**
 * Convert a `SportmonksLeagueCaptureInventory` into the exact set of Sportmonks
 * requests needed to capture all useful non-live league data.
 *
 * Groups are emitted in deterministic order: season → fixture → team → ai.
 * Within each group, results are sorted by (seasonId | fixtureId | teamId, endpointKey).
 *
 * @param inventory  Result of `buildSportmonksLeagueCaptureInventory`.
 * @param groups     Optional filter — only requests in these groups are returned.
 */
export function buildSportmonksLeagueCaptureRequests(
  inventory: SportmonksLeagueCaptureInventory,
  groups?: SportmonksLeagueCaptureGroup[]
): SportmonksLeagueCaptureRequest[] {
  const selectedGroups: Set<SportmonksLeagueCaptureGroup> =
    groups !== undefined && groups.length > 0
      ? new Set(groups)
      : new Set(['season', 'fixture', 'team', 'ai']);

  const requests: SportmonksLeagueCaptureRequest[] = [];

  // ── SEASON group ──────────────────────────────────────────────────────────
  if (selectedGroups.has('season')) {
    const seasonRequests: SportmonksLeagueCaptureRequest[] = [];

    for (const season of inventory.seasons) {
      const sid = season.seasonId;

      seasonRequests.push(
        make('schedules.bySeasonId', 'season', `/schedules/seasons/${sid}`, {}, sid),
        make('topscorers.bySeasonId', 'season', `/topscorers/seasons/${sid}`, {}, sid),
        make('standings.bySeasonId', 'season', `/standings/seasons/${sid}`, {
          include: 'participant;league;season;stage;round;details.type;rule'
        }, sid)
      );
    }

    sortByKey(seasonRequests, (r) => `${r.seasonId ?? 0}:${r.endpointKey}`);
    requests.push(...seasonRequests);
  }

  // ── FIXTURE group ─────────────────────────────────────────────────────────
  if (selectedGroups.has('fixture')) {
    const fixtureRequests: SportmonksLeagueCaptureRequest[] = [];

    for (const fid of inventory.fixtureIds) {
      fixtureRequests.push(
        makeFixture('fixtures.enrichedById', `/fixtures/${fid}`, {
          include: SPORTMONKS_NON_LIVE_FIXTURE_INCLUDE
        }, fid),
        makeFixture('odds.prematchByFixtureId', `/odds/pre-match/fixtures/${fid}`, {
          include: 'market;bookmaker;fixture'
        }, fid),
        makeFixture('predictions.probabilitiesByFixtureId', `/predictions/probabilities/fixtures/${fid}`, {
          include: 'type;fixture'
        }, fid),
        makeFixture('predictions.valueBetsByFixtureId', `/predictions/value-bets/fixtures/${fid}`, {
          include: 'type;fixture'
        }, fid)
      );
    }

    sortByKey(fixtureRequests, (r) => `${r.fixtureId ?? 0}:${r.endpointKey}`);
    requests.push(...fixtureRequests);
  }

  // ── TEAM group ────────────────────────────────────────────────────────────
  if (selectedGroups.has('team')) {
    const teamRequests: SportmonksLeagueCaptureRequest[] = [];

    for (const tid of inventory.teamIds) {
      teamRequests.push(
        makeTeam('statistics.byTeamId', `/statistics/seasons/teams/${tid}`, {
          include: 'season;details.type',
          filters: `seasonLeagues:${inventory.leagueId}`
        }, tid)
      );
    }

    // squads are per (season, team) pair
    for (const ts of inventory.teamSeasons) {
      teamRequests.push(
        makeTeamSeason('squads.bySeasonAndTeamId', `/squads/seasons/${ts.seasonId}/teams/${ts.teamId}`, {
          include: 'player;team;season;details;position'
        }, ts.teamId, ts.seasonId)
      );
    }

    sortByKey(teamRequests, (r) => `${r.teamId ?? 0}:${r.seasonId ?? 0}:${r.endpointKey}`);
    requests.push(...teamRequests);
  }

  // ── AI group ──────────────────────────────────────────────────────────────
  if (selectedGroups.has('ai')) {
    const aiRequests: SportmonksLeagueCaptureRequest[] = [];

    // League-level AI endpoints
    aiRequests.push(
      make('predictions.predictabilityByLeagueId', 'ai', `/predictions/predictability/leagues/${inventory.leagueId}`, {
        include: 'type;fixture'
      }),
      make('matchFacts.byLeagueId', 'ai', `/match-facts/leagues/${inventory.leagueId}`, {
        include: 'type;fixture'
      })
    );

    sortByKey(aiRequests, (r) => r.endpointKey);
    requests.push(...aiRequests);
  }

  return requests;
}

// ─── Builder helpers ──────────────────────────────────────────────────────────

function make(
  endpointKey: string,
  group: SportmonksLeagueCaptureGroup,
  urlPath: string,
  query: Record<string, string>,
  seasonId?: number
): SportmonksLeagueCaptureRequest {
  const req: SportmonksLeagueCaptureRequest = {
    endpointKey,
    group,
    urlPath,
    query,
    paginated: !NON_PAGINATED_KEYS.has(endpointKey)
  };
  if (seasonId !== undefined) req.seasonId = seasonId;
  return req;
}

function makeFixture(
  endpointKey: string,
  urlPath: string,
  query: Record<string, string>,
  fixtureId: number
): SportmonksLeagueCaptureRequest {
  return {
    endpointKey,
    group: 'fixture',
    urlPath,
    query,
    paginated: !NON_PAGINATED_KEYS.has(endpointKey),
    fixtureId
  };
}

function makeTeam(
  endpointKey: string,
  urlPath: string,
  query: Record<string, string>,
  teamId: number
): SportmonksLeagueCaptureRequest {
  return {
    endpointKey,
    group: 'team',
    urlPath,
    query,
    paginated: !NON_PAGINATED_KEYS.has(endpointKey),
    teamId
  };
}

function makeTeamSeason(
  endpointKey: string,
  urlPath: string,
  query: Record<string, string>,
  teamId: number,
  seasonId: number
): SportmonksLeagueCaptureRequest {
  return {
    endpointKey,
    group: 'team',
    urlPath,
    query,
    paginated: !NON_PAGINATED_KEYS.has(endpointKey),
    teamId,
    seasonId
  };
}

function sortByKey<T>(arr: T[], key: (item: T) => string): void {
  arr.sort((a, b) => key(a).localeCompare(key(b)));
}
