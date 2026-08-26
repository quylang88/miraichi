export const SPORTSCORE_SOURCE_ORIGIN = 'https://sportscore.com' as const;
export const SPORTSCORE_REGISTRY_VALIDATED_AT = '2026-08-26' as const;

export const SPORTSCORE_COMPETITION_GROUPS = Object.freeze([
  'top_and_continental',
  'europe_secondary_and_major',
  'americas_middle_east_asia_world',
  'major_domestic_cups'
] as const);

export type SportScoreCompetitionGroup = typeof SPORTSCORE_COMPETITION_GROUPS[number];
export type SportScoreCompetitionType = 'club' | 'national-team';
export type SportScoreSeasonPolicy = 'current';

export interface SportScoreCompetitionEntry {
  entryId: string;
  sourceId: 'sportscore';
  competitionId: string;
  competitionName: string;
  country: string;
  group: SportScoreCompetitionGroup;
  competitionType: SportScoreCompetitionType;
  providerCountrySlug: string;
  providerCompetitionSlug: string;
  providerCompetitionId: string;
  competitionUrl: string;
  seasonPolicy: SportScoreSeasonPolicy;
  sourceTimezone: string;
  mappingValidatedAt: typeof SPORTSCORE_REGISTRY_VALIDATED_AT;
  enabled: boolean;
}

export type SportScoreRegistryValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

type EntryInput = readonly [
  competitionId: string,
  competitionName: string,
  country: string,
  group: SportScoreCompetitionGroup,
  providerCountrySlug: string,
  providerCompetitionSlug: string,
  providerCompetitionId: string,
  sourceTimezone: string
];

function competitionEntry(input: EntryInput): SportScoreCompetitionEntry {
  const [
    competitionId,
    competitionName,
    country,
    group,
    providerCountrySlug,
    providerCompetitionSlug,
    providerCompetitionId,
    sourceTimezone
  ] = input;

  return Object.freeze({
    entryId: `sportscore-${competitionId}`,
    sourceId: 'sportscore',
    competitionId,
    competitionName,
    country,
    group,
    competitionType: 'club',
    providerCountrySlug,
    providerCompetitionSlug,
    providerCompetitionId,
    competitionUrl: `${SPORTSCORE_SOURCE_ORIGIN}/football/competition/${providerCountrySlug}/${providerCompetitionSlug}/${providerCompetitionId}/`,
    seasonPolicy: 'current',
    sourceTimezone,
    mappingValidatedAt: SPORTSCORE_REGISTRY_VALIDATED_AT,
    enabled: true
  });
}

const TOP_AND_CONTINENTAL: readonly EntryInput[] = [
  ['eng-premier-league', 'Premier League', 'England', 'top_and_continental', 'england', 'english-premier-league', 'jednm9whz0ryox8', 'Europe/London'],
  ['esp-la-liga', 'La Liga', 'Spain', 'top_and_continental', 'spain', 'spanish-la-liga', 'vl7oqdehlyr510j', 'Europe/Madrid'],
  ['ita-serie-a', 'Serie A', 'Italy', 'top_and_continental', 'italy', 'italian-serie-a', '4zp5rzghp5q82w1', 'Europe/Rome'],
  ['ger-bundesliga', 'Bundesliga', 'Germany', 'top_and_continental', 'germany', 'bundesliga', 'gy0or5jhg6qwzv3', 'Europe/Berlin'],
  ['fra-ligue-1', 'Ligue 1', 'France', 'top_and_continental', 'france', 'french-ligue-1', 'yl5ergphnzr8k0o', 'Europe/Paris'],
  ['uefa-champions-league', 'UEFA Champions League', 'Europe', 'top_and_continental', 'world', 'uefa-champions-league', 'z8yomo4h7wq0j6l', 'Europe/Paris'],
  ['uefa-europa-league', 'UEFA Europa League', 'Europe', 'top_and_continental', 'world', 'uefa-europa-league', '56ypq3nh0xmd7oj', 'Europe/Paris'],
  ['uefa-conference-league', 'UEFA Conference League', 'Europe', 'top_and_continental', 'world', 'uefa-europa-conference-league', 'p4jwq2gh754m0ve', 'Europe/Paris'],
  ['uefa-super-cup', 'UEFA Super Cup', 'Europe', 'top_and_continental', 'world', 'uefa-super-cup', 'p3glrw7h1wqdyjv', 'Europe/Paris'],
  ['conmebol-copa-libertadores', 'Copa Libertadores', 'South America', 'top_and_continental', 'world', 'conmebol-copa-libertadores', 'v2y8m4zhe6ql074', 'America/Sao_Paulo'],
  ['conmebol-copa-sudamericana', 'Copa Sudamericana', 'South America', 'top_and_continental', 'world', 'conmebol-copa-sudamericana', '56ypq3nhpkmd7oj', 'America/Sao_Paulo'],
  ['afc-champions-league-elite', 'AFC Champions League Elite', 'Asia', 'top_and_continental', 'world', 'afc-champions-league-elite', 'z8yomo4hg66q0j6', 'Asia/Riyadh']
];

