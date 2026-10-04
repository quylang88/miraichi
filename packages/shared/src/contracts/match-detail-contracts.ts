/** Provider-neutral factual metrics; unknown or analytical metrics are never published. */
export const DETAIL_STATISTIC_KEYS = [
  'possession','totalShots','shotsOnTarget','shotsOffTarget','blockedShots','woodwork','shotsInsideBox','shotsOutsideBox',
  'corners','touchesOppositionBox','bigChances','bigChancesMissed','passes','accuratePasses','ownHalfPasses','oppositionHalfPasses',
  'accurateLongBalls','accurateCrosses','throwIns','offsides','tackles','interceptions','blocks','clearances','saves',
  'duelsWon','duelsLost','groundDuelsWon','aerialDuelsWon','successfulDribbles','yellowCards','redCards','fouls',
  'minutesPlayed','goals','assists','chancesCreated','shotAccuracy','touches','passesFinalThird','lineBreakingPasses',
  'dispossessed','defensiveActions','headedClearances','recoveries','dribbledPast','wasFouled','distanceCovered',
  'sprintDistance','sprints','topSpeed','runningDistance','walkingDistance','penaltiesWon','penaltiesConceded',
  'highClaims','punches','sweeperActions','goalsConceded','penaltiesSaved','accurateThrows',
  'bigChancesCreated','clearancesOffLine','divingSaves','savesInsideBox','ownGoals','errorsLedToGoal'
] as const;
export type DetailStatisticKey = typeof DETAIL_STATISTIC_KEYS[number];
export interface DetailMetric { value: number | null; total?: number; percentage?: number }
export const DETAIL_PERIODS = ['all','firstHalf','secondHalf','extraTime'] as const;
export interface DetailPeriodStatistics {
  period: typeof DETAIL_PERIODS[number];
  rows: { key: DetailStatisticKey; home: DetailMetric; away: DetailMetric }[];
}
export interface DetailPlayerStatistics {
  teamId: string; name: string; shirtNumber: number | null;
  metrics: { key: DetailStatisticKey; value: DetailMetric }[];
}
export interface DetailShot {
  teamId: string; player: string | null; minute: number | null; extraMinute: number | null;
  x: number; y: number; result: 'goal' | 'saved' | 'miss' | 'post' | 'blocked';
  ownGoal: boolean; bodyPart: 'leftFoot' | 'rightFoot' | 'head' | 'other';
}
export interface MatchDetailEnrichment {
  observedStatus: 'scheduled' | 'live' | 'halftime' | 'suspended' | 'completed' | 'postponed' | 'cancelled' | 'unknown';
  score: { home: number | null; away: number | null };
  statistics: DetailPeriodStatistics[];
  players: DetailPlayerStatistics[];
  shots: DetailShot[];
  coaches: { teamId: string; name: string }[];
  venue?: { city: string | null; country: string | null; capacity: number | null; surface: string | null };
  attendance?: number;
}
export interface MatchDetailRefreshState {
  outcome: 'cached' | 'refreshed' | 'not_modified' | 'cooldown' | 'busy' | 'unavailable' | 'unsupported';
  lastSuccessAt: string | null;
  retryAfterSeconds: number | null;
}

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const keys = (v: Record<string, unknown>, allowed: readonly string[]) => Object.keys(v).every((key) => allowed.includes(key));
const number = (v: unknown, max = 1_000_000) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max;
const integer = (v: unknown, max = 1_000_000) => number(v,max) && Number.isInteger(v);
const nullableNumber = (v: unknown, max?: number) => v === null || number(v, max);
const text = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= 200;
const nullableText = (v: unknown) => v === null || text(v);
const statKey = (v: unknown) => typeof v === 'string' && (DETAIL_STATISTIC_KEYS as readonly string[]).includes(v);
function metric(v: unknown, key: unknown): boolean {
  const decimal = ['possession','shotAccuracy','distanceCovered','sprintDistance','topSpeed','runningDistance','walkingDistance'].includes(String(key));
  const limit = key === 'possession' || key === 'shotAccuracy' || key === 'topSpeed' ? 100 : key === 'minutesPlayed' ? 200 : 1_000_000;
  return record(v) && keys(v, ['value','total','percentage']) && nullableNumber(v.value,limit)
    && (decimal || v.value === null || Number.isInteger(v.value))
    && (v.total === undefined || number(v.total)) && (v.percentage === undefined || number(v.percentage, 100))
    && !(typeof v.value === 'number' && typeof v.total === 'number' && v.value > v.total);
}
export function isMatchDetailEnrichment(v: unknown, teamIds: readonly unknown[]): v is MatchDetailEnrichment {
  if (!record(v) || !keys(v, ['observedStatus','score','statistics','players','shots','coaches','venue','attendance'])) return false;
  const team = (id: unknown) => typeof id === 'string' && teamIds.includes(id);
  if (!['scheduled','live','halftime','suspended','completed','postponed','cancelled','unknown'].includes(String(v.observedStatus))) return false;
  if (!record(v.score) || !keys(v.score, ['home','away'])
    || !(v.score.home === null || integer(v.score.home,100)) || !(v.score.away === null || integer(v.score.away,100))
    || v.observedStatus === 'completed' && (v.score.home === null || v.score.away === null)) return false;
  if (!Array.isArray(v.statistics) || v.statistics.length > 4 || !v.statistics.every((group) => record(group)
    && keys(group, ['period','rows']) && (DETAIL_PERIODS as readonly unknown[]).includes(group.period)
    && Array.isArray(group.rows) && group.rows.length <= DETAIL_STATISTIC_KEYS.length
    && group.rows.every((row) => record(row) && keys(row, ['key','home','away']) && statKey(row.key) && metric(row.home,row.key) && metric(row.away,row.key)))) return false;
  if (!Array.isArray(v.players) || v.players.length > 80 || !v.players.every((p) => record(p)
    && keys(p, ['teamId','name','shirtNumber','metrics']) && team(p.teamId) && text(p.name) && nullableNumber(p.shirtNumber, 999)
    && Array.isArray(p.metrics) && p.metrics.length <= DETAIL_STATISTIC_KEYS.length
    && p.metrics.every((m) => record(m) && keys(m, ['key','value']) && statKey(m.key) && metric(m.value,m.key)))) return false;
  if (!Array.isArray(v.shots) || v.shots.length > 200 || !v.shots.every((s) => record(s)
    && keys(s, ['teamId','player','minute','extraMinute','x','y','result','ownGoal','bodyPart'])
    && team(s.teamId) && nullableText(s.player) && nullableNumber(s.minute, 200) && nullableNumber(s.extraMinute, 40)
    && number(s.x, 105) && number(s.y, 68) && ['goal','saved','miss','post','blocked'].includes(String(s.result))
    && typeof s.ownGoal === 'boolean' && ['leftFoot','rightFoot','head','other'].includes(String(s.bodyPart)))) return false;
  if (!Array.isArray(v.coaches) || v.coaches.length > 2 || !v.coaches.every((c) => record(c)
    && keys(c, ['teamId','name']) && team(c.teamId) && text(c.name))) return false;
  if (v.attendance !== undefined && !number(v.attendance)) return false;
  if (v.venue !== undefined && (!record(v.venue) || !keys(v.venue, ['city','country','capacity','surface'])
    || !nullableText(v.venue.city) || !nullableText(v.venue.country) || !nullableNumber(v.venue.capacity) || !nullableText(v.venue.surface))) return false;
  return true;
}
export function isMatchDetailRefreshState(v: unknown): v is MatchDetailRefreshState {
  return record(v) && keys(v, ['outcome','lastSuccessAt','retryAfterSeconds'])
    && ['cached','refreshed','not_modified','cooldown','busy','unavailable','unsupported'].includes(String(v.outcome))
    && (v.lastSuccessAt === null || typeof v.lastSuccessAt === 'string' && /^\d{4}-\d{2}-\d{2}T/u.test(v.lastSuccessAt) && Number.isFinite(Date.parse(v.lastSuccessAt)))
    && nullableNumber(v.retryAfterSeconds, 86400);
}
