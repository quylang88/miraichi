import {
  SPORTSCORE_COMPETITION_REGISTRY,
  type SportScoreCompetitionGroup,
  type SportScoreCompetitionType
} from './sportscore-source-registry.js';

export const SOURCE_REGISTRY_VALIDATED_AT = '2026-08-31' as const;
export const OPENFOOTBALL_VERIFIED_TREE_SHA =
  '4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f' as const;

export type SeasonCycle = 'cross-year' | 'calendar-year';
export type SeasonSourceId =
  | 'fotmob-unofficial'
  | 'espn-unofficial'
  | 'openfootball'
  | 'football-data-org'
  | 'sportscore-widget';
export type EndpointKind =
  | 'season-file'
  | 'season-api'
  | 'paginated-season'
  | 'daily-api'
  | 'match-api'
  | 'none';
export type CoverageStatus = 'supported' | 'partial' | 'unsupported';
export type SourceExecutionStatus = 'enabled' | 'disabled' | 'pending-owner' | 'not-implemented';

export interface SourceRecordCoverage {
  total: number;
  exactKickoff: number;
}

export interface CompetitionSourceBinding {
  sourceId: SeasonSourceId;
  externalCompetitionId: string;
  endpointKind: Exclude<EndpointKind, 'none'>;
  urlTemplate: string;
  verificationUrl: string;
  mappingValidatedAt: string;
  availableCanonicalSeasons: readonly string[];
  executionStatus: SourceExecutionStatus;
  requiresCredential: boolean;
  externalNumericId?: number;
  externalCountryCode?: string;
  providerSeasonByCanonicalSeason?: Readonly<Record<string, string>>;
  currentRecordCoverage?: SourceRecordCoverage;
}

export interface CompetitionSourceEntry {
  entryId: string;
  competitionId: string;
  competitionName: string;
  country: string;
  group: SportScoreCompetitionGroup;
  competitionType: SportScoreCompetitionType;
  sourceTimezone: string;
  seasonCycle: SeasonCycle;
  coverageStatus: CoverageStatus;
  fixtureSource: SeasonSourceId | 'none';
  resultSource: SeasonSourceId | 'none';
  detailSource: SeasonSourceId | 'none';
  externalCompetitionId: string | null;
  endpointKind: EndpointKind;
  sourceBindings: {
    fixture?: CompetitionSourceBinding;
    result?: CompetitionSourceBinding;
    detail?: CompetitionSourceBinding;
    fixtureFallbacks?: readonly CompetitionSourceBinding[];
    resultFallbacks?: readonly CompetitionSourceBinding[];
  };
}

export type CompetitionSourceRegistryValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

interface FotMobMapping {
  id: number;
  ccode: string;
  status: Exclude<CoverageStatus, 'unsupported'>;
  currentProviderSeason?: string;
  espn?: string;
  currentAvailable?: boolean;
}

interface OpenFootballMapping {
  file: string;
  seasons: readonly string[];
  currentRecordCoverage?: SourceRecordCoverage;
}

interface FootballDataMapping {
  code: string;
  numericId: number;
  seasons: readonly string[];
}

