import type { LiveMatchOverlay, LiveMatchPeriod, LiveMatchStatus, LocalMatch } from '@miraichi/shared';
import { COMPETITION_POPULARITY_RANKING } from '@miraichi/config';

const MATCH_WINDOW_MS = 30 * 60 * 1_000;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const WIDGET_MATCH_PATH = /^\/football\/match\/([a-z0-9]+(?:-[a-z0-9]+)*)\/$/;
const competitionNames = new Map(COMPETITION_POPULARITY_RANKING.map((entry) => [
  entry.id, new Set([entry.name, ...(entry.aliases ?? [])].map(identity))
]));
// Additional exact labels observed in the 2026-09-11 widget capture. No fuzzy team matching.
competitionNames.get('conmebol-copa-libertadores')?.add(identity('CONMEBOL Copa Libertadores'));
competitionNames.get('conmebol-copa-sudamericana')?.add(identity('CONMEBOL Copa Sudamericana'));
competitionNames.get('mex-liga-mx')?.add(identity('Mexico Liga MX'));
const teamNames: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['team-flamengo', new Set([identity('Flamengo - RJ')])],
  ['team-pumas', new Set([identity('Pumas U.N.A.M.')])],
  ['team-leon', new Set([identity('Club Leon')])]
]);

export interface SportScoreLiveAdapterIssue {
  readonly code: 'invalid_record' | 'unmapped_match' | 'ambiguous_match';
  readonly slug?: string;
}

export interface SportScoreLiveAdapterResult {
  readonly matches: LiveMatchOverlay[];
  readonly issues: SportScoreLiveAdapterIssue[];
}

interface NormalizedWidgetRecord {
  readonly slug: string;
  readonly homeName: string;
  readonly awayName: string;
  readonly competitionName?: string;
  readonly kickoffUtc: string;
  readonly status: LiveMatchStatus;
  readonly period: LiveMatchPeriod | null;
  readonly elapsedMinute: number | null;
  readonly homeScore: number;
  readonly awayScore: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function displayName(value: unknown): string | null {
  const candidate = typeof value === 'string' ? value : isRecord(value) ? value.name : undefined;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}

function identity(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]/gu, '');
}

function widgetSlug(record: Record<string, unknown>): string | null {
  const direct = typeof record.slug === 'string' ? record.slug.trim() : undefined;
  const fromUrl = typeof record.url === 'string' ? WIDGET_MATCH_PATH.exec(record.url)?.[1] : undefined;
  if ((record.slug !== undefined && (!direct || !SLUG_PATTERN.test(direct)))
    || (record.url !== undefined && !fromUrl) || (direct && fromUrl && direct !== fromUrl)) return null;
  const slug = direct ?? fromUrl;
  return slug && slug.length <= 160 ? slug : null;
}

