export type OpenFootballRepository =
  | 'england'
  | 'europe'
  | 'champions-league'
  | 'world'
  | 'worldcup';

export interface OpenFootballCompetitionSource {
  entryId: string;
  sourceId: 'openfootball';
  origin: 'https://raw.githubusercontent.com';
  competitionId: string;
  competitionName: string;
  expectedCompetitionHeader: string;
  competitionType: 'club' | 'national-team';
  repository: OpenFootballRepository;
  ref: 'master';
  filePath: string;
  season: string;
  sourceTimezone: string;
  refreshIntervalMinutes: number;
  maxPayloadBytes: number;
  minimumExpectedMatches: number;
  maximumMissingRatio: number;
  enabled: boolean;
}

const OPENFOOTBALL_REPOSITORIES = new Set<OpenFootballRepository>([
  'england',
  'europe',
  'champions-league',
  'world',
  'worldcup'
]);

export const OPENFOOTBALL_SOURCE_REGISTRY: readonly OpenFootballCompetitionSource[] = Object.freeze([
  {
    entryId: 'openfootball-england-premier-league-2026-27',
    sourceId: 'openfootball',
    origin: 'https://raw.githubusercontent.com',
    competitionId: 'eng-premier-league',
    competitionName: 'English Premier League',
    expectedCompetitionHeader: 'English Premier League 2026/27',
    competitionType: 'club',
    repository: 'england',
    ref: 'master',
    filePath: '2026-27/1-premierleague.txt',
    season: '2026-27',
    sourceTimezone: 'Europe/London',
    refreshIntervalMinutes: 360,
    maxPayloadBytes: 1_048_576,
    minimumExpectedMatches: 300,
    maximumMissingRatio: 0.05,
    enabled: true
  },
  {
    entryId: 'openfootball-world-cup-2026-group-stage',
    sourceId: 'openfootball',
    origin: 'https://raw.githubusercontent.com',
    competitionId: 'world-cup-2026',
    competitionName: 'World Cup',
    expectedCompetitionHeader: 'World Cup 2026',
    competitionType: 'national-team',
    repository: 'worldcup',
    ref: 'master',
    filePath: '2026--canada-usa-mexico/cup.txt',
    season: '2026',
    sourceTimezone: 'America/New_York',
    refreshIntervalMinutes: 360,
    maxPayloadBytes: 1_048_576,
    minimumExpectedMatches: 60,
    maximumMissingRatio: 0.05,
    enabled: true
  }
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function hasValidIanaTimezone(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validateFilePath(filePath: unknown, index: number, errors: string[]): void {
  if (!isNonEmptyString(filePath)) {
    errors.push(`entries[${index}].filePath must be a non-empty string`);
    return;
  }
  if (filePath.includes('\\')) {
    errors.push(`entries[${index}].filePath must not contain backslashes`);
  }
  if (filePath.includes('%')) {
    errors.push(`entries[${index}].filePath must not contain percent-encoded URL escapes`);
  }
  if (filePath.startsWith('/')) {
    errors.push(`entries[${index}].filePath must not have a leading slash`);
  }
  if (filePath.split('/').some((segment) => segment === '.' || segment === '..')) {
    errors.push(`entries[${index}].filePath must not contain dot or path traversal segments`);
  }
  if (filePath.includes('?') || filePath.includes('#')) {
    errors.push(`entries[${index}].filePath must not contain query or hash characters`);
  }
  if (!filePath.endsWith('.txt')) {
    errors.push(`entries[${index}].filePath must end with .txt`);
  }
}

export function validateOpenFootballSourceRegistry(entries: readonly unknown[]): string[] {
  const errors: string[] = [];
  const entryIds = new Set<string>();
  const fileTargets = new Set<string>();
  let enabledEntries = 0;

  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`entries[${index}] must be an object`);
      return;
    }

    if (!isNonEmptyString(entry.entryId)) {
      errors.push(`entries[${index}].entryId must be a non-empty string`);
    } else if (entryIds.has(entry.entryId)) {
      errors.push(`entries[${index}] has a duplicate entryId`);
    } else {
      entryIds.add(entry.entryId);
    }

    if (entry.sourceId !== 'openfootball') {
      errors.push(`entries[${index}].sourceId must be openfootball`);
    }
    if (entry.origin !== 'https://raw.githubusercontent.com') {
      errors.push(`entries[${index}].origin must use HTTPS raw.githubusercontent.com`);
    }
    if (!isNonEmptyString(entry.competitionId)) {
      errors.push(`entries[${index}].competitionId must be a non-empty string`);
    }
    if (!isNonEmptyString(entry.competitionName)) {
      errors.push(`entries[${index}].competitionName must be a non-empty string`);
    }
    if (!isNonEmptyString(entry.expectedCompetitionHeader)) {
      errors.push(`entries[${index}].expectedCompetitionHeader must be a non-empty string`);
    }
    if (entry.competitionType !== 'club' && entry.competitionType !== 'national-team') {
      errors.push(`entries[${index}].competitionType must be club or national-team`);
    }
    if (typeof entry.repository !== 'string' || !OPENFOOTBALL_REPOSITORIES.has(entry.repository as OpenFootballRepository)) {
      errors.push(`entries[${index}].repository must be an approved OpenFootball repository`);
    }
    if (entry.ref !== 'master') {
      errors.push(`entries[${index}].ref must be master`);
    }
    validateFilePath(entry.filePath, index, errors);
    if (typeof entry.repository === 'string' && typeof entry.ref === 'string' && typeof entry.filePath === 'string') {
      const target = `${entry.repository}/${entry.ref}/${entry.filePath}`;
      if (fileTargets.has(target)) {
        errors.push(`entries[${index}] has a duplicate repository/ref/filePath`);
      } else {
        fileTargets.add(target);
      }
    }
    if (!isNonEmptyString(entry.season)) {
      errors.push(`entries[${index}].season must be a non-empty string`);
    }
    if (!hasValidIanaTimezone(entry.sourceTimezone)) {
      errors.push(`entries[${index}].sourceTimezone must be a valid IANA timezone`);
    }
    if (!Number.isInteger(entry.refreshIntervalMinutes) || (entry.refreshIntervalMinutes as number) < 360) {
      errors.push(`entries[${index}].refreshIntervalMinutes must be an integer of at least 360`);
    }
    if (!Number.isInteger(entry.maxPayloadBytes) || (entry.maxPayloadBytes as number) < 1 || (entry.maxPayloadBytes as number) > 1_048_576) {
      errors.push(`entries[${index}].maxPayloadBytes must be an integer from 1 through 1048576`);
    }
    if (!Number.isInteger(entry.minimumExpectedMatches) || (entry.minimumExpectedMatches as number) < 1) {
      errors.push(`entries[${index}].minimumExpectedMatches must be an integer of at least 1`);
    }
    if (typeof entry.maximumMissingRatio !== 'number' || entry.maximumMissingRatio < 0 || entry.maximumMissingRatio > 0.05) {
      errors.push(`entries[${index}].maximumMissingRatio must be between 0 and 0.05`);
    }
    if (typeof entry.enabled !== 'boolean') {
      errors.push(`entries[${index}].enabled must be a boolean`);
    } else if (entry.enabled) {
      enabledEntries += 1;
    }
  });

  if (enabledEntries === 0) {
    errors.push('The registry must contain at least one enabled entry');
  }

  return errors;
}

export function buildOpenFootballRawUrl(entry: OpenFootballCompetitionSource): string {
  const errors = validateOpenFootballSourceRegistry([entry]);
  if (errors.length > 0) {
    throw new Error(`Invalid OpenFootball source entry: ${errors.join('; ')}`);
  }

  const expectedPathname = `/openfootball/${entry.repository}/${entry.ref}/${entry.filePath}`;
  const expectedPrefix = `/openfootball/${entry.repository}/${entry.ref}/`;
  const url = new URL(expectedPathname, entry.origin);

  if (
    url.origin !== entry.origin ||
    !url.pathname.startsWith(expectedPrefix) ||
    url.pathname !== expectedPathname ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('OpenFootball raw URL escaped its approved origin or pathname');
  }

  return url.toString();
}
