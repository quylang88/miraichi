export interface CompetitionPopularityEntry {
  readonly rank: number;
  readonly id: string;
  readonly name: string;
  readonly aliases?: readonly string[];
}

export const COMPETITION_POPULARITY_RANKING: readonly CompetitionPopularityEntry[] = Object.freeze([
  { rank: 1, id: 'uefa-champions-league', name: 'UEFA Champions League', aliases: ['Champions League', 'UCL'] },
  { rank: 2, id: 'eng-premier-league', name: 'Premier League', aliases: ['English Premier League', 'EPL'] },
  { rank: 3, id: 'esp-la-liga', name: 'La Liga', aliases: ['LaLiga', 'Primera División Spain'] },
  { rank: 4, id: 'ita-serie-a', name: 'Serie A', aliases: ['Italian Serie A'] },
  { rank: 5, id: 'ger-bundesliga', name: 'Bundesliga', aliases: ['German Bundesliga'] },
  { rank: 6, id: 'fra-ligue-1', name: 'Ligue 1', aliases: ['French Ligue 1'] },
  { rank: 7, id: 'uefa-europa-league', name: 'UEFA Europa League', aliases: ['Europa League', 'UEL'] },
  { rank: 8, id: 'uefa-conference-league', name: 'UEFA Conference League', aliases: ['Conference League', 'UECL'] },
  { rank: 9, id: 'uefa-super-cup', name: 'UEFA Super Cup' },
  { rank: 10, id: 'fifa-club-world-cup', name: 'FIFA Club World Cup', aliases: ['Club World Cup'] },
  { rank: 11, id: 'eng-fa-cup', name: 'FA Cup', aliases: ['The Emirates FA Cup'] },
  { rank: 12, id: 'eng-efl-cup', name: 'EFL Cup', aliases: ['Carabao Cup', 'League Cup'] },
  { rank: 13, id: 'esp-copa-del-rey', name: 'Copa del Rey' },
  { rank: 14, id: 'ger-dfb-pokal', name: 'DFB-Pokal', aliases: ['DFB Pokal', 'German Cup'] },
  { rank: 15, id: 'ita-coppa-italia', name: 'Coppa Italia', aliases: ['Italian Cup'] },
  { rank: 16, id: 'fra-coupe-de-france', name: 'Coupe de France', aliases: ['French Cup'] },
  { rank: 17, id: 'eng-championship', name: 'Championship', aliases: ['EFL Championship'] },
  { rank: 18, id: 'por-primeira-liga', name: 'Primeira Liga', aliases: ['Liga Portugal'] },
  { rank: 19, id: 'ned-eredivisie', name: 'Eredivisie', aliases: ['Dutch Eredivisie'] },
  { rank: 20, id: 'sau-pro-league', name: 'Saudi Pro League', aliases: ['Saudi League', 'SPL'] },
  { rank: 21, id: 'usa-mls', name: 'Major League Soccer', aliases: ['MLS'] },
  { rank: 22, id: 'vie-v-league-1', name: 'V.League 1', aliases: ['V-League 1', 'V.League', 'V-League'] },
  { rank: 23, id: 'conmebol-copa-libertadores', name: 'Copa Libertadores', aliases: ['Libertadores'] },
  { rank: 24, id: 'conmebol-copa-sudamericana', name: 'Copa Sudamericana', aliases: ['Sudamericana'] },
  { rank: 25, id: 'afc-champions-league-elite', name: 'AFC Champions League Elite', aliases: ['ACL Elite', 'AFC Champions League'] },
  { rank: 26, id: 'jpn-j1-league', name: 'J1 League', aliases: ['J.League', 'J-League 1', 'J1'] },
  { rank: 27, id: 'kor-k-league-1', name: 'K League 1', aliases: ['K-League 1', 'K League'] },
  { rank: 28, id: 'bra-serie-a', name: 'Brasileirão Série A', aliases: ['Brasileirao', 'Serie A Brazil'] },
  { rank: 29, id: 'arg-primera-division', name: 'Primera División', aliases: ['Argentine Primera División', 'Liga Profesional de Fútbol'] },
  { rank: 30, id: 'mex-liga-mx', name: 'Liga MX', aliases: ['Mexican Primera Division'] },
  { rank: 31, id: 'tur-super-lig', name: 'Süper Lig', aliases: ['Turkish Super Lig', 'Super Lig'] },
  { rank: 32, id: 'bel-pro-league', name: 'Belgian Pro League', aliases: ['Jupiler Pro League'] },
  { rank: 33, id: 'sco-premiership', name: 'Scottish Premiership', aliases: ['Scottish Premier League', 'SPFL'] },
  { rank: 34, id: 'sui-super-league', name: 'Swiss Super League' },
  { rank: 35, id: 'aut-bundesliga', name: 'Austrian Bundesliga', aliases: ['Admiral Bundesliga'] },
  { rank: 36, id: 'den-superliga', name: 'Danish Superliga', aliases: ['Superliga'] },
  { rank: 37, id: 'gre-super-league-1', name: 'Greek Super League 1', aliases: ['Super League Greece'] },
  { rank: 38, id: 'swe-allsvenskan', name: 'Allsvenskan', aliases: ['Swedish Allsvenskan'] },
  { rank: 39, id: 'nor-eliteserien', name: 'Eliteserien', aliases: ['Norwegian Eliteserien'] },
  { rank: 40, id: 'pol-ekstraklasa', name: 'Ekstraklasa', aliases: ['Polish Ekstraklasa'] },
  { rank: 41, id: 'aus-a-league', name: 'A-League Men', aliases: ['A-League'] },
  { rank: 42, id: 'chn-csl', name: 'Chinese Super League', aliases: ['CSL'] },
  { rank: 43, id: 'tha-league-1', name: 'Thai League 1', aliases: ['Thai League'] },
  { rank: 44, id: 'col-primera-a', name: 'Categoría Primera A', aliases: ['Liga BetPlay Dimayor'] },
  { rank: 45, id: 'por-taca-de-portugal', name: 'Taça de Portugal', aliases: ['Taca de Portugal', 'Portuguese Cup'] },
  { rank: 46, id: 'ned-knvb-beker', name: 'KNVB Beker', aliases: ['KNVB Cup', 'Dutch Cup'] },
  { rank: 47, id: 'esp-segunda-division', name: 'La Liga 2', aliases: ['LaLiga 2', 'Segunda División'] },
  { rank: 48, id: 'ita-serie-b', name: 'Serie B', aliases: ['Italian Serie B'] },
  { rank: 49, id: 'ger-2-bundesliga', name: '2. Bundesliga', aliases: ['German 2. Bundesliga', '2. Bundesliga'] },
  { rank: 50, id: 'fra-ligue-2', name: 'Ligue 2', aliases: ['French Ligue 2'] }
]);

function normalizeKey(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const rankLookup = new Map<string, number>();

for (const entry of COMPETITION_POPULARITY_RANKING) {
  rankLookup.set(normalizeKey(entry.id), entry.rank);
  rankLookup.set(normalizeKey(entry.name), entry.rank);
  if (entry.aliases) {
    for (const alias of entry.aliases) {
      rankLookup.set(normalizeKey(alias), entry.rank);
    }
  }
}

export function getCompetitionPopularityRank(competitionNameOrId: string): number {
  if (!competitionNameOrId) return 9999;
  const key = normalizeKey(competitionNameOrId);
  return rankLookup.get(key) ?? 9999;
}

export function compareCompetitionsByPopularity(nameA: string, nameB: string): number {
  const rankA = getCompetitionPopularityRank(nameA);
  const rankB = getCompetitionPopularityRank(nameB);
  if (rankA !== rankB) {
    return rankA - rankB;
  }
  return nameA.localeCompare(nameB);
}
