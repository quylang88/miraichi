import {
  toProviderNeutralLocalMatch,
  validateLocalMatchDetail,
  type LocalMatch,
  type LocalMatchDetail,
  type LocalMatchEvent,
  type LocalMatchLineup,
  type LocalMatchLineupPlayer,
  type LocalMatchTeamStats,
  type LocalScoreBreakdown
} from '@miraichi/shared';
import { mapSportScoreStatus } from './sportscore-adapter.js';
import type { SportScoreMatchResponse } from './sportscore-response-contract.js';

export type SportScoreMatchDetailAdapterErrorCode =
  | 'unavailable'
  | 'non_terminal'
  | 'identity_mismatch'
  | 'invalid';

export class SportScoreMatchDetailAdapterError extends Error {
  readonly code: SportScoreMatchDetailAdapterErrorCode;

  constructor(code: SportScoreMatchDetailAdapterErrorCode, message: string) {
    super(message);
    this.name = 'SportScoreMatchDetailAdapterError';
    this.code = code;
  }
}

export interface AdaptSportScoreMatchDetailInput {
  response: SportScoreMatchResponse;
  canonicalMatch: LocalMatch;
  expectedSlug: string;
  observedAt: string;
}

type JsonObject = Record<string, unknown>;
type Side = 'home' | 'away';

const STAT_ALIASES = {
  cornerKicks: ['cornerKicks', 'corners', 'corner_kicks'],
  yellowCards: ['yellowCards', 'yellow_cards'],
  redCards: ['redCards', 'red_cards'],
  totalShots: ['totalShots', 'shots', 'total_shots'],
  shotsOnGoal: ['shotsOnGoal', 'shots_on_goal', 'shotsOnTarget', 'shots_on_target'],
  possessionPercentage: ['possessionPercentage', 'possession', 'ballPossession', 'ball_possession'],
  fouls: ['fouls', 'foulsCommitted', 'fouls_committed'],
  offsides: ['offsides', 'offside']
} as const;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function firstValue(record: JsonObject, keys: readonly string[]): unknown {
  for (const key of keys) {
    if (record[key] !== undefined) return record[key];
  }
  return undefined;
}

function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim();
  return cleaned === '' ? undefined : cleaned;
}

function numberValue(value: unknown, integer = true): number | null {
  const normalized = typeof value === 'string'
    ? value.trim().replace(/%$/u, '')
    : value;
  if (normalized === '' || normalized === null || normalized === undefined) return null;
  const parsed = typeof normalized === 'number' ? normalized : Number(normalized);
  if (!Number.isFinite(parsed) || parsed < 0 || (integer && !Number.isInteger(parsed))) return null;
  return parsed;
}

function scoreValue(value: unknown): number | null {
  return numberValue(value, true);
}

function recordValue(record: JsonObject, keys: readonly string[]): JsonObject | undefined {
  const value = firstValue(record, keys);
  return isObject(value) ? value : undefined;
}

function arrayValue(record: JsonObject, keys: readonly string[]): unknown[] | undefined {
  const value = firstValue(record, keys);
  return Array.isArray(value) ? value : undefined;
}