const EUROPE_SECONDARY_AND_MAJOR: readonly EntryInput[] = [
  ['eng-championship', 'Championship', 'England', 'europe_secondary_and_major', 'england', 'english-football-league-championship', 'l965mkyh32r1ge4', 'Europe/London'],
  ['esp-segunda-division', 'La Liga 2', 'Spain', 'europe_secondary_and_major', 'spain', 'spanish-segunda-division', 'kdj2ryohnkq1zpg', 'Europe/Madrid'],
  ['ita-serie-b', 'Serie B', 'Italy', 'europe_secondary_and_major', 'italy', 'italian-serie-b', 'j1l4rjnhx9m7vx5', 'Europe/Rome'],
  ['ger-2-bundesliga', '2. Bundesliga', 'Germany', 'europe_secondary_and_major', 'germany', 'german-bundesliga-2', 'kn54qllhjzqvy9d', 'Europe/Berlin'],
  ['fra-ligue-2', 'Ligue 2', 'France', 'europe_secondary_and_major', 'france', 'french-ligue-2', 'kjw2r09hw8rz84o', 'Europe/Paris'],
  ['ned-eredivisie', 'Eredivisie', 'Netherlands', 'europe_secondary_and_major', 'netherlands', 'netherlands-eredivisie', 'vl7oqdeheyr510j', 'Europe/Amsterdam'],
  ['por-primeira-liga', 'Primeira Liga', 'Portugal', 'europe_secondary_and_major', 'portugal', 'portuguese-primera-liga', '9vjxm8ghx2r6odg', 'Europe/Lisbon'],
  ['bel-pro-league', 'Belgian Pro League', 'Belgium', 'europe_secondary_and_major', 'belgium', 'belgian-pro-league', '9vjxm8gh22r6odg', 'Europe/Brussels'],
  ['sco-premiership', 'Scottish Premiership', 'Scotland', 'europe_secondary_and_major', 'scotland', 'scottish-premiership', 'p4jwq2gh1gm0veo', 'Europe/London'],
  ['tur-super-lig', 'Süper Lig', 'Turkey', 'europe_secondary_and_major', 'turkey', 'turkish-super-league', '8y39mp1h6jmojxg', 'Europe/Istanbul'],
  ['sui-super-league', 'Swiss Super League', 'Switzerland', 'europe_secondary_and_major', 'switzerland', 'switzerland-super-league', 'z8yomo4hx9q0j6l', 'Europe/Zurich'],
  ['aut-bundesliga', 'Austrian Bundesliga', 'Austria', 'europe_secondary_and_major', 'austria', 'austrian-bundesliga', 'yl5ergphyvr8k0o', 'Europe/Vienna'],
  ['den-superliga', 'Danish Superliga', 'Denmark', 'europe_secondary_and_major', 'denmark', 'danish-superliga', '4zp5rzgh0eq82w1', 'Europe/Copenhagen'],
  ['gre-super-league-1', 'Greek Super League 1', 'Greece', 'europe_secondary_and_major', 'greece', 'greek-super-league', 'e4wyrn4hoeq86pv', 'Europe/Athens'],
  ['swe-allsvenskan', 'Allsvenskan', 'Sweden', 'europe_secondary_and_major', 'sweden', 'sweden-allsvenskan', 'l965mkyhg0r1ge4', 'Europe/Stockholm'],
  ['nor-eliteserien', 'Eliteserien', 'Norway', 'europe_secondary_and_major', 'norway', 'norwegian-eliteserien', 'gy0or5jhj6qwzv3', 'Europe/Oslo'],
  ['pol-ekstraklasa', 'Ekstraklasa', 'Poland', 'europe_secondary_and_major', 'poland', 'pko-bank-polski-ekstraklasa', 'vl7oqdeh3lr510j', 'Europe/Warsaw']
];