const FOTMOB_MAPPINGS: Readonly<Record<string, FotMobMapping>> = Object.freeze({
  'eng-premier-league': fm(47, 'ENG', 'supported', 'eng.1'),
  'esp-la-liga': fm(87, 'ESP', 'supported', 'esp.1'),
  'ita-serie-a': fm(55, 'ITA', 'supported', 'ita.1'),
  'ger-bundesliga': fm(54, 'GER', 'supported', 'ger.1'),
  'fra-ligue-1': fm(53, 'FRA', 'supported', 'fra.1'),
  'uefa-champions-league': fm(42, 'INT', 'supported', 'uefa.champions'),
  'uefa-europa-league': fm(73, 'INT', 'supported', 'uefa.europa'),
  'uefa-conference-league': fm(10216, 'INT', 'supported', 'uefa.europa.conf'),
  'uefa-super-cup': fm(74, 'INT', 'partial', 'uefa.super_cup', '2025/2026'),
  'conmebol-copa-libertadores': fm(45, 'INT', 'supported', 'conmebol.libertadores'),
  'conmebol-copa-sudamericana': fm(299, 'INT', 'supported', 'conmebol.sudamericana'),
  'afc-champions-league-elite': fm(525, 'INT', 'supported', 'afc.champions'),
  'eng-championship': fm(48, 'ENG', 'supported', 'eng.2'),
  'esp-segunda-division': fm(140, 'ESP', 'supported', 'esp.2'),
  'ita-serie-b': fm(86, 'ITA', 'supported', 'ita.2'),
  'ger-2-bundesliga': fm(146, 'GER', 'supported', 'ger.2'),
  'fra-ligue-2': fm(110, 'FRA', 'supported', 'fra.2'),
  'ned-eredivisie': fm(57, 'NED', 'supported', 'ned.1'),
  'por-primeira-liga': fm(61, 'POR', 'supported', 'por.1'),
  'bel-pro-league': fm(40, 'BEL', 'supported', 'bel.1'),
  'sco-premiership': fm(64, 'SCO', 'supported', 'sco.1'),
  'tur-super-lig': fm(71, 'TUR', 'supported', 'tur.1'),
  'sui-super-league': fm(69, 'SUI', 'supported'),
  'aut-bundesliga': fm(38, 'AUT', 'supported', 'aut.1'),
  'den-superliga': fm(46, 'DEN', 'supported', 'den.1'),
  'gre-super-league-1': fm(135, 'GRE', 'supported', 'gre.1'),
  'swe-allsvenskan': fm(67, 'SWE', 'supported', 'swe.1'),
  'nor-eliteserien': fm(59, 'NOR', 'supported', 'nor.1'),
  'pol-ekstraklasa': fm(196, 'POL', 'supported'),
  'sau-pro-league': fm(536, 'KSA', 'supported', 'ksa.1'),
  'usa-mls': fm(130, 'USA', 'supported', 'usa.1'),
  'mex-liga-mx': fm(230, 'MEX', 'partial', 'mex.1', '2026/2027 - Apertura'),
  'bra-serie-a': fm(268, 'BRA', 'supported', 'bra.1'),
  'arg-primera-division': fm(112, 'ARG', 'supported', 'arg.1'),
  'col-primera-a': fm(274, 'COL', 'partial', 'col.1', '2026 - Clausura'),
  'jpn-j1-league': fm(223, 'JPN', 'supported', 'jpn.1', '2026/2027'),
  'kor-k-league-1': fm(9080, 'KOR', 'supported'),
  'aus-a-league': fm(113, 'AUS', 'supported', 'aus.1'),
  'chn-csl': fm(120, 'CHN', 'supported', 'chn.1'),
  'tha-league-1': fm(8984, 'THA', 'supported'),
  'vie-v-league-1': fm(9088, 'VIE', 'supported'),
  'fifa-club-world-cup': fm(78, 'INT', 'partial', 'fifa.cwc', '2025', false),
  'eng-fa-cup': fm(132, 'ENG', 'partial', 'eng.fa', undefined, false),
  'eng-efl-cup': fm(133, 'ENG', 'supported', 'eng.league_cup'),
  'esp-copa-del-rey': fm(138, 'ESP', 'partial', 'esp.copa_del_rey', undefined, false),
  'ger-dfb-pokal': fm(209, 'GER', 'supported', 'ger.dfb_pokal'),
  'ita-coppa-italia': fm(141, 'ITA', 'supported', 'ita.coppa_italia'),
  'fra-coupe-de-france': fm(134, 'FRA', 'partial', 'fra.coupe_de_france', undefined, false),
  'por-taca-de-portugal': fm(186, 'POR', 'partial', 'por.taca.portugal'),
  'ned-knvb-beker': fm(235, 'NED', 'partial', 'ned.cup', undefined, false)
});

