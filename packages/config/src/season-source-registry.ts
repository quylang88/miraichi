import {
  SPORTSCORE_COMPETITION_REGISTRY,
  type SportScoreCompetitionGroup,
  type SportScoreCompetitionType
} from './sportscore-source-registry.js';

export const SOURCE_REGISTRY_VALIDATED_AT = '2026-08-28' as const;
export const OPENFOOTBALL_VERIFIED_TREE_SHA =
  '4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f' as const;

export type SeasonCycle = 'cross-year' | 'calendar-year';
export type SeasonSourceId = 'openfootball' | 'football-data-org' | 'sportscore-widget';
export type EndpointKind = 'season-file' | 'season-api' | 'paginated-season' | 'none';
export type CoverageStatus = 'supported' | 'partial' | 'unsupported';
export type SourceExecutionStatus = 'enabled' | 'pending-owner' | 'not-implemented';

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
  mappingValidatedAt: typeof SOURCE_REGISTRY_VALIDATED_AT;
  availableCanonicalSeasons: readonly string[];
  executionStatus: SourceExecutionStatus;
  requiresCredential: boolean;
  externalNumericId?: number;
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
  };
}

export type CompetitionSourceRegistryValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

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
  'jpn-j1-league',
  'kor-k-league-1',
  'chn-csl',
  'fifa-club-world-cup'
]);

export const COMPETITION_SOURCE_REGISTRY: readonly CompetitionSourceEntry[] = Object.freeze(
  SPORTSCORE_COMPETITION_REGISTRY.map((identity) => {
    const openFootballMapping = OPENFOOTBALL_MAPPINGS[identity.competitionId];
    const footballDataMapping = FOOTBALL_DATA_MAPPINGS[identity.competitionId];
    const fixture = openFootballMapping
      ? openFootballBinding(openFootballMapping)
      : footballDataMapping
        ? footballDataBinding(footballDataMapping)
        : undefined;
    const result = footballDataMapping
      ? footballDataBinding(footballDataMapping)
      : undefined;
    const coverageStatus = deriveCoverageStatus(openFootballMapping, fixture);

    return Object.freeze({
      entryId: `source-${identity.competitionId}`,
      competitionId: identity.competitionId,
      competitionName: identity.competitionName,
      country: identity.country,
      group: identity.group,
      competitionType: identity.competitionType,
      sourceTimezone: identity.sourceTimezone,
      seasonCycle: CALENDAR_YEAR_COMPETITION_IDS.has(identity.competitionId)
        ? 'calendar-year'
        : 'cross-year',
      coverageStatus,
      fixtureSource: fixture?.sourceId ?? 'none',
      resultSource: result?.sourceId ?? 'none',
      detailSource: 'none',
      externalCompetitionId: fixture?.externalCompetitionId ?? null,
      endpointKind: fixture?.endpointKind ?? 'none',
      sourceBindings: Object.freeze({
        ...(fixture ? { fixture } : {}),
        ...(result ? { result } : {})
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
    if (entry.coverageStatus === 'supported') {
      const coverage = fixture?.currentRecordCoverage;
      if (!coverage || coverage.total !== coverage.exactKickoff) {
        errors.push(`${prefix}.supported coverage requires complete current kickoff data`);
      }
    }
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
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
    mappingValidatedAt: SOURCE_REGISTRY_VALIDATED_AT,
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
    mappingValidatedAt: SOURCE_REGISTRY_VALIDATED_AT,
    availableCanonicalSeasons: mapping.seasons,
    executionStatus: 'pending-owner',
    requiresCredential: true
  });
}

function deriveCoverageStatus(
  openFootballMapping: OpenFootballMapping | undefined,
  fixture: CompetitionSourceBinding | undefined
): CoverageStatus {
  if (!fixture) return 'unsupported';
  const coverage = openFootballMapping?.currentRecordCoverage;
  return coverage && coverage.total === coverage.exactKickoff
    ? 'supported'
    : 'partial';
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
  if (!binding) return;
  if (!binding.externalCompetitionId.trim()) {
    errors.push(`${prefix}.sourceBindings.${kind}.externalCompetitionId must be non-empty`);
  }
  if (binding.mappingValidatedAt !== SOURCE_REGISTRY_VALIDATED_AT) {
    errors.push(`${prefix}.sourceBindings.${kind}.mappingValidatedAt is stale`);
  }
  for (const field of ['urlTemplate', 'verificationUrl'] as const) {
    try {
      const url = new URL(binding[field]);
      if (url.protocol !== 'https:') throw new Error('not https');
    } catch {
      errors.push(`${prefix}.sourceBindings.${kind}.${field} must be an HTTPS URL`);
    }
  }
}
