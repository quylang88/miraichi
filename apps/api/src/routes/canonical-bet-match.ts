import type { CloudRouteDependencies } from './cloud-route-types.js';

const MANUAL_MATCH_GROUP_ID = /^manual:[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/u;

export function resolveManualBetMatch(
  matchGroupId: unknown,
  matchId: unknown,
  homeTeamName: unknown,
  awayTeamName: unknown
): { readonly homeTeamName: string; readonly awayTeamName: string } | null {
  if (typeof matchGroupId !== 'string' || !MANUAL_MATCH_GROUP_ID.test(matchGroupId)
    || (matchId !== undefined && matchId !== null)
    || typeof homeTeamName !== 'string' || typeof awayTeamName !== 'string') return null;
  const home = homeTeamName.trim();
  const away = awayTeamName.trim();
  if (!home || !away || home.length > 160 || away.length > 160
    || home.localeCompare(away, undefined, { sensitivity: 'accent' }) === 0) return null;
  return { homeTeamName: home, awayTeamName: away };
}

export function isManualBetMatchGroupId(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('manual:');
}

export async function resolveCanonicalBetMatch(
  deps: CloudRouteDependencies,
  matchId: unknown,
  homeTeamName: unknown,
  awayTeamName: unknown
): Promise<{ readonly homeTeamName: string; readonly awayTeamName: string } | null> {
  if (typeof matchId !== 'string' || !matchId.trim()
    || typeof homeTeamName !== 'string' || typeof awayTeamName !== 'string') return null;
  const match = deps.matchRepository
    ? await deps.matchRepository.findById(matchId)
    : await deps.adapter.findCloudMatchById(deps.ownerProfileId, matchId);
  if (!match || homeTeamName.trim() !== match.homeTeam.name || awayTeamName.trim() !== match.awayTeam.name) return null;
  return { homeTeamName: match.homeTeam.name, awayTeamName: match.awayTeam.name };
}