const OPENFOOTBALL_MAPPINGS: Readonly<Record<string, OpenFootballMapping>> = Object.freeze({
  'eng-premier-league': openFootball('en.1.json', ['2026-27', '2025-26', '2024-25'], 380, 380),
  'esp-la-liga': openFootball('es.1.json', ['2026-27', '2025-26', '2024-25'], 380, 41),
  'ita-serie-a': openFootball('it.1.json', ['2026-27', '2025-26', '2024-25'], 380, 50),
  'ger-bundesliga': openFootball('de.1.json', ['2026-27', '2025-26', '2024-25'], 306, 45),
  'fra-ligue-1': openFootball('fr.1.json', ['2026-27', '2025-26', '2024-25'], 306, 40),
  'conmebol-copa-libertadores': openFootball('copa.l.json', ['2025']),
  'eng-championship': openFootball('en.2.json', ['2026-27', '2025-26', '2024-25'], 552, 288),
  'esp-segunda-division': openFootball('es.2.json', ['2025-26', '2024-25']),
  'ita-serie-b': openFootball('it.2.json', ['2025-26', '2024-25']),
  'ger-2-bundesliga': openFootball('de.2.json', ['2025-26', '2024-25']),
  'fra-ligue-2': openFootball('fr.2.json', ['2025-26', '2024-25']),
  'ned-eredivisie': openFootball('nl.1.json', ['2026-27', '2025-26', '2024-25'], 306, 134),
  'por-primeira-liga': openFootball('pt.1.json', ['2026-27', '2025-26', '2024-25'], 306, 35),
  'bel-pro-league': openFootball('be.1.json', ['2025-26', '2024-25']),
  'sco-premiership': openFootball('sco.1.json', ['2025-26', '2024-25']),
  'tur-super-lig': openFootball('tr.1.json', ['2025-26', '2024-25']),
  'aut-bundesliga': openFootball('at.1.json', ['2025-26', '2024-25']),
  'gre-super-league-1': openFootball('gr.1.json', ['2025-26', '2024-25']),
  'usa-mls': openFootball('mls.json', ['2025']),
  'bra-serie-a': openFootball('br.1.json', ['2026', '2025'], 380, 256),
  'arg-primera-division': openFootball('ar.1.json', ['2025']),
  'col-primera-a': openFootball('co.1.json', ['2025']),
  'jpn-j1-league': openFootball('jp.1.json', ['2025']),
  'chn-csl': openFootball('cn.1.json', ['2025'])
});

const FOOTBALL_DATA_MAPPINGS: Readonly<Record<string, FootballDataMapping>> = Object.freeze({
  'uefa-champions-league': footballData('CL', 2001, ['2026-27']),
  'por-primeira-liga': footballData('PPL', 2017, ['2026-27']),
  'eng-premier-league': footballData('PL', 2021, ['2026-27']),
  'ned-eredivisie': footballData('DED', 2003, ['2026-27']),
  'ger-bundesliga': footballData('BL1', 2002, ['2026-27']),
  'fra-ligue-1': footballData('FL1', 2015, ['2026-27']),
  'ita-serie-a': footballData('SA', 2019, ['2026-27']),
  'esp-la-liga': footballData('PD', 2014, ['2026-27']),
  'eng-championship': footballData('ELC', 2016, ['2026-27']),
  'bra-serie-a': footballData('BSA', 2013, ['2026'])
});

const CALENDAR_YEAR_COMPETITION_IDS = new Set([
  'conmebol-copa-libertadores',
  'conmebol-copa-sudamericana',
  'swe-allsvenskan',
  'nor-eliteserien',
  'usa-mls',
  'bra-serie-a',
  'arg-primera-division',
  'col-primera-a',
  'kor-k-league-1',
  'chn-csl',
  'fifa-club-world-cup'
]);