function normalizeName(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

function sideFromValue(value: unknown, match: LocalMatch): Side | undefined {
  if (typeof value === 'string') {
    const normalized = normalizeName(value).replace(/[\s-]+/gu, '_');
    if (normalized === 'home' || normalized === 'host' || normalized === '1') return 'home';
    if (normalized === 'away' || normalized === 'visitor' || normalized === '2') return 'away';
    if (
      normalized === normalizeName(match.homeTeam.name).replace(/[\s-]+/gu, '_') ||
      value === match.homeTeam.id
    ) return 'home';
    if (
      normalized === normalizeName(match.awayTeam.name).replace(/[\s-]+/gu, '_') ||
      value === match.awayTeam.id
    ) return 'away';
  }
  if (isObject(value)) {
    return sideFromValue(
      firstValue(value, ['side', 'homeAway', 'home_away', 'name', 'teamName', 'team_name']),
      match
    );
  }
  return undefined;
}

function teamIdForSide(side: Side | undefined, match: LocalMatch): string | undefined {
  if (side === 'home') return match.homeTeam.id;
  if (side === 'away') return match.awayTeam.id;
  return undefined;
}

function readEventSide(raw: JsonObject, match: LocalMatch): Side | undefined {
  return sideFromValue(
    firstValue(raw, ['side', 'homeAway', 'home_away', 'team', 'teamName', 'team_name']),
    match
  );
}

function eventType(value: unknown): LocalMatchEvent['type'] {
  const normalized = cleanString(value)?.toLowerCase().replace(/[\s-]+/gu, '_') ?? '';
  if (normalized.includes('goal') && !normalized.includes('disallowed')) return 'goal';
  if (normalized.includes('penalty')) return 'penalty';
  if (normalized.includes('card') || normalized === 'yellow' || normalized === 'red') return 'card';
  if (normalized.includes('substitution') || normalized === 'sub') return 'substitution';
  return 'other';
}

function adaptEvents(rawMatch: JsonObject, match: LocalMatch): {
  events: LocalMatchEvent[];
  warning?: string;
} {
  const rawEvents = arrayValue(rawMatch, ['events', 'timeline', 'incidents']);
  if (!rawEvents) return { events: [], warning: 'events_unavailable' };

  const events = rawEvents.flatMap((value): LocalMatchEvent[] => {
    if (!isObject(value)) return [];
    const type = eventType(firstValue(value, ['type', 'eventType', 'event_type', 'incidentType']));
    const minute = numberValue(firstValue(value, ['minute', 'time', 'elapsed']));
    const extraMinute = numberValue(firstValue(value, ['extraMinute', 'extra_minute', 'addedTime']));
    const player = cleanString(firstValue(value, ['participant', 'player', 'playerName', 'player_name']));
    const assist = cleanString(firstValue(value, ['assist', 'assistName', 'assist_name']));
    const detail = cleanString(firstValue(value, ['detail', 'description', 'cardType', 'card_type']));
    const explicitLabel = cleanString(firstValue(value, ['label', 'text', 'title']));
    const label = explicitLabel ?? [
      type === 'other' ? 'event' : type,
      player ?? detail,
      minute === null ? undefined : `${minute}'`
    ].filter((part): part is string => typeof part === 'string').join(' - ');
    if (label === '') return [];

    const teamId = teamIdForSide(readEventSide(value, match), match);
    return [{
      minute,
      ...(extraMinute !== null ? { extraMinute } : {}),
      ...(teamId !== undefined ? { teamId } : {}),
      type,
      ...(detail !== undefined ? { detail } : {}),
      ...(player !== undefined ? { player } : {}),
      ...(assist !== undefined ? { assist } : {}),
      label
    }];
  });

  return {
    events,
    ...(events.length === rawEvents.length ? {} : { warning: 'events_partial' })
  };
}

function scorePair(
  value: unknown,
  fallback: { home: number | null; away: number | null } = { home: null, away: null }
): {
  home: number | null;
  away: number | null;
} {
  if (!isObject(value)) return fallback;
  return {
    home: scoreValue(firstValue(value, ['home', 'homeScore', 'home_score'])),
    away: scoreValue(firstValue(value, ['away', 'awayScore', 'away_score']))
  };
}

function adaptScoreBreakdown(rawMatch: JsonObject, match: LocalMatch): LocalScoreBreakdown {
  const score = recordValue(rawMatch, ['score', 'scoreBreakdown', 'score_breakdown']) ?? {};
  const fulltime = scorePair(
    firstValue(score, ['fulltime', 'fullTime', 'full_time', 'final']),
    { home: match.score.home, away: match.score.away }
  );
  return {
    halftime: scorePair(firstValue(score, ['halftime', 'halfTime', 'half_time', 'ht'])),
    fulltime: {
      home: fulltime.home ?? match.score.home,
      away: fulltime.away ?? match.score.away
    },
    extratime: scorePair(firstValue(score, ['extratime', 'extraTime', 'extra_time', 'et'])),
    penalty: scorePair(firstValue(score, ['penalty', 'penalties', 'shootout']))
  };
}

function metricRecord(value: unknown): JsonObject | undefined {
  if (isObject(value)) return value;
  if (!Array.isArray(value)) return undefined;
  const result: JsonObject = {};
  for (const entry of value) {
    if (!isObject(entry)) continue;
    const key = cleanString(firstValue(entry, ['type', 'name', 'key']));
    if (key) result[key] = firstValue(entry, ['value', 'count', 'total']);
  }
  return result;
}

function normalizedMetricLookup(record: JsonObject, aliases: readonly string[]): unknown {
  const normalizedAliases = new Set(aliases.map((alias) => alias.toLowerCase().replace(/[^a-z0-9]/gu, '')));
  for (const [key, value] of Object.entries(record)) {
    if (normalizedAliases.has(key.toLowerCase().replace(/[^a-z0-9]/gu, ''))) return value;
  }
  return undefined;
}

function statRecordForSide(rawStatistics: unknown, side: Side, match: LocalMatch): JsonObject | undefined {
  if (isObject(rawStatistics)) {
    return metricRecord(firstValue(rawStatistics, side === 'home'
      ? ['home', 'homeTeam', 'home_team']
      : ['away', 'awayTeam', 'away_team']));
  }
  if (!Array.isArray(rawStatistics)) return undefined;
  for (const value of rawStatistics) {
    if (!isObject(value)) continue;
    const rowSide = sideFromValue(
      firstValue(value, ['side', 'homeAway', 'home_away', 'team', 'teamName', 'team_name']),
      match
    );
    if (rowSide === side) {
      return metricRecord(firstValue(value, ['statistics', 'stats', 'values'])) ?? value;
    }
  }
  return undefined;
}

function adaptStats(rawMatch: JsonObject, match: LocalMatch): {
  rows: LocalMatchTeamStats[];
  warning?: string;
} {
  const rawStatistics = firstValue(rawMatch, ['statistics', 'stats', 'teamStats', 'team_stats']);
  let missingCount = 0;
  const rows = (['home', 'away'] as const).map((side): LocalMatchTeamStats => {
    const record = statRecordForSide(rawStatistics, side, match) ?? {};
    const integerStat = (key: keyof typeof STAT_ALIASES): number | null => {
      const parsed = numberValue(normalizedMetricLookup(record, STAT_ALIASES[key]));
      if (parsed === null) missingCount += 1;
      return parsed;
    };
    const possession = numberValue(
      normalizedMetricLookup(record, STAT_ALIASES.possessionPercentage),
      false
    );
    if (possession === null || possession > 100) missingCount += 1;
    const team = side === 'home' ? match.homeTeam : match.awayTeam;
    return {
      teamId: team.id,
      teamName: team.name,
      cornerKicks: integerStat('cornerKicks'),
      yellowCards: integerStat('yellowCards'),
      redCards: integerStat('redCards'),
      totalShots: integerStat('totalShots'),
      shotsOnGoal: integerStat('shotsOnGoal'),
      possessionPercentage: possession !== null && possession <= 100 ? possession : null,
      fouls: integerStat('fouls'),
      offsides: integerStat('offsides')
    };
  });
  const allMissing = rawStatistics === undefined || missingCount === rows.length * 8;
  return {
    rows,
    ...(allMissing
      ? { warning: 'statistics_unavailable' }
      : missingCount > 0
        ? { warning: 'statistics_partial' }
        : {})
  };
}

function adaptPlayer(value: unknown): LocalMatchLineupPlayer | null {
  if (typeof value === 'string') {
    const name = cleanString(value);
    return name ? { name } : null;
  }
  if (!isObject(value)) return null;
  const nestedPlayer = isObject(value.player) ? value.player : undefined;
  const name = cleanString(firstValue(value, ['name', 'playerName', 'player_name']))
    ?? (nestedPlayer ? cleanString(firstValue(nestedPlayer, ['name', 'playerName'])) : undefined);
  if (!name) return null;
  const shirtNumber = numberValue(firstValue(value, ['shirtNumber', 'shirt_number', 'number', 'jerseyNumber']));
  const position = cleanString(firstValue(value, ['position', 'pos', 'role']));
  return {
    name,
    ...(shirtNumber !== null ? { shirtNumber } : {}),
    ...(position !== undefined ? { position } : {})
  };
}

function lineupRecordForSide(rawLineups: unknown, side: Side, match: LocalMatch): JsonObject | undefined {
  if (isObject(rawLineups)) {
    return recordValue(rawLineups, side === 'home'
      ? ['home', 'homeTeam', 'home_team']
      : ['away', 'awayTeam', 'away_team']);
  }
  if (!Array.isArray(rawLineups)) return undefined;
  return rawLineups.find((value): value is JsonObject => (
    isObject(value) && sideFromValue(
      firstValue(value, ['side', 'homeAway', 'home_away', 'team', 'teamName', 'team_name']),
      match
    ) === side
  ));
}

function playersFrom(record: JsonObject, keys: readonly string[]): LocalMatchLineupPlayer[] {
  const values = arrayValue(record, keys) ?? [];
  return values.map(adaptPlayer).filter((player): player is LocalMatchLineupPlayer => player !== null);
}

function adaptLineups(rawMatch: JsonObject, match: LocalMatch): {
  rows?: LocalMatchLineup[];
  warning?: string;
} {
  const rawLineups = firstValue(rawMatch, ['lineups', 'lineup', 'formations']);
  if (rawLineups === undefined) return { warning: 'lineups_unavailable' };
  let missingSides = 0;
  const rows = (['home', 'away'] as const).map((side): LocalMatchLineup => {
    const record = lineupRecordForSide(rawLineups, side, match);
    if (!record) missingSides += 1;
    const safeRecord = record ?? {};
    const team = side === 'home' ? match.homeTeam : match.awayTeam;
    return {
      teamId: team.id,
      teamName: team.name,
      formation: cleanString(firstValue(safeRecord, ['formation', 'system'])) ?? null,
      starters: playersFrom(safeRecord, ['starters', 'startingXI', 'starting_xi', 'startXI']),
      substitutes: playersFrom(safeRecord, ['substitutes', 'subs', 'bench'])
    };
  });
  if (missingSides === 2) return { warning: 'lineups_unavailable' };
  return {
    rows,
    ...(missingSides > 0 ? { warning: 'lineups_partial' } : {})
  };
}

export function adaptSportScoreMatchDetail(
  input: AdaptSportScoreMatchDetailInput
): LocalMatchDetail {
  if (input.canonicalMatch.status !== 'completed') {
    throw new SportScoreMatchDetailAdapterError(
      'non_terminal',
      'Canonical match detail can only be adapted after completion.'
    );
  }
  const rawMatch = isObject(input.response.match) ? input.response.match : undefined;
  if (!rawMatch || Object.keys(rawMatch).length === 0) {
    throw new SportScoreMatchDetailAdapterError('unavailable', 'SportScore match detail is unavailable.');
  }
  const mappedStatus = mapSportScoreStatus(firstValue(rawMatch, ['status', 'statusText', 'status_text']));
  if (mappedStatus !== 'completed') {
    throw new SportScoreMatchDetailAdapterError(
      mappedStatus === 'in_play' || mappedStatus === 'scheduled' ? 'non_terminal' : 'invalid',
      'SportScore match detail is not terminal.'
    );
  }
  const responseSlug = cleanString(firstValue(rawMatch, ['slug', 'matchSlug', 'match_slug']));
  if (responseSlug !== undefined && responseSlug !== input.expectedSlug) {
    throw new SportScoreMatchDetailAdapterError(
      'identity_mismatch',
      'SportScore match detail does not match the requested source identity.'
    );
  }

  const events = adaptEvents(rawMatch, input.canonicalMatch);
  const stats = adaptStats(rawMatch, input.canonicalMatch);
  const lineups = adaptLineups(rawMatch, input.canonicalMatch);
  const warnings = [events.warning, stats.warning, lineups.warning]
    .filter((warning): warning is string => warning !== undefined);
  const elapsedMinute = numberValue(firstValue(rawMatch, ['elapsed', 'elapsedMinute', 'elapsed_minute']));
  const referee = cleanString(firstValue(rawMatch, ['referee', 'official']));
  const detail: LocalMatchDetail = {
    match: toProviderNeutralLocalMatch(input.canonicalMatch),
    status: 'completed',
    elapsedMinute,
    ...(referee !== undefined ? { referee } : {}),
    scoreBreakdown: adaptScoreBreakdown(rawMatch, input.canonicalMatch),
    events: events.events,
    teamStats: stats.rows,
    ...(lineups.rows !== undefined ? { lineups: lineups.rows } : {}),
    ...(warnings.length > 0 ? { warnings } : {}),
    updatedAt: input.observedAt
  };
  const validation = validateLocalMatchDetail(detail);
  if (!validation.ok) {
    throw new SportScoreMatchDetailAdapterError('invalid', 'Adapted SportScore match detail is invalid.');
  }
  return detail;
}
