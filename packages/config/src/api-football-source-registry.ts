export type CompetitionCategory =
  | 'top5_europe'
  | 'continental_cup'
  | 'europe_tier2'
  | 'europe_top_tier'
  | 'americas'
  | 'asia_pacific'
  | 'middle_east'
  | 'domestic_cup'
  | 'world_club';

export interface ApiFootballCompetitionEntry {
  entryId: string;
  sourceId: 'api-football';
  competitionId: string;
  competitionName: string;
  country: string;
  category: CompetitionCategory;
  competitionType: 'club';
  providerLeagueId: number;
  currentSeason: number;
  historicalSeasons: readonly number[];
  sourceTimezone: string;
  enabled: boolean;
}

export interface ApiFootballQuotaConfig {
  dailyLimit: number;
  hardCeiling: number;
  reserveBudget: number;
  concludingWindowStartMinutes: number;
  concludingWindowEndMinutes: number;
  pollingIntervalSeconds: number;
}

export const API_FOOTBALL_QUOTA_CONFIG: ApiFootballQuotaConfig = Object.freeze({
  dailyLimit: 100,
  hardCeiling: 85,
  reserveBudget: 15,
  concludingWindowStartMinutes: 88,
  concludingWindowEndMinutes: 115,
  pollingIntervalSeconds: 150
});