export const COMPETITION_SOURCE_REGISTRY: readonly CompetitionSourceEntry[] = Object.freeze(
  SPORTSCORE_COMPETITION_REGISTRY.map((identity) => {
    const mapping = FOTMOB_MAPPINGS[identity.competitionId];
    if (!mapping) throw new Error(`Missing FotMob mapping for ${identity.competitionId}.`);
    const seasonCycle: SeasonCycle = CALENDAR_YEAR_COMPETITION_IDS.has(identity.competitionId)
      ? 'calendar-year'
      : 'cross-year';
    const fixture = fotMobBinding(mapping, seasonCycle, 'fixture');
    const result = fotMobBinding(mapping, seasonCycle, 'result');
    const detail = fotMobBinding(mapping, seasonCycle, 'detail');
    const fixtureFallbacks = [
      ...(OPENFOOTBALL_MAPPINGS[identity.competitionId]
        ? [openFootballBinding(OPENFOOTBALL_MAPPINGS[identity.competitionId]!)]
        : []),
      ...(FOOTBALL_DATA_MAPPINGS[identity.competitionId]
        ? [footballDataBinding(FOOTBALL_DATA_MAPPINGS[identity.competitionId]!)]
        : []),
      ...(mapping.espn ? [espnBinding(mapping.espn)] : [])
    ];
    const resultFallbacks = FOOTBALL_DATA_MAPPINGS[identity.competitionId]
      ? [footballDataBinding(FOOTBALL_DATA_MAPPINGS[identity.competitionId]!)]
      : [];
    return Object.freeze({
      entryId: `source-${identity.competitionId}`,
      competitionId: identity.competitionId,
      competitionName: identity.competitionName,
      country: identity.country,
      group: identity.group,
      competitionType: identity.competitionType,
      sourceTimezone: identity.sourceTimezone,
      seasonCycle,
      coverageStatus: mapping.status,
      fixtureSource: 'fotmob-unofficial',
      resultSource: 'fotmob-unofficial',
      detailSource: 'fotmob-unofficial',
      externalCompetitionId: String(mapping.id),
      endpointKind: 'season-api',
      sourceBindings: Object.freeze({
        fixture,
        result,
        detail,
        fixtureFallbacks: Object.freeze(fixtureFallbacks),
        resultFallbacks: Object.freeze(resultFallbacks)
      })
    });
  })
);

