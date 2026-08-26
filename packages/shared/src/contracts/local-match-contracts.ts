export type LocalDataSourceId =
  | 'sportscore'
  | 'openfootball'
  | 'manual-snapshot';

export type LocalCompetitionType = 'national-team' | 'club';

export type LocalMatchStatus =
  | 'scheduled'
  | 'completed'
  | 'postponed'
  | 'cancelled'
  | 'unknown';

export interface LocalMatchScore {
  home: number | null;
  away: number | null;
}

export interface LocalMatchSourceRef {
  sourceId: LocalDataSourceId;
  sourceMatchId?: string;
  sourceUrl?: string;
  importedAt: string;
}

export interface LocalCompetitionRef {
  id: string;
  name: string;
  type: LocalCompetitionType;
  season: string;
}

export interface LocalTeamRef {
  id: string;
  name: string;
  countryCode?: string;
}

export interface LocalMatch {
  id: string;
  competition: LocalCompetitionRef;
  kickoffUtc: string;
  status: LocalMatchStatus;
  homeTeam: LocalTeamRef;
  awayTeam: LocalTeamRef;
  score: LocalMatchScore;
  venue?: string;
  round?: string;
  stage?: string;
  neutralVenue?: boolean;
  sourceRefs: LocalMatchSourceRef[];
  updatedAt: string;
}

export interface LocalScoreBreakdown {
  halftime: LocalMatchScore;
  fulltime: LocalMatchScore;
  extratime: LocalMatchScore;
  penalty: LocalMatchScore;
}

export interface LocalMatchTeamStats {
  teamId: string;
  teamName?: string;
  cornerKicks: number | null;
  yellowCards: number | null;
  redCards: number | null;
  totalShots: number | null;
  shotsOnGoal: number | null;
  possessionPercentage: number | null;
  fouls?: number | null;
  offsides?: number | null;
}

export interface LocalMatchLineupPlayer {
  name: string;
  shirtNumber?: number | null;
  position?: string | null;
}

export interface LocalMatchLineup {
  teamId: string;
  teamName?: string;
  formation: string | null;
  starters: LocalMatchLineupPlayer[];
  substitutes: LocalMatchLineupPlayer[];
}

export interface LocalMatchEvent {
  minute: number | null;
  extraMinute?: number | null;
  teamId?: string;
  type: 'goal' | 'card' | 'substitution' | 'penalty' | 'other';
  detail?: string | null;
  player?: string | null;
  assist?: string | null;
  label: string;
}

export interface LocalMatchDetail {
  match: LocalMatch;
  status: LocalMatchStatus;
  elapsedMinute: number | null;
  referee?: string | null;
  scoreBreakdown?: LocalScoreBreakdown;
  events: LocalMatchEvent[];
  teamStats?: LocalMatchTeamStats[];
  lineups?: LocalMatchLineup[];
  warnings?: string[];
  notes?: string[];
  updatedAt: string;
}

export function toProviderNeutralLocalMatch(match: LocalMatch): LocalMatch {
  return {
    id: match.id,
    competition: {
      id: match.competition.id,
      name: match.competition.name,
      type: match.competition.type,
      season: match.competition.season
    },
    kickoffUtc: match.kickoffUtc,
    status: match.status,
    homeTeam: {
      id: match.homeTeam.id,
      name: match.homeTeam.name,
      ...(match.homeTeam.countryCode !== undefined ? { countryCode: match.homeTeam.countryCode } : {})
    },
    awayTeam: {
      id: match.awayTeam.id,
      name: match.awayTeam.name,
      ...(match.awayTeam.countryCode !== undefined ? { countryCode: match.awayTeam.countryCode } : {})
    },
    score: { home: match.score.home, away: match.score.away },
    ...(match.venue !== undefined ? { venue: match.venue } : {}),
    ...(match.round !== undefined ? { round: match.round } : {}),
    ...(match.stage !== undefined ? { stage: match.stage } : {}),
    ...(match.neutralVenue !== undefined ? { neutralVenue: match.neutralVenue } : {}),
    sourceRefs: match.sourceRefs.map(({ sourceId, importedAt }) => ({ sourceId, importedAt })),
    updatedAt: match.updatedAt
  };
}