export const API_FOOTBALL_COMPETITION_REGISTRY: readonly ApiFootballCompetitionEntry[] = Object.freeze([
  // 1. Top 5 European Leagues & Continental Cups (12)
  {
    entryId: 'api-football-eng-premier-league',
    sourceId: 'api-football',
    competitionId: 'eng-premier-league',
    competitionName: 'Premier League',
    country: 'England',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 39,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  },
  {
    entryId: 'api-football-esp-la-liga',
    sourceId: 'api-football',
    competitionId: 'esp-la-liga',
    competitionName: 'La Liga',
    country: 'Spain',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 140,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Madrid',
    enabled: true
  },
  {
    entryId: 'api-football-ita-serie-a',
    sourceId: 'api-football',
    competitionId: 'ita-serie-a',
    competitionName: 'Serie A',
    country: 'Italy',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 135,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Rome',
    enabled: true
  },
  {
    entryId: 'api-football-ger-bundesliga',
    sourceId: 'api-football',
    competitionId: 'ger-bundesliga',
    competitionName: 'Bundesliga',
    country: 'Germany',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 78,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Berlin',
    enabled: true
  },
  {
    entryId: 'api-football-fra-ligue-1',
    sourceId: 'api-football',
    competitionId: 'fra-ligue-1',
    competitionName: 'Ligue 1',
    country: 'France',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 61,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-uefa-champions-league',
    sourceId: 'api-football',
    competitionId: 'uefa-champions-league',
    competitionName: 'UEFA Champions League',
    country: 'Europe',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 2,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-uefa-europa-league',
    sourceId: 'api-football',
    competitionId: 'uefa-europa-league',
    competitionName: 'UEFA Europa League',
    country: 'Europe',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 3,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-uefa-conference-league',
    sourceId: 'api-football',
    competitionId: 'uefa-conference-league',
    competitionName: 'UEFA Conference League',
    country: 'Europe',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 848,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-uefa-super-cup',
    sourceId: 'api-football',
    competitionId: 'uefa-super-cup',
    competitionName: 'UEFA Super Cup',
    country: 'Europe',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 531,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-conmebol-copa-libertadores',
    sourceId: 'api-football',
    competitionId: 'conmebol-copa-libertadores',
    competitionName: 'Copa Libertadores',
    country: 'South America',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 13,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/Sao_Paulo',
    enabled: true
  },
  {
    entryId: 'api-football-conmebol-copa-sudamericana',
    sourceId: 'api-football',
    competitionId: 'conmebol-copa-sudamericana',
    competitionName: 'Copa Sudamericana',
    country: 'South America',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 11,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/Sao_Paulo',
    enabled: true
  },
  {
    entryId: 'api-football-afc-champions-league-elite',
    sourceId: 'api-football',
    competitionId: 'afc-champions-league-elite',
    competitionName: 'AFC Champions League Elite',
    country: 'Asia',
    category: 'continental_cup',
    competitionType: 'club',
    providerLeagueId: 17,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Riyadh',
    enabled: true
  },

  // 2. European Second Tiers & Other Major European Leagues (17)
  {
    entryId: 'api-football-eng-championship',
    sourceId: 'api-football',
    competitionId: 'eng-championship',
    competitionName: 'Championship',
    country: 'England',
    category: 'europe_tier2',
    competitionType: 'club',
    providerLeagueId: 40,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  },
  {
    entryId: 'api-football-esp-segunda-division',
    sourceId: 'api-football',
    competitionId: 'esp-segunda-division',
    competitionName: 'La Liga 2',
    country: 'Spain',
    category: 'europe_tier2',
    competitionType: 'club',
    providerLeagueId: 141,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Madrid',
    enabled: true
  },
  {
    entryId: 'api-football-ita-serie-b',
    sourceId: 'api-football',
    competitionId: 'ita-serie-b',
    competitionName: 'Serie B',
    country: 'Italy',
    category: 'europe_tier2',
    competitionType: 'club',
    providerLeagueId: 136,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Rome',
    enabled: true
  },
  {
    entryId: 'api-football-ger-2-bundesliga',
    sourceId: 'api-football',
    competitionId: 'ger-2-bundesliga',
    competitionName: '2. Bundesliga',
    country: 'Germany',
    category: 'europe_tier2',
    competitionType: 'club',
    providerLeagueId: 79,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Berlin',
    enabled: true
  },
  {
    entryId: 'api-football-fra-ligue-2',
    sourceId: 'api-football',
    competitionId: 'fra-ligue-2',
    competitionName: 'Ligue 2',
    country: 'France',
    category: 'europe_tier2',
    competitionType: 'club',
    providerLeagueId: 62,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-ned-eredivisie',
    sourceId: 'api-football',
    competitionId: 'ned-eredivisie',
    competitionName: 'Eredivisie',
    country: 'Netherlands',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 88,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Amsterdam',
    enabled: true
  },
  {
    entryId: 'api-football-por-primeira-liga',
    sourceId: 'api-football',
    competitionId: 'por-primeira-liga',
    competitionName: 'Primeira Liga',
    country: 'Portugal',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 94,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Lisbon',
    enabled: true
  },
  {
    entryId: 'api-football-bel-pro-league',
    sourceId: 'api-football',
    competitionId: 'bel-pro-league',
    competitionName: 'Belgian Pro League',
    country: 'Belgium',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 144,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Brussels',
    enabled: true
  },
  {
    entryId: 'api-football-sco-premiership',
    sourceId: 'api-football',
    competitionId: 'sco-premiership',
    competitionName: 'Scottish Premiership',
    country: 'Scotland',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 179,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  },
  {
    entryId: 'api-football-tur-super-lig',
    sourceId: 'api-football',
    competitionId: 'tur-super-lig',
    competitionName: 'Süper Lig',
    country: 'Turkey',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 203,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Istanbul',
    enabled: true
  },
  {
    entryId: 'api-football-sui-super-league',
    sourceId: 'api-football',
    competitionId: 'sui-super-league',
    competitionName: 'Swiss Super League',
    country: 'Switzerland',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 207,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Zurich',
    enabled: true
  },
  {
    entryId: 'api-football-aut-bundesliga',
    sourceId: 'api-football',
    competitionId: 'aut-bundesliga',
    competitionName: 'Austrian Bundesliga',
    country: 'Austria',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 218,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Vienna',
    enabled: true
  },
  {
    entryId: 'api-football-den-superliga',
    sourceId: 'api-football',
    competitionId: 'den-superliga',
    competitionName: 'Danish Superliga',
    country: 'Denmark',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 119,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Copenhagen',
    enabled: true
  },
  {
    entryId: 'api-football-gre-super-league-1',
    sourceId: 'api-football',
    competitionId: 'gre-super-league-1',
    competitionName: 'Greek Super League 1',
    country: 'Greece',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 197,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Athens',
    enabled: true
  },
  {
    entryId: 'api-football-swe-allsvenskan',
    sourceId: 'api-football',
    competitionId: 'swe-allsvenskan',
    competitionName: 'Allsvenskan',
    country: 'Sweden',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 113,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Stockholm',
    enabled: true
  },
  {
    entryId: 'api-football-nor-eliteserien',
    sourceId: 'api-football',
    competitionId: 'nor-eliteserien',
    competitionName: 'Eliteserien',
    country: 'Norway',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 103,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Oslo',
    enabled: true
  },
  {
    entryId: 'api-football-pol-ekstraklasa',
    sourceId: 'api-football',
    competitionId: 'pol-ekstraklasa',
    competitionName: 'Ekstraklasa',
    country: 'Poland',
    category: 'europe_top_tier',
    competitionType: 'club',
    providerLeagueId: 106,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Warsaw',
    enabled: true
  },

  // 3. Americas, Middle East & Asia-Pacific Leagues (13)
  {
    entryId: 'api-football-sau-pro-league',
    sourceId: 'api-football',
    competitionId: 'sau-pro-league',
    competitionName: 'Saudi Pro League',
    country: 'Saudi Arabia',
    category: 'middle_east',
    competitionType: 'club',
    providerLeagueId: 307,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Riyadh',
    enabled: true
  },
  {
    entryId: 'api-football-usa-mls',
    sourceId: 'api-football',
    competitionId: 'usa-mls',
    competitionName: 'Major League Soccer',
    country: 'USA',
    category: 'americas',
    competitionType: 'club',
    providerLeagueId: 253,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/New_York',
    enabled: true
  },
  {
    entryId: 'api-football-mex-liga-mx',
    sourceId: 'api-football',
    competitionId: 'mex-liga-mx',
    competitionName: 'Liga MX',
    country: 'Mexico',
    category: 'americas',
    competitionType: 'club',
    providerLeagueId: 262,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/Mexico_City',
    enabled: true
  },
  {
    entryId: 'api-football-bra-serie-a',
    sourceId: 'api-football',
    competitionId: 'bra-serie-a',
    competitionName: 'Brasileirão Série A',
    country: 'Brazil',
    category: 'americas',
    competitionType: 'club',
    providerLeagueId: 71,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/Sao_Paulo',
    enabled: true
  },
  {
    entryId: 'api-football-arg-primera-division',
    sourceId: 'api-football',
    competitionId: 'arg-primera-division',
    competitionName: 'Primera División',
    country: 'Argentina',
    category: 'americas',
    competitionType: 'club',
    providerLeagueId: 128,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/Argentina/Buenos_Aires',
    enabled: true
  },
  {
    entryId: 'api-football-col-primera-a',
    sourceId: 'api-football',
    competitionId: 'col-primera-a',
    competitionName: 'Categoría Primera A',
    country: 'Colombia',
    category: 'americas',
    competitionType: 'club',
    providerLeagueId: 239,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'America/Bogota',
    enabled: true
  },
  {
    entryId: 'api-football-jpn-j1-league',
    sourceId: 'api-football',
    competitionId: 'jpn-j1-league',
    competitionName: 'J1 League',
    country: 'Japan',
    category: 'asia_pacific',
    competitionType: 'club',
    providerLeagueId: 98,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Tokyo',
    enabled: true
  },
  {
    entryId: 'api-football-kor-k-league-1',
    sourceId: 'api-football',
    competitionId: 'kor-k-league-1',
    competitionName: 'K League 1',
    country: 'South Korea',
    category: 'asia_pacific',
    competitionType: 'club',
    providerLeagueId: 292,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Seoul',
    enabled: true
  },
  {
    entryId: 'api-football-aus-a-league',
    sourceId: 'api-football',
    competitionId: 'aus-a-league',
    competitionName: 'A-League Men',
    country: 'Australia',
    category: 'asia_pacific',
    competitionType: 'club',
    providerLeagueId: 188,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Australia/Sydney',
    enabled: true
  },
  {
    entryId: 'api-football-chn-csl',
    sourceId: 'api-football',
    competitionId: 'chn-csl',
    competitionName: 'Chinese Super League',
    country: 'China',
    category: 'asia_pacific',
    competitionType: 'club',
    providerLeagueId: 169,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Shanghai',
    enabled: true
  },
  {
    entryId: 'api-football-tha-league-1',
    sourceId: 'api-football',
    competitionId: 'tha-league-1',
    competitionName: 'Thai League 1',
    country: 'Thailand',
    category: 'asia_pacific',
    competitionType: 'club',
    providerLeagueId: 299,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Bangkok',
    enabled: true
  },
  {
    entryId: 'api-football-vie-v-league-1',
    sourceId: 'api-football',
    competitionId: 'vie-v-league-1',
    competitionName: 'V.League 1',
    country: 'Vietnam',
    category: 'asia_pacific',
    competitionType: 'club',
    providerLeagueId: 340,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Asia/Ho_Chi_Minh',
    enabled: true
  },
  {
    entryId: 'api-football-fifa-club-world-cup',
    sourceId: 'api-football',
    competitionId: 'fifa-club-world-cup',
    competitionName: 'FIFA Club World Cup',
    country: 'World',
    category: 'world_club',
    competitionType: 'club',
    providerLeagueId: 15,
    currentSeason: 2026,
    historicalSeasons: [2023, 2025],
    sourceTimezone: 'UTC',
    enabled: true
  },

  // 4. Major Domestic Cups (8)
  {
    entryId: 'api-football-eng-fa-cup',
    sourceId: 'api-football',
    competitionId: 'eng-fa-cup',
    competitionName: 'FA Cup',
    country: 'England',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 45,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  },
  {
    entryId: 'api-football-eng-efl-cup',
    sourceId: 'api-football',
    competitionId: 'eng-efl-cup',
    competitionName: 'EFL Cup',
    country: 'England',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 48,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  },
  {
    entryId: 'api-football-esp-copa-del-rey',
    sourceId: 'api-football',
    competitionId: 'esp-copa-del-rey',
    competitionName: 'Copa del Rey',
    country: 'Spain',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 143,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Madrid',
    enabled: true
  },
  {
    entryId: 'api-football-ger-dfb-pokal',
    sourceId: 'api-football',
    competitionId: 'ger-dfb-pokal',
    competitionName: 'DFB-Pokal',
    country: 'Germany',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 81,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Berlin',
    enabled: true
  },
  {
    entryId: 'api-football-ita-coppa-italia',
    sourceId: 'api-football',
    competitionId: 'ita-coppa-italia',
    competitionName: 'Coppa Italia',
    country: 'Italy',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 137,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Rome',
    enabled: true
  },
  {
    entryId: 'api-football-fra-coupe-de-france',
    sourceId: 'api-football',
    competitionId: 'fra-coupe-de-france',
    competitionName: 'Coupe de France',
    country: 'France',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 66,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Paris',
    enabled: true
  },
  {
    entryId: 'api-football-por-taca-de-portugal',
    sourceId: 'api-football',
    competitionId: 'por-taca-de-portugal',
    competitionName: 'Taça de Portugal',
    country: 'Portugal',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 96,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Lisbon',
    enabled: true
  },
  {
    entryId: 'api-football-ned-knvb-beker',
    sourceId: 'api-football',
    competitionId: 'ned-knvb-beker',
    competitionName: 'KNVB Beker',
    country: 'Netherlands',
    category: 'domestic_cup',
    competitionType: 'club',
    providerLeagueId: 90,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/Amsterdam',
    enabled: true
  }
]);

