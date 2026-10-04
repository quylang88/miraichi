import { validateLocalMatch, type LocalMatch, type ProviderLink } from '@miraichi/shared';
import type { CanonicalWarehouseSnapshot } from '../../../../../scripts/providers/shared/canonical-warehouse.js';
export { mergeCanonicalWarehouseSnapshots } from './canonical-merge.js';

/** DB rows retain private links; public routes still apply their redaction contract. */
export function toCanonicalWarehouse(rows: readonly LocalMatch[]): CanonicalWarehouseSnapshot {
  const teams = new Map<string, CanonicalWarehouseSnapshot['teams'][number]>();
  const competitions = new Map<string, CanonicalWarehouseSnapshot['competitions'][number]>();
  const links: ProviderLink[] = [];
  const matches = rows.map((row) => {
    if (!validateLocalMatch(row).ok) throw new Error('Invalid hosted canonical row');
    for (const team of [row.homeTeam, row.awayTeam]) {
      teams.set(team.id, { teamId: team.id, name: team.name, ...(team.countryCode ? { countryCode: team.countryCode } : {}), updatedAt: row.updatedAt });
    }
    competitions.set(row.competition.id, { competitionId: row.competition.id, name: row.competition.name, type: row.competition.type, updatedAt: row.updatedAt });
    for (const ref of row.sourceRefs) {
      if (!ref.sourceMatchId) continue;
      links.push({ entityType: 'match', entityId: row.id, provider: ref.sourceId,
        providerEntityType: 'match', providerEntityId: ref.sourceMatchId, confidence: 1,
        linkedBy: 'retained-cloud-reference', linkedAt: ref.importedAt });
    }
    return { matchId: row.id, competitionId: row.competition.id, season: row.competition.season,
      kickoffUtc: row.kickoffUtc, status: row.status, homeTeamId: row.homeTeam.id, awayTeamId: row.awayTeam.id,
      scoreHome: row.score.home, scoreAway: row.score.away, updatedAt: row.updatedAt,
      ...(row.venue === undefined ? {} : { venue: row.venue }), ...(row.round === undefined ? {} : { round: row.round }),
      ...(row.stage === undefined ? {} : { stage: row.stage }), ...(row.neutralVenue === undefined ? {} : { neutralVenue: row.neutralVenue }) };
  });
  return { matches, teams: [...teams.values()], competitions: [...competitions.values()], links, provenance: [] };
}

export function fromCanonicalWarehouse(data: CanonicalWarehouseSnapshot): LocalMatch[] {
  const teams = new Map(data.teams.map((item) => [item.teamId, item]));
  const competitions = new Map(data.competitions.map((item) => [item.competitionId, item]));
  const links = new Map<string, ProviderLink[]>();
  for (const link of data.links) {
    if (link.entityType === 'match') links.set(link.entityId, [...(links.get(link.entityId) ?? []), link]);
  }
  return data.matches.map((match) => {
    const competition = competitions.get(match.competitionId);
    const home = teams.get(match.homeTeamId);
    const away = teams.get(match.awayTeamId);
    if (!competition || !home || !away) throw new Error('Hosted canonical reference is missing');
    const row: LocalMatch = {
      id: match.matchId,
      competition: { id: competition.competitionId, name: competition.name, type: competition.type, season: match.season },
      homeTeam: { id: home.teamId, name: home.name, ...(home.countryCode ? { countryCode: home.countryCode } : {}) },
      awayTeam: { id: away.teamId, name: away.name, ...(away.countryCode ? { countryCode: away.countryCode } : {}) },
      kickoffUtc: match.kickoffUtc, status: match.status, score: { home: match.scoreHome, away: match.scoreAway },
      sourceRefs: (links.get(match.matchId) ?? []).map((link) => ({ sourceId: link.provider, sourceMatchId: link.providerEntityId, importedAt: link.linkedAt })),
      updatedAt: match.updatedAt,
      ...(match.venue === undefined ? {} : { venue: match.venue }), ...(match.round === undefined ? {} : { round: match.round }),
      ...(match.stage === undefined ? {} : { stage: match.stage }), ...(match.neutralVenue === undefined ? {} : { neutralVenue: match.neutralVenue })
    };
    if (!validateLocalMatch(row).ok) throw new Error('Invalid hosted canonical publication');
    return row;
  });
}
