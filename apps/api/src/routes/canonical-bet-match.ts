import type { CloudRouteDependencies } from './cloud-route-types.js';

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
