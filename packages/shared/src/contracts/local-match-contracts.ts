export type LocalDataSourceId =
  | 'openfootball'
  | 'sofascore-local'
  | 'football-data-org'
  | 'international-results'
  | 'manual-snapshot'
  | 'sportmonks';

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
  type: 'national-team';
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

export interface LocalMatchEvent {
  minute: number | null;
  teamId?: string;
  type: 'goal' | 'card' | 'substitution' | 'penalty' | 'other';
  label: string;
}

export interface LocalMatchDetail {
  match: LocalMatch;
  referee?: string | undefined;
  events: LocalMatchEvent[];
  notes: string[];
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
  'openfootball',
  'sofascore-local',
  'football-data-org',
  'international-results',
  'manual-snapshot',
  'sportmonks'
];

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
    if (comp.type !== 'national-team') {
      errors.push('competition.type must be "national-team"');
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
    errors.push('Field "status" cannot be "in_play" in Phase 9');
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