export function getEnabledCompetitions(): readonly ApiFootballCompetitionEntry[] {
  return API_FOOTBALL_COMPETITION_REGISTRY.filter((entry) => entry.enabled);
}

export function findCompetitionByLeagueId(leagueId: number): ApiFootballCompetitionEntry | undefined {
  return API_FOOTBALL_COMPETITION_REGISTRY.find((entry) => entry.providerLeagueId === leagueId);
}

export function findCompetitionByEntryId(entryId: string): ApiFootballCompetitionEntry | undefined {
  return API_FOOTBALL_COMPETITION_REGISTRY.find((entry) => entry.entryId === entryId);
}

export function getHydrationSeasonsForCompetition(entry: ApiFootballCompetitionEntry): readonly number[] {
  const seasons = new Set<number>([entry.currentSeason, ...entry.historicalSeasons]);
  return Array.from(seasons).sort((a, b) => a - b);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

function hasValidIanaTimezone(value: unknown): boolean {
  if (!isNonEmptyString(value)) return false;
  if (value === 'UTC') return true;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function validateApiFootballSourceRegistry(entries: readonly unknown[]): string[] {
  const errors: string[] = [];
  const entryIds = new Set<string>();
  const leagueIds = new Set<number>();
  let enabledCount = 0;

  if (!Array.isArray(entries) || entries.length === 0) {
    return ['Registry entries must be a non-empty array'];
  }

  entries.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`entries[${index}] must be an object`);
      return;
    }

    if (!isNonEmptyString(entry.entryId)) {
      errors.push(`entries[${index}].entryId must be a non-empty string`);
    } else if (entryIds.has(entry.entryId)) {
      errors.push(`entries[${index}] has duplicate entryId: ${entry.entryId}`);
    } else {
      entryIds.add(entry.entryId);
    }

    if (entry.sourceId !== 'api-football') {
      errors.push(`entries[${index}].sourceId must be "api-football"`);
    }

    if (!isNonEmptyString(entry.competitionId)) {
      errors.push(`entries[${index}].competitionId must be a non-empty string`);
    }

    if (!isNonEmptyString(entry.competitionName)) {
      errors.push(`entries[${index}].competitionName must be a non-empty string`);
    }

    if (!isNonEmptyString(entry.country)) {
      errors.push(`entries[${index}].country must be a non-empty string`);
    }

    if (entry.competitionType !== 'club') {
      errors.push(`entries[${index}].competitionType must be "club"`);
    }

    if (typeof entry.providerLeagueId !== 'number' || !Number.isInteger(entry.providerLeagueId) || entry.providerLeagueId <= 0) {
      errors.push(`entries[${index}].providerLeagueId must be a positive integer`);
    } else if (leagueIds.has(entry.providerLeagueId)) {
      errors.push(`entries[${index}] has duplicate providerLeagueId: ${entry.providerLeagueId}`);
    } else {
      leagueIds.add(entry.providerLeagueId);
    }

    if (typeof entry.currentSeason !== 'number' || !Number.isInteger(entry.currentSeason) || entry.currentSeason < 2000) {
      errors.push(`entries[${index}].currentSeason must be a valid 4-digit year`);
    }

    if (!Array.isArray(entry.historicalSeasons) || entry.historicalSeasons.some((s) => typeof s !== 'number' || !Number.isInteger(s) || s < 2000)) {
      errors.push(`entries[${index}].historicalSeasons must be an array of valid 4-digit years`);
    }

    if (!hasValidIanaTimezone(entry.sourceTimezone)) {
      errors.push(`entries[${index}].sourceTimezone must be a valid IANA timezone string`);
    }

    if (typeof entry.enabled !== 'boolean') {
      errors.push(`entries[${index}].enabled must be a boolean`);
    } else if (entry.enabled) {
      enabledCount += 1;
    }
  });

  if (enabledCount === 0) {
    errors.push('Registry must contain at least one enabled competition');
  }

  return errors;
}