export function validateCompetitionSourceRegistry(
  entries: readonly CompetitionSourceEntry[]
): CompetitionSourceRegistryValidationResult {
  const errors: string[] = [];
  const seenCompetitionIds = new Set<string>();
  for (const [index, entry] of entries.entries()) {
    const prefix = `entries[${index}]`;
    if (!entry.competitionId.trim()) errors.push(`${prefix}.competitionId must be non-empty`);
    if (seenCompetitionIds.has(entry.competitionId)) {
      errors.push(`${prefix}.competitionId must be unique`);
    }
    seenCompetitionIds.add(entry.competitionId);
    if (entry.seasonCycle !== 'cross-year' && entry.seasonCycle !== 'calendar-year') {
      errors.push(`${prefix}.seasonCycle is unsupported`);
    }
    if (!['supported', 'partial', 'unsupported'].includes(entry.coverageStatus)) {
      errors.push(`${prefix}.coverageStatus is unsupported`);
    }
    validateBindingConsistency(entry, 'fixture', errors, prefix);
    validateBindingConsistency(entry, 'result', errors, prefix);
    validateBindingConsistency(entry, 'detail', errors, prefix);
    const fixture = entry.sourceBindings.fixture;
    if ((fixture?.externalCompetitionId ?? null) !== entry.externalCompetitionId) {
      errors.push(`${prefix}.externalCompetitionId must match fixture binding`);
    }
    if ((fixture?.endpointKind ?? 'none') !== entry.endpointKind) {
      errors.push(`${prefix}.endpointKind must match fixture binding`);
    }
    for (const [fallbackKind, bindings] of [
      ['fixtureFallbacks', entry.sourceBindings.fixtureFallbacks],
      ['resultFallbacks', entry.sourceBindings.resultFallbacks]
    ] as const) {
      for (const [fallbackIndex, binding] of (bindings ?? []).entries()) {
        validateBinding(binding, errors, `${prefix}.sourceBindings.${fallbackKind}[${fallbackIndex}]`);
      }
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

function fm(
  id: number,
  ccode: string,
  status: Exclude<CoverageStatus, 'unsupported'>,
  espn?: string,
  currentProviderSeason?: string,
  currentAvailable = true
): FotMobMapping {
  return Object.freeze({
    id,
    ccode,
    status,
    ...(espn === undefined ? {} : { espn }),
    ...(currentProviderSeason === undefined ? {} : { currentProviderSeason }),
    currentAvailable
  });
}

function fotMobBinding(
  mapping: FotMobMapping,
  seasonCycle: SeasonCycle,
  capability: 'fixture' | 'result' | 'detail'
): CompetitionSourceBinding {
  const providerSeasons = providerSeasonMap(
    seasonCycle,
    mapping.currentProviderSeason,
    mapping.currentAvailable !== false
  );
  const availableCanonicalSeasons = Object.keys(providerSeasons);
  const endpoint = capability === 'fixture'
    ? {
      endpointKind: 'season-api' as const,
      urlTemplate: 'https://www.fotmob.com/api/data/leagues?id={externalCompetitionId}&ccode3={externalCountryCode}&season={providerSeason}'
    }
    : capability === 'result'
      ? {
        endpointKind: 'daily-api' as const,
        urlTemplate: 'https://www.fotmob.com/api/data/matches?date={YYYYMMDD}&timezone={ianaTimezone}&ccode3={externalCountryCode}'
      }
      : {
        endpointKind: 'match-api' as const,
        urlTemplate: 'https://www.fotmob.com/api/data/matchDetails?matchId={externalMatchId}'
      };
  return Object.freeze({
    sourceId: 'fotmob-unofficial',
    externalCompetitionId: String(mapping.id),
    externalNumericId: mapping.id,
    externalCountryCode: mapping.ccode,
    ...endpoint,
    verificationUrl: 'https://www.fotmob.com/api/data/allLeagues',
    mappingValidatedAt: SOURCE_REGISTRY_VALIDATED_AT,
    availableCanonicalSeasons: Object.freeze(availableCanonicalSeasons),
    providerSeasonByCanonicalSeason: Object.freeze(providerSeasons),
    executionStatus: 'enabled',
    requiresCredential: false
  });
}

function providerSeasonMap(
  seasonCycle: SeasonCycle,
  currentProviderSeason: string | undefined,
  currentAvailable: boolean
): Record<string, string> {
  if (!currentAvailable) {
    return currentProviderSeason === '2025' || seasonCycle === 'calendar-year'
      ? { '2025': currentProviderSeason ?? '2025' }
      : { '2025-26': '2025/2026' };
  }
  return seasonCycle === 'calendar-year'
    ? { '2026': currentProviderSeason ?? '2026' }
    : { '2026-27': currentProviderSeason ?? '2026/2027' };
}

function espnBinding(slug: string): CompetitionSourceBinding {
  return Object.freeze({
    sourceId: 'espn-unofficial',
    externalCompetitionId: slug,
    endpointKind: 'season-api',
    urlTemplate: `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates={seasonStartYear}`,
    verificationUrl: 'https://sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000',
    mappingValidatedAt: SOURCE_REGISTRY_VALIDATED_AT,
    availableCanonicalSeasons: Object.freeze([]),
    executionStatus: 'disabled',
    requiresCredential: false
  });
}

function openFootball(
  file: string,
  seasons: readonly string[],
  total?: number,
  exactKickoff?: number
): OpenFootballMapping {
  return Object.freeze({
    file,
    seasons: Object.freeze([...seasons]),
    ...(total === undefined || exactKickoff === undefined
      ? {}
      : { currentRecordCoverage: Object.freeze({ total, exactKickoff }) })
  });
}

function footballData(
  code: string,
  numericId: number,
  seasons: readonly string[]
): FootballDataMapping {
  return Object.freeze({ code, numericId, seasons: Object.freeze([...seasons]) });
}

function openFootballBinding(mapping: OpenFootballMapping): CompetitionSourceBinding {
  return Object.freeze({
    sourceId: 'openfootball',
    externalCompetitionId: mapping.file,
    endpointKind: 'season-file',
    urlTemplate: `https://raw.githubusercontent.com/openfootball/football.json/master/{season}/${mapping.file}`,
    verificationUrl: `https://raw.githubusercontent.com/openfootball/football.json/${OPENFOOTBALL_VERIFIED_TREE_SHA}/{season}/${mapping.file}`,
    mappingValidatedAt: '2026-08-28',
    availableCanonicalSeasons: mapping.seasons,
    executionStatus: 'enabled',
    requiresCredential: false,
    ...(mapping.currentRecordCoverage
      ? { currentRecordCoverage: mapping.currentRecordCoverage }
      : {})
  });
}

function footballDataBinding(mapping: FootballDataMapping): CompetitionSourceBinding {
  return Object.freeze({
    sourceId: 'football-data-org',
    externalCompetitionId: mapping.code,
    externalNumericId: mapping.numericId,
    endpointKind: 'season-api',
    urlTemplate: `https://api.football-data.org/v4/competitions/${mapping.code}/matches?season={seasonStartYear}`,
    verificationUrl: 'https://www.football-data.org/coverage',
    mappingValidatedAt: '2026-08-28',
    availableCanonicalSeasons: mapping.seasons,
    executionStatus: 'pending-owner',
    requiresCredential: true
  });
}

function validateBindingConsistency(
  entry: CompetitionSourceEntry,
  kind: 'fixture' | 'result' | 'detail',
  errors: string[],
  prefix: string
): void {
  const selected = entry[`${kind}Source`];
  const binding = entry.sourceBindings[kind];
  if ((binding?.sourceId ?? 'none') !== selected) {
    errors.push(`${prefix}.${kind}Source must match its binding`);
  }
  if (binding) validateBinding(binding, errors, `${prefix}.sourceBindings.${kind}`);
}

function validateBinding(
  binding: CompetitionSourceBinding,
  errors: string[],
  prefix: string
): void {
  if (!binding.externalCompetitionId.trim()) {
    errors.push(`${prefix}.externalCompetitionId must be non-empty`);
  }
  for (const field of ['urlTemplate', 'verificationUrl'] as const) {
    try {
      const url = new URL(binding[field]);
      if (url.protocol !== 'https:') throw new Error('not https');
    } catch {
      errors.push(`${prefix}.${field} must be an HTTPS URL`);
    }
  }
  if (binding.sourceId === 'fotmob-unofficial') {
    if (binding.mappingValidatedAt !== SOURCE_REGISTRY_VALIDATED_AT) {
      errors.push(`${prefix}.mappingValidatedAt is stale`);
    }
    if (!Number.isSafeInteger(binding.externalNumericId) || binding.externalNumericId! < 1) {
      errors.push(`${prefix}.externalNumericId must be a positive integer`);
    }
    if (!/^[A-Z]{3}$/u.test(binding.externalCountryCode ?? '')) {
      errors.push(`${prefix}.externalCountryCode must be a three-letter uppercase code`);
    }
    for (const season of binding.availableCanonicalSeasons) {
      if (!binding.providerSeasonByCanonicalSeason?.[season]) {
        errors.push(`${prefix}.providerSeasonByCanonicalSeason is missing ${season}`);
      }
    }
  }
}