export interface LocalMatchSnapshotQuery {
  date?: string | undefined;
  competitionId?: string | undefined;
  status?: LocalMatchStatus | undefined;
}


export interface LocalDataSnapshotStatus {
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  matchCount: number;
  competitions: Array<{
    id: string;
    name: string;
    seasons: string[];
    matchCount: number;
  }>;
  sources: LocalMatchSourceRef[];
  freshness: 'fresh' | 'stale' | 'missing';
  warnings: string[];
}

export interface LocalMatchFeedResponse {
  matches: LocalMatch[];
  snapshot: LocalDataSnapshotStatus;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

const ISO_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

function isValidIsoDateTime(val: unknown): boolean {
  return typeof val === 'string' && ISO_DATETIME_REGEX.test(val);
}

function isObject(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val);
}

const VALID_DATA_SOURCES: LocalDataSourceId[] = [
  'sportscore',
  'openfootball',
  'manual-snapshot'
];

const VALID_COMPETITION_TYPES: LocalCompetitionType[] = ['national-team', 'club'];

const VALID_MATCH_STATUSES: LocalMatchStatus[] = [
  'scheduled',
  'completed',
  'postponed',
  'cancelled',
  'unknown'
];

export function validateLocalMatch(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  // Check forbidden fields
  if ('sourceProviderId' in input) {
    errors.push('Forbidden field "sourceProviderId" is present');
  }
  if ('providerFixtureId' in input) {
    errors.push('Forbidden field "providerFixtureId" is present');
  }

  // id
  if (typeof input.id !== 'string' || input.id.trim() === '') {
    errors.push('Field "id" must be a non-empty string');
  }

  // competition
  if (!isObject(input.competition)) {
    errors.push('Field "competition" must be an object');
  } else {
    const comp = input.competition;
    if (typeof comp.id !== 'string' || comp.id.trim() === '') {
      errors.push('competition.id must be a non-empty string');
    }
    if (typeof comp.name !== 'string' || comp.name.trim() === '') {
      errors.push('competition.name must be a non-empty string');
    }
    if (!VALID_COMPETITION_TYPES.includes(comp.type as LocalCompetitionType)) {
      errors.push(`competition.type must be one of: ${VALID_COMPETITION_TYPES.join(', ')}`);
    }
    if (typeof comp.season !== 'string' || comp.season.trim() === '') {
      errors.push('competition.season must be a non-empty string');
    }
  }

  // kickoffUtc
  if (!isValidIsoDateTime(input.kickoffUtc)) {
    errors.push('Field "kickoffUtc" must be a valid ISO datetime string');
  }

  // status
  if (input.status === 'in_play') {
    errors.push('Field "status" cannot be "in_play" in the terminal-only match feed');
  } else if (typeof input.status !== 'string' || !VALID_MATCH_STATUSES.includes(input.status as LocalMatchStatus)) {
    errors.push(`Field "status" must be one of: ${VALID_MATCH_STATUSES.join(', ')}`);
  }

  // homeTeam
  if (!isObject(input.homeTeam)) {
    errors.push('Field "homeTeam" must be an object');
  } else {
    const team = input.homeTeam;
    if (typeof team.id !== 'string' || team.id.trim() === '') {
      errors.push('homeTeam.id must be a non-empty string');
    }
    if (typeof team.name !== 'string' || team.name.trim() === '') {
      errors.push('homeTeam.name must be a non-empty string');
    }
    if (team.countryCode !== undefined && typeof team.countryCode !== 'string') {
      errors.push('homeTeam.countryCode must be a string if provided');
    }
  }

  // awayTeam
  if (!isObject(input.awayTeam)) {
    errors.push('Field "awayTeam" must be an object');
  } else {
    const team = input.awayTeam;
    if (typeof team.id !== 'string' || team.id.trim() === '') {
      errors.push('awayTeam.id must be a non-empty string');
    }
    if (typeof team.name !== 'string' || team.name.trim() === '') {
      errors.push('awayTeam.name must be a non-empty string');
    }
    if (team.countryCode !== undefined && typeof team.countryCode !== 'string') {
      errors.push('awayTeam.countryCode must be a string if provided');
    }
  }

  // score
  if (!isObject(input.score)) {
    errors.push('Field "score" must be an object');
  } else {
    const s = input.score;
    const homeVal = s.home;
    const awayVal = s.away;

    if (homeVal !== null && (typeof homeVal !== 'number' || !Number.isInteger(homeVal) || homeVal < 0)) {
      errors.push('score.home must be a non-negative integer or null');
    }
    if (awayVal !== null && (typeof awayVal !== 'number' || !Number.isInteger(awayVal) || awayVal < 0)) {
      errors.push('score.away must be a non-negative integer or null');
    }

    if (input.status === 'completed') {
      if (homeVal === null || awayVal === null) {
        errors.push('Completed match cannot have null score values');
      }
    }
  }

  // venue
  if (input.venue !== undefined && typeof input.venue !== 'string') {
    errors.push('Field "venue" must be a string if provided');
  }

  // round
  if (input.round !== undefined && typeof input.round !== 'string') {
    errors.push('Field "round" must be a string if provided');
  }

  // stage
  if (input.stage !== undefined && typeof input.stage !== 'string') {
    errors.push('Field "stage" must be a string if provided');
  }

  // neutralVenue
  if (input.neutralVenue !== undefined && typeof input.neutralVenue !== 'boolean') {
    errors.push('Field "neutralVenue" must be a boolean if provided');
  }

  // sourceRefs
  if (!Array.isArray(input.sourceRefs)) {
    errors.push('Field "sourceRefs" must be an array');
  } else {
    input.sourceRefs.forEach((ref, index) => {
      if (!isObject(ref)) {
        errors.push(`sourceRefs[${index}] must be an object`);
      } else {
        if (!VALID_DATA_SOURCES.includes(ref.sourceId as LocalDataSourceId)) {
          errors.push(`sourceRefs[${index}].sourceId must be one of: ${VALID_DATA_SOURCES.join(', ')}`);
        }
        if (ref.sourceMatchId !== undefined && typeof ref.sourceMatchId !== 'string') {
          errors.push(`sourceRefs[${index}].sourceMatchId must be a string if provided`);
        }
        if (ref.sourceUrl !== undefined && typeof ref.sourceUrl !== 'string') {
          errors.push(`sourceRefs[${index}].sourceUrl must be a string if provided`);
        }
        if (!isValidIsoDateTime(ref.importedAt)) {
          errors.push(`sourceRefs[${index}].importedAt must be a valid ISO datetime string`);
        }
      }
    });
  }

  // updatedAt
  if (!isValidIsoDateTime(input.updatedAt)) {
    errors.push('Field "updatedAt" must be a valid ISO datetime string');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateLocalDataSnapshotStatus(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  if (typeof input.snapshotId !== 'string' || input.snapshotId.trim() === '') {
    errors.push('Field "snapshotId" must be a non-empty string');
  }

  if (!isValidIsoDateTime(input.generatedAt)) {
    errors.push('Field "generatedAt" must be a valid ISO datetime string');
  }

  if (!isValidIsoDateTime(input.importedAt)) {
    errors.push('Field "importedAt" must be a valid ISO datetime string');
  }

  if (typeof input.matchCount !== 'number' || !Number.isInteger(input.matchCount) || input.matchCount < 0) {
    errors.push('Field "matchCount" must be a non-negative integer');
  }

  if (!Array.isArray(input.competitions)) {
    errors.push('Field "competitions" must be an array');
  } else {
    input.competitions.forEach((comp, index) => {
      if (!isObject(comp)) {
        errors.push(`competitions[${index}] must be an object`);
      } else {
        if (typeof comp.id !== 'string' || comp.id.trim() === '') {
          errors.push(`competitions[${index}].id must be a non-empty string`);
        }
        if (typeof comp.name !== 'string' || comp.name.trim() === '') {
          errors.push(`competitions[${index}].name must be a non-empty string`);
        }
        if (!Array.isArray(comp.seasons)) {
          errors.push(`competitions[${index}].seasons must be an array`);
        } else {
          comp.seasons.forEach((season, sIdx) => {
            if (typeof season !== 'string' || season.trim() === '') {
              errors.push(`competitions[${index}].seasons[${sIdx}] must be a non-empty string`);
            }
          });
        }
        if (typeof comp.matchCount !== 'number' || !Number.isInteger(comp.matchCount) || comp.matchCount < 0) {
          errors.push(`competitions[${index}].matchCount must be a non-negative integer`);
        }
      }
    });
  }

  if (!Array.isArray(input.sources)) {
    errors.push('Field "sources" must be an array');
  } else {
    input.sources.forEach((ref, index) => {
      if (!isObject(ref)) {
        errors.push(`sources[${index}] must be an object`);
      } else {
        if (!VALID_DATA_SOURCES.includes(ref.sourceId as LocalDataSourceId)) {
          errors.push(`sources[${index}].sourceId must be one of: ${VALID_DATA_SOURCES.join(', ')}`);
        }
        if (ref.sourceMatchId !== undefined && typeof ref.sourceMatchId !== 'string') {
          errors.push(`sources[${index}].sourceMatchId must be a string if provided`);
        }
        if (ref.sourceUrl !== undefined && typeof ref.sourceUrl !== 'string') {
          errors.push(`sources[${index}].sourceUrl must be a string if provided`);
        }
        if (!isValidIsoDateTime(ref.importedAt)) {
          errors.push(`sources[${index}].importedAt must be a valid ISO datetime string`);
        }
      }
    });
  }

  const validFreshness = ['fresh', 'stale', 'missing'];
  if (typeof input.freshness !== 'string' || !validFreshness.includes(input.freshness)) {
    errors.push(`Field "freshness" must be one of: ${validFreshness.join(', ')}`);
  }

  if (!Array.isArray(input.warnings)) {
    errors.push('Field "warnings" must be an array');
  } else {
    input.warnings.forEach((warn, index) => {
      if (typeof warn !== 'string') {
        errors.push(`warnings[${index}] must be a string`);
      }
    });
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

export function validateLocalMatchFeedResponse(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  if (!Array.isArray(input.matches)) {
    errors.push('Field "matches" must be an array');
  } else {
    input.matches.forEach((match, index) => {
      const result = validateLocalMatch(match);
      if (!result.ok) {
        errors.push(...result.errors.map(err => `matches[${index}]: ${err}`));
      }
    });
  }

  if (!isObject(input.snapshot)) {
    errors.push('Field "snapshot" must be an object');
  } else {
    const result = validateLocalDataSnapshotStatus(input.snapshot);
    if (!result.ok) {
      errors.push(...result.errors.map(err => `snapshot: ${err}`));
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

const FORBIDDEN_DETAIL_FIELDS = [
  'providerFixtureId',
  'sourceProviderId',
  'providerUrl',
  'fixtureId',
  'xG',
  'expectedGoals',
  'expected_goals',
  'predictions',
  'odds',
  'sourceMatchId',
  'sourceUrl'
] as const;

const VALID_EVENT_TYPES = ['goal', 'card', 'substitution', 'penalty', 'other'] as const;

function collectNestedForbiddenDetailFields(
  value: unknown,
  path: string,
  errors: string[]
): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNestedForbiddenDetailFields(item, `${path}[${index}]`, errors));
    return;
  }
  if (!isObject(value)) return;

  for (const [key, nestedValue] of Object.entries(value)) {
    const nestedPath = path ? `${path}.${key}` : key;
    if ((FORBIDDEN_DETAIL_FIELDS as readonly string[]).includes(key)) {
      errors.push(`${nestedPath}: Forbidden field "${key}" is present`);
    }
    collectNestedForbiddenDetailFields(nestedValue, nestedPath, errors);
  }
}

export function validateLocalMatchDetail(input: unknown): ValidationResult {
  const errors: string[] = [];

  if (!isObject(input)) {
    return { ok: false, errors: ['Input is not an object'] };
  }

  // Strictly reject forbidden provider/betting/analytical fields in input
  for (const field of FORBIDDEN_DETAIL_FIELDS) {
    if (field in input) {
      errors.push(`Forbidden field "${field}" is present`);
    }
  }
  for (const [key, value] of Object.entries(input)) {
    if (!(FORBIDDEN_DETAIL_FIELDS as readonly string[]).includes(key)) {
      collectNestedForbiddenDetailFields(value, key, errors);
    }
  }

  // match
  if (!('match' in input) || !isObject(input.match)) {
    errors.push('Field "match" must be an object');
  } else {
    for (const field of FORBIDDEN_DETAIL_FIELDS) {
      if (field in input.match) {
        errors.push(`match: Forbidden field "${field}" is present`);
      }
    }
    const matchResult = validateLocalMatch(input.match);
    if (!matchResult.ok) {
      errors.push(...matchResult.errors.map(err => `match: ${err}`));
    }
  }

  // status
  if (input.status === 'in_play') {
    errors.push('Field "status" cannot be "in_play" in the terminal-only match feed');
  } else if (typeof input.status !== 'string' || !VALID_MATCH_STATUSES.includes(input.status as LocalMatchStatus)) {
    errors.push(`Field "status" must be one of: ${VALID_MATCH_STATUSES.join(', ')}`);
  }
  if (isObject(input.match) && typeof input.status === 'string' && input.match.status !== input.status) {
    errors.push('Field "status" must match match.status');
  }

  // elapsedMinute
  if (input.elapsedMinute !== null && (typeof input.elapsedMinute !== 'number' || !Number.isInteger(input.elapsedMinute) || input.elapsedMinute < 0)) {
    errors.push('Field "elapsedMinute" must be a non-negative integer or null');
  }

  // referee
  if (input.referee !== undefined && input.referee !== null && typeof input.referee !== 'string') {
    errors.push('Field "referee" must be a string or null if provided');
  }

  // scoreBreakdown
  if (input.scoreBreakdown !== undefined) {
    if (!isObject(input.scoreBreakdown)) {
      errors.push('Field "scoreBreakdown" must be an object if provided');
    } else {
      for (const field of FORBIDDEN_DETAIL_FIELDS) {
        if (field in input.scoreBreakdown) {
          errors.push(`scoreBreakdown: Forbidden field "${field}" is present`);
        }
      }
      const periods = ['halftime', 'fulltime', 'extratime', 'penalty'] as const;
      for (const period of periods) {
        const p = input.scoreBreakdown[period];
        if (!isObject(p)) {
          errors.push(`scoreBreakdown.${period} must be an object`);
        } else {
          for (const field of FORBIDDEN_DETAIL_FIELDS) {
            if (field in p) {
              errors.push(`scoreBreakdown.${period}: Forbidden field "${field}" is present`);
            }
          }
          const homeVal = p.home;
          const awayVal = p.away;
          if (homeVal !== null && (typeof homeVal !== 'number' || !Number.isInteger(homeVal) || homeVal < 0)) {
            errors.push(`scoreBreakdown.${period}.home must be a non-negative integer or null`);
          }
          if (awayVal !== null && (typeof awayVal !== 'number' || !Number.isInteger(awayVal) || awayVal < 0)) {
            errors.push(`scoreBreakdown.${period}.away must be a non-negative integer or null`);
          }
        }
      }
    }
  }

  // events
  if (!Array.isArray(input.events)) {
    errors.push('Field "events" must be an array');
  } else {
    input.events.forEach((event, index) => {
      if (!isObject(event)) {
        errors.push(`events[${index}] must be an object`);
      } else {
        for (const field of FORBIDDEN_DETAIL_FIELDS) {
          if (field in event) {
            errors.push(`events[${index}]: Forbidden field "${field}" is present`);
          }
        }
        if (event.minute !== null && (typeof event.minute !== 'number' || !Number.isInteger(event.minute) || event.minute < 0)) {
          errors.push(`events[${index}].minute must be a non-negative integer or null`);
        }
        if (event.extraMinute !== undefined && event.extraMinute !== null && (typeof event.extraMinute !== 'number' || !Number.isInteger(event.extraMinute) || event.extraMinute < 0)) {
          errors.push(`events[${index}].extraMinute must be a non-negative integer or null if provided`);
        }
        if (event.teamId !== undefined && (typeof event.teamId !== 'string' || event.teamId.trim() === '')) {
          errors.push(`events[${index}].teamId must be a non-empty string if provided`);
        } else if (
          event.teamId !== undefined &&
          isObject(input.match) &&
          isObject(input.match.homeTeam) &&
          isObject(input.match.awayTeam) &&
          event.teamId !== input.match.homeTeam.id &&
          event.teamId !== input.match.awayTeam.id
        ) {
          errors.push(`events[${index}].teamId must reference the embedded home or away team`);
        }
        if (typeof event.type !== 'string' || !VALID_EVENT_TYPES.includes(event.type as typeof VALID_EVENT_TYPES[number])) {
          errors.push(`events[${index}].type must be one of: ${VALID_EVENT_TYPES.join(', ')}`);
        }
        if (event.detail !== undefined && event.detail !== null && typeof event.detail !== 'string') {
          errors.push(`events[${index}].detail must be a string or null if provided`);
        }
        if (event.player !== undefined && event.player !== null && typeof event.player !== 'string') {
          errors.push(`events[${index}].player must be a string or null if provided`);
        }
        if (event.assist !== undefined && event.assist !== null && typeof event.assist !== 'string') {
          errors.push(`events[${index}].assist must be a string or null if provided`);
        }
        if (typeof event.label !== 'string' || event.label.trim() === '') {
          errors.push(`events[${index}].label must be a non-empty string`);
        }
      }
    });
  }

  // teamStats
  if (input.teamStats !== undefined) {
    if (!Array.isArray(input.teamStats)) {
      errors.push('Field "teamStats" must be an array if provided');
    } else {
      if (input.teamStats.length !== 2) {
        errors.push('Field "teamStats" must contain exactly two canonical team rows if provided');
      }
      input.teamStats.forEach((stat, index) => {
        if (!isObject(stat)) {
          errors.push(`teamStats[${index}] must be an object`);
        } else {
          for (const field of FORBIDDEN_DETAIL_FIELDS) {
            if (field in stat) {
              errors.push(`teamStats[${index}]: Forbidden field "${field}" is present`);
            }
          }
          if (typeof stat.teamId !== 'string' || stat.teamId.trim() === '') {
            errors.push(`teamStats[${index}].teamId must be a non-empty string`);
          } else if (
            isObject(input.match) &&
            isObject(input.match.homeTeam) &&
            isObject(input.match.awayTeam) &&
            stat.teamId !== input.match.homeTeam.id &&
            stat.teamId !== input.match.awayTeam.id
          ) {
            errors.push(`teamStats[${index}].teamId must reference the embedded home or away team`);
          }
          if (stat.teamName !== undefined && typeof stat.teamName !== 'string') {
            errors.push(`teamStats[${index}].teamName must be a string if provided`);
          }
          const statKeys = [
            'cornerKicks',
            'yellowCards',
            'redCards',
            'totalShots',
            'shotsOnGoal',
            'fouls',
            'offsides'
          ] as const;
          for (const key of statKeys) {
            const val = stat[key];
            if (val !== undefined && val !== null && (typeof val !== 'number' || !Number.isInteger(val) || val < 0)) {
              errors.push(`teamStats[${index}].${key} must be a non-negative integer, null, or omitted`);
            }
          }
          const poss = stat.possessionPercentage;
          if (poss !== null && (typeof poss !== 'number' || Number.isNaN(poss) || poss < 0 || poss > 100)) {
            errors.push(`teamStats[${index}].possessionPercentage must be a number between 0 and 100 or null`);
          }
        }
      });
      if (
        isObject(input.match) &&
        isObject(input.match.homeTeam) &&
        isObject(input.match.awayTeam)
      ) {
        const teamIds = new Set(input.teamStats
          .filter(isObject)
          .map((stat) => stat.teamId)
          .filter((teamId): teamId is string => typeof teamId === 'string'));
        if (!teamIds.has(String(input.match.homeTeam.id)) || !teamIds.has(String(input.match.awayTeam.id))) {
          errors.push('Field "teamStats" must include one row for each embedded team');
        }
      }
    }
  }

  // lineups
  if (input.lineups !== undefined) {
    if (!Array.isArray(input.lineups)) {
      errors.push('Field "lineups" must be an array if provided');
    } else {
      if (input.lineups.length !== 2) {
        errors.push('Field "lineups" must contain exactly two canonical team rows if provided');
      }
      input.lineups.forEach((lineup, index) => {
        if (!isObject(lineup)) {
          errors.push(`lineups[${index}] must be an object`);
          return;
        }
        if (typeof lineup.teamId !== 'string' || lineup.teamId.trim() === '') {
          errors.push(`lineups[${index}].teamId must be a non-empty string`);
        } else if (
          isObject(input.match) &&
          isObject(input.match.homeTeam) &&
          isObject(input.match.awayTeam) &&
          lineup.teamId !== input.match.homeTeam.id &&
          lineup.teamId !== input.match.awayTeam.id
        ) {
          errors.push(`lineups[${index}].teamId must reference the embedded home or away team`);
        }
        if (lineup.teamName !== undefined && typeof lineup.teamName !== 'string') {
          errors.push(`lineups[${index}].teamName must be a string if provided`);
        }
        if (lineup.formation !== null && typeof lineup.formation !== 'string') {
          errors.push(`lineups[${index}].formation must be a string or null`);
        }
        for (const group of ['starters', 'substitutes'] as const) {
          const players = lineup[group];
          if (!Array.isArray(players)) {
            errors.push(`lineups[${index}].${group} must be an array`);
            continue;
          }
          players.forEach((player, playerIndex) => {
            if (!isObject(player)) {
              errors.push(`lineups[${index}].${group}[${playerIndex}] must be an object`);
              return;
            }
            if (typeof player.name !== 'string' || player.name.trim() === '') {
              errors.push(`lineups[${index}].${group}[${playerIndex}].name must be a non-empty string`);
            }
            if (
              player.shirtNumber !== undefined &&
              player.shirtNumber !== null &&
              (typeof player.shirtNumber !== 'number' || !Number.isInteger(player.shirtNumber) || player.shirtNumber < 0)
            ) {
              errors.push(`lineups[${index}].${group}[${playerIndex}].shirtNumber must be a non-negative integer or null if provided`);
            }
            if (player.position !== undefined && player.position !== null && typeof player.position !== 'string') {
              errors.push(`lineups[${index}].${group}[${playerIndex}].position must be a string or null if provided`);
            }
          });
        }
      });
      if (
        isObject(input.match) &&
        isObject(input.match.homeTeam) &&
        isObject(input.match.awayTeam)
      ) {
        const teamIds = new Set(input.lineups
          .filter(isObject)
          .map((lineup) => lineup.teamId)
          .filter((teamId): teamId is string => typeof teamId === 'string'));
        if (!teamIds.has(String(input.match.homeTeam.id)) || !teamIds.has(String(input.match.awayTeam.id))) {
          errors.push('Field "lineups" must include one row for each embedded team');
        }
      }
    }
  }

  // warnings
  if (input.warnings !== undefined) {
    if (!Array.isArray(input.warnings)) {
      errors.push('Field "warnings" must be an array if provided');
    } else {
      input.warnings.forEach((warn, index) => {
        if (typeof warn !== 'string') {
          errors.push(`warnings[${index}] must be a string`);
        }
      });
    }
  }

  // notes
  if (input.notes !== undefined) {
    if (!Array.isArray(input.notes)) {
      errors.push('Field "notes" must be an array if provided');
    } else {
      input.notes.forEach((note, index) => {
        if (typeof note !== 'string') {
          errors.push(`notes[${index}] must be a string`);
        }
      });
    }
  }

  // updatedAt
  if (!isValidIsoDateTime(input.updatedAt)) {
    errors.push('Field "updatedAt" must be a valid ISO datetime string');
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