function integerScore(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : Number.NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function score(record: Record<string, unknown>, side: 'home' | 'away'): number | null {
  const direct = integerScore(record[`${side}_score`]);
  if (direct !== null) return direct;
  return isRecord(record.score) ? integerScore(record.score[side]) : null;
}

export function minute(record: Record<string, unknown>): number | null {
  for (const value of [record.minute, record.elapsed, record.status_text]) {
    const parts = typeof value === 'string' ? /^(\d{1,3})(?:\s*\+\s*(\d{1,2}))?\s*['’′]?$/u.exec(value.trim()) : null;
    const parsed = typeof value === 'number' ? value : parts ? Number(parts[1]) + Number(parts[2] ?? 0) : Number.NaN;
    if (Number.isInteger(parsed) && parsed >= 0 && parsed <= 200) return parsed;
  }
  return null;
}

export function mappedStatus(raw: string): { status: LiveMatchStatus; period: LiveMatchPeriod | null } | null {
  const value = raw.trim().toLowerCase().replace(/[\s-]+/gu, '_');
  if (['finished', 'completed', 'ft', 'aet', 'pen'].includes(value)) return { status: 'completed', period: null };
  if (['halftime', 'half_time', 'ht', 'break'].includes(value)) return { status: 'halftime', period: null };
  if (['suspended', 'interrupted', 'delayed'].includes(value)) return { status: 'suspended', period: 'unknown' };
  if (['first_half', '1st_half'].includes(value)) return { status: 'live', period: 'first_half' };
  if (['second_half', '2nd_half'].includes(value)) return { status: 'live', period: 'second_half' };
  if (['extra_time', 'et'].includes(value)) return { status: 'live', period: 'extra_time' };
  if (['penalties', 'penalty_shootout'].includes(value)) return { status: 'live', period: 'penalties' };
  if (['live', 'in_play', 'inplay'].includes(value)) return { status: 'live', period: 'unknown' };
  return null;
}

function statusAndPeriod(record: Record<string, unknown>): { status: LiveMatchStatus; period: LiveMatchPeriod | null } | null {
  const primary = typeof record.status === 'string' ? mappedStatus(record.status) : null;
  const label = typeof record.status_text === 'string' ? mappedStatus(record.status_text) : null;
  if (primary?.status === 'live' && primary.period === 'unknown'
    && (label?.status === 'live' || label?.status === 'halftime')) return label;
  return primary ?? label;
}

function isUpcoming(record: Record<string, unknown>): boolean {
  const values = [record.status, record.status_text]
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim().toLowerCase().replace(/[\s-]+/gu, '_'));
  return values.some((value) => ['scheduled', 'not_started', 'notstarted', 'upcoming', 'ns', 'tbd'].includes(value));
}

function optionalCompetitionName(record: Record<string, unknown>): string | undefined {
  for (const value of [record.competition, record.league, record.tournament]) {
    const name = displayName(value);
    if (name) return name;
  }
  return undefined;
}

function normalizeRecord(raw: unknown): NormalizedWidgetRecord | null {
  if (!isRecord(raw)) return null;
  const slug = widgetSlug(raw);
  const homeName = displayName(raw.home);
  const awayName = displayName(raw.away);
  const kickoffMs = typeof raw.time === 'string' && ISO_DATETIME_PATTERN.test(raw.time) ? Date.parse(raw.time) : Number.NaN;
  const lifecycle = statusAndPeriod(raw);
  const homeScore = score(raw, 'home');
  const awayScore = score(raw, 'away');
  if (!slug || !homeName || !awayName || homeName === awayName
    || !Number.isFinite(kickoffMs) || !lifecycle || homeScore === null || awayScore === null) return null;
  return {
    slug,
    homeName,
    awayName,
    ...(optionalCompetitionName(raw) ? { competitionName: optionalCompetitionName(raw)! } : {}),
    kickoffUtc: new Date(kickoffMs).toISOString(),
    status: lifecycle.status,
    period: lifecycle.period,
    elapsedMinute: lifecycle.status === 'completed' ? null : minute(raw),
    homeScore,
    awayScore
  };
}

function matchesTeam(name: string, team: { id: string; name: string }): boolean {
  const normalized = identity(name);
  return normalized === identity(team.name) || teamNames.get(team.id)?.has(normalized) === true;
}

function matchesCanonical(record: NormalizedWidgetRecord, match: {
  homeTeam: { id: string; name: string }; awayTeam: { id: string; name: string };
  competition: { id: string; name: string }; kickoffUtc: string;
}): boolean {
  if (!matchesTeam(record.homeName, match.homeTeam) || !matchesTeam(record.awayName, match.awayTeam)) return false;
  if (record.competitionName && identity(record.competitionName) !== identity(match.competition.name)
    && !competitionNames.get(match.competition.id)?.has(identity(record.competitionName))) return false;
  return Math.abs(Date.parse(record.kickoffUtc) - Date.parse(match.kickoffUtc)) <= MATCH_WINDOW_MS;
}

function overlay(record: NormalizedWidgetRecord, match: LocalMatch, observedAt: string): LiveMatchOverlay {
  return {
    matchId: match.id,
    competition: { id: match.competition.id, name: match.competition.name },
    kickoffUtc: match.kickoffUtc,
    homeTeam: { id: match.homeTeam.id, name: match.homeTeam.name },
    awayTeam: { id: match.awayTeam.id, name: match.awayTeam.name },
    status: record.status,
    period: record.period,
    elapsedMinute: record.elapsedMinute,
    score: { home: record.homeScore, away: record.awayScore },
    sourceRefs: [{ sourceId: 'sportscore', sourceMatchId: record.slug, sourceUrl: 'https://sportscore.com/', observedAt }],
    updatedAt: observedAt
  };
}

export function adaptSportScoreLiveRecords(input: {
  readonly records: readonly Record<string, unknown>[];
  readonly canonicalMatches: readonly LocalMatch[];
  readonly observedAt: string;
}): SportScoreLiveAdapterResult {
  const matches: LiveMatchOverlay[] = [];
  const issues: SportScoreLiveAdapterIssue[] = [];
  const seenMatchIds = new Set<string>();
  for (const raw of input.records) {
    if (isRecord(raw) && isUpcoming(raw)) continue;
    const normalized = normalizeRecord(raw);
    if (!normalized) {
      const slug = isRecord(raw) ? widgetSlug(raw) : null;
      issues.push({ code: 'invalid_record', ...(slug ? { slug } : {}) });
      continue;
    }
    const candidates = input.canonicalMatches.filter((match) => matchesCanonical(normalized, match));
    if (candidates.length === 0) {
      issues.push({ code: 'unmapped_match', slug: normalized.slug });
      continue;
    }
    if (candidates.length !== 1 || seenMatchIds.has(candidates[0]!.id)) {
      issues.push({ code: 'ambiguous_match', slug: normalized.slug });
      continue;
    }
    seenMatchIds.add(candidates[0]!.id);
    matches.push(overlay(normalized, candidates[0]!, input.observedAt));
  }
  return { matches, issues };
}

export function adaptTrackedSportScoreRecord(input: {
  readonly raw: Record<string, unknown>;
  readonly tracked: LiveMatchOverlay;
  readonly observedAt: string;
}): LiveMatchOverlay | null {
  const record = isRecord(input.raw.match) ? input.raw.match : input.raw;
  const normalized = normalizeRecord(record);
  if (!normalized) return null;
  const trackedSlug = input.tracked.sourceRefs.find((source) => source.sourceId === 'sportscore')?.sourceMatchId;
  if (normalized.slug !== trackedSlug
    || !matchesCanonical(normalized, input.tracked)) return null;
  return {
    ...structuredClone(input.tracked),
    status: normalized.status,
    period: normalized.period,
    elapsedMinute: normalized.elapsedMinute,
    score: { home: normalized.homeScore, away: normalized.awayScore },
    sourceRefs: input.tracked.sourceRefs.map((source) => source.sourceId === 'sportscore' ? { ...source, observedAt: input.observedAt } : source),
    updatedAt: input.observedAt
  };
}