const AMERICAS_MIDDLE_EAST_ASIA_WORLD: readonly EntryInput[] = [
  ['sau-pro-league', 'Saudi Pro League', 'Saudi Arabia', 'americas_middle_east_asia_world', 'saudi-arabia', 'saudi-professional-league', 'j1l4rjnh66nm7vx', 'Asia/Riyadh'],
  ['usa-mls', 'Major League Soccer', 'USA', 'americas_middle_east_asia_world', 'united-states', 'united-states-major-league-soccer', 'kn54qllhg2qvy9d', 'America/New_York'],
  ['mex-liga-mx', 'Liga MX', 'Mexico', 'americas_middle_east_asia_world', 'mexico', 'mexico-liga-mx', '9k82rekhp6repzj', 'America/Mexico_City'],
  ['bra-serie-a', 'Brasileirão Série A', 'Brazil', 'americas_middle_east_asia_world', 'brazil', 'brazilian-serie-a', '4zp5rzgh9zq82w1', 'America/Sao_Paulo'],
  ['arg-primera-division', 'Primera División', 'Argentina', 'americas_middle_east_asia_world', 'argentina', 'argentine-division-1', 'p3glrw7hevqdyjv', 'America/Argentina/Buenos_Aires'],
  ['col-primera-a', 'Categoría Primera A', 'Colombia', 'americas_middle_east_asia_world', 'colombia', 'categoria-primera-a', '56ypq3nhyymd7oj', 'America/Bogota'],
  ['jpn-j1-league', 'J1 League', 'Japan', 'americas_middle_east_asia_world', 'japan', 'japanese-j1-league', 'z318q66hl1qo9jd', 'Asia/Tokyo'],
  ['kor-k-league-1', 'K League 1', 'South Korea', 'americas_middle_east_asia_world', 'south-korea', 'korean-k-league-1', 'gy0or5jhlxgqwzv', 'Asia/Seoul'],
  ['aus-a-league', 'A-League Men', 'Australia', 'americas_middle_east_asia_world', 'australia', 'australia-a-league', '9k82rekhvz2repz', 'Australia/Sydney'],
  ['chn-csl', 'Chinese Super League', 'China', 'americas_middle_east_asia_world', 'china', 'chinese-football-super-league', '9k82rekh52repzj', 'Asia/Shanghai'],
  ['tha-league-1', 'Thai League 1', 'Thailand', 'americas_middle_east_asia_world', 'thailand', 'thai-league-1', 'kn54qllh2xpqvy9', 'Asia/Bangkok'],
  ['vie-v-league-1', 'V.League 1', 'Vietnam', 'americas_middle_east_asia_world', 'vietnam', 'vietnam-national-champion-league', 'p4jwq2gh4xwm0ve', 'Asia/Ho_Chi_Minh'],
  ['fifa-club-world-cup', 'FIFA Club World Cup', 'World', 'americas_middle_east_asia_world', 'world', 'fifa-club-world-cup', '9vjxm8ghllzr6od', 'UTC']
];

const MAJOR_DOMESTIC_CUPS: readonly EntryInput[] = [
  ['eng-fa-cup', 'FA Cup', 'England', 'major_domestic_cups', 'england', 'fa-cup', '9vjxm8gh8gr6odg', 'Europe/London'],
  ['eng-efl-cup', 'EFL Cup', 'England', 'major_domestic_cups', 'england', 'english-football-league-cup', 'gx7lm7phw0m2wdk', 'Europe/London'],
  ['esp-copa-del-rey', 'Copa del Rey', 'Spain', 'major_domestic_cups', 'spain', 'copa-del-rey', 'gpxwrxlhzzryk0j', 'Europe/Madrid'],
  ['ger-dfb-pokal', 'DFB-Pokal', 'Germany', 'major_domestic_cups', 'germany', 'dfb-pokal', 'l965mkyhn0r1ge4', 'Europe/Berlin'],
  ['ita-coppa-italia', 'Coppa Italia', 'Italy', 'major_domestic_cups', 'italy', 'coppa-italia', '9k82rekho4repzj', 'Europe/Rome'],
  ['fra-coupe-de-france', 'Coupe de France', 'France', 'major_domestic_cups', 'france', 'coupe-de-france', '56ypq3nh1wmd7oj', 'Europe/Paris'],
  ['por-taca-de-portugal', 'Taça de Portugal', 'Portugal', 'major_domestic_cups', 'portugal', 'portuguese-cup', 'd23xmvkhxpqg8ny', 'Europe/Lisbon'],
  ['ned-knvb-beker', 'KNVB Beker', 'Netherlands', 'major_domestic_cups', 'netherlands', 'netherlands-knvb-cup', 'gpxwrxlh2zryk0j', 'Europe/Amsterdam']
];

export const SPORTSCORE_COMPETITION_REGISTRY: readonly SportScoreCompetitionEntry[] = Object.freeze([
  ...TOP_AND_CONTINENTAL.map(competitionEntry),
  ...EUROPE_SECONDARY_AND_MAJOR.map(competitionEntry),
  ...AMERICAS_MIDDLE_EAST_ASIA_WORLD.map(competitionEntry),
  ...MAJOR_DOMESTIC_CUPS.map(competitionEntry)
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PROVIDER_ID_PATTERN = /^[a-z0-9]+$/;

export function validateSportScoreCompetitionRegistry(
  entries: readonly SportScoreCompetitionEntry[]
): SportScoreRegistryValidationResult {
  const errors: string[] = [];
  const seen = {
    entryId: new Set<string>(),
    competitionId: new Set<string>(),
    providerCompetitionSlug: new Set<string>(),
    providerCompetitionId: new Set<string>(),
    competitionUrl: new Set<string>()
  };

  entries.forEach((entry, index) => {
    const prefix = `entries[${index}]`;
    validateRequiredString(entry.entryId, `${prefix}.entryId`, errors);
    validateRequiredString(entry.competitionId, `${prefix}.competitionId`, errors);
    validateRequiredString(entry.competitionName, `${prefix}.competitionName`, errors);
    validateRequiredString(entry.country, `${prefix}.country`, errors);
    validateRequiredString(entry.sourceTimezone, `${prefix}.sourceTimezone`, errors);

    if (entry.sourceId !== 'sportscore') {
      errors.push(`${prefix}.sourceId must be "sportscore"`);
    }
    if (!SPORTSCORE_COMPETITION_GROUPS.includes(entry.group)) {
      errors.push(`${prefix}.group is unsupported`);
    }
    if (entry.competitionType !== 'club' && entry.competitionType !== 'national-team') {
      errors.push(`${prefix}.competitionType must be club or national-team`);
    }
    if (!SLUG_PATTERN.test(entry.providerCountrySlug)) {
      errors.push(`${prefix}.providerCountrySlug must be a lowercase slug`);
    }
    if (!SLUG_PATTERN.test(entry.providerCompetitionSlug)) {
      errors.push(`${prefix}.providerCompetitionSlug must be a lowercase slug`);
    }
    if (!PROVIDER_ID_PATTERN.test(entry.providerCompetitionId)) {
      errors.push(`${prefix}.providerCompetitionId must be lowercase alphanumeric`);
    }
    if (entry.seasonPolicy !== 'current') {
      errors.push(`${prefix}.seasonPolicy must be current`);
    }
    if (entry.mappingValidatedAt !== SPORTSCORE_REGISTRY_VALIDATED_AT) {
      errors.push(`${prefix}.mappingValidatedAt must match the registry validation date`);
    }
    if (typeof entry.enabled !== 'boolean') {
      errors.push(`${prefix}.enabled must be boolean`);
    }

    const expectedUrl = `${SPORTSCORE_SOURCE_ORIGIN}/football/competition/${entry.providerCountrySlug}/${entry.providerCompetitionSlug}/${entry.providerCompetitionId}/`;
    if (entry.competitionUrl !== expectedUrl || !hasExpectedOrigin(entry.competitionUrl)) {
      errors.push(`${prefix}.competitionUrl must be the exact HTTPS SportScore competition URL`);
    }

    for (const field of Object.keys(seen) as Array<keyof typeof seen>) {
      const value = entry[field];
      if (seen[field].has(value)) {
        errors.push(`${prefix}.${field} must be unique`);
      }
      seen[field].add(value);
    }
  });

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function validateRequiredString(value: unknown, field: string, errors: string[]): void {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${field} must be a non-empty string`);
  }
}

function hasExpectedOrigin(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.origin === SPORTSCORE_SOURCE_ORIGIN && parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

