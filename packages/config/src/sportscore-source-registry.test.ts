import { describe, expect, it } from 'vitest';
import {
  SPORTSCORE_COMPETITION_GROUPS,
  SPORTSCORE_COMPETITION_REGISTRY,
  SPORTSCORE_REGISTRY_VALIDATED_AT,
  SPORTSCORE_SOURCE_ORIGIN,
  type SportScoreCompetitionEntry,
  validateSportScoreCompetitionRegistry
} from './sportscore-source-registry.js';

const EXPECTED_CANONICAL_IDS = [
  'eng-premier-league',
  'esp-la-liga',
  'ita-serie-a',
  'ger-bundesliga',
  'fra-ligue-1',
  'uefa-champions-league',
  'uefa-europa-league',
  'uefa-conference-league',
  'uefa-super-cup',
  'conmebol-copa-libertadores',
  'conmebol-copa-sudamericana',
  'afc-champions-league-elite',
  'eng-championship',
  'esp-segunda-division',
  'ita-serie-b',
  'ger-2-bundesliga',
  'fra-ligue-2',
  'ned-eredivisie',
  'por-primeira-liga',
  'bel-pro-league',
  'sco-premiership',
  'tur-super-lig',
  'sui-super-league',
  'aut-bundesliga',
  'den-superliga',
  'gre-super-league-1',
  'swe-allsvenskan',
  'nor-eliteserien',
  'pol-ekstraklasa',
  'sau-pro-league',
  'usa-mls',
  'mex-liga-mx',
  'bra-serie-a',
  'arg-primera-division',
  'col-primera-a',
  'jpn-j1-league',
  'kor-k-league-1',
  'aus-a-league',
  'chn-csl',
  'tha-league-1',
  'vie-v-league-1',
  'fifa-club-world-cup',
  'eng-fa-cup',
  'eng-efl-cup',
  'esp-copa-del-rey',
  'ger-dfb-pokal',
  'ita-coppa-italia',
  'fra-coupe-de-france',
  'por-taca-de-portugal',
  'ned-knvb-beker'
] as const;

describe('SportScore source registry', () => {
  it('contains exactly 50 enabled, equal competitions in the four accepted groups', () => {
    expect(SPORTSCORE_COMPETITION_GROUPS).toEqual([
      'top_and_continental',
      'europe_secondary_and_major',
      'americas_middle_east_asia_world',
      'major_domestic_cups'
    ]);
    expect(SPORTSCORE_COMPETITION_REGISTRY).toHaveLength(50);
    expect(SPORTSCORE_COMPETITION_REGISTRY.every((entry) => entry.enabled)).toBe(true);

    const groupCounts = Object.fromEntries(SPORTSCORE_COMPETITION_GROUPS.map((group) => [
      group,
      SPORTSCORE_COMPETITION_REGISTRY.filter((entry) => entry.group === group).length
    ]));
    expect(groupCounts).toEqual({
      top_and_continental: 12,
      europe_secondary_and_major: 17,
      americas_middle_east_asia_world: 13,
      major_domestic_cups: 8
    });

    for (const entry of SPORTSCORE_COMPETITION_REGISTRY) {
      expect(entry).not.toHaveProperty('priority');
      expect(entry).not.toHaveProperty('rank');
      expect(entry).not.toHaveProperty('isNationalTeamPriority');
    }
  });

  it('preserves all approved canonical competition IDs exactly once', () => {
    expect(SPORTSCORE_COMPETITION_REGISTRY.map((entry) => entry.competitionId).sort())
      .toEqual([...EXPECTED_CANONICAL_IDS].sort());
    expect(new Set(SPORTSCORE_COMPETITION_REGISTRY.map((entry) => entry.competitionId)).size).toBe(50);
    expect(new Set(SPORTSCORE_COMPETITION_REGISTRY.map((entry) => entry.providerCompetitionSlug)).size).toBe(50);
    expect(new Set(SPORTSCORE_COMPETITION_REGISTRY.map((entry) => entry.providerCompetitionId)).size).toBe(50);
  });

  it('binds every mapping to one validated HTTPS SportScore competition URL', () => {
    expect(SPORTSCORE_REGISTRY_VALIDATED_AT).toBe('2026-08-26');

    for (const entry of SPORTSCORE_COMPETITION_REGISTRY) {
      const sourceUrl = new URL(entry.competitionUrl);
      expect(sourceUrl.origin).toBe(SPORTSCORE_SOURCE_ORIGIN);
      expect(sourceUrl.protocol).toBe('https:');
      expect(sourceUrl.pathname).toBe(
        `/football/competition/${entry.providerCountrySlug}/${entry.providerCompetitionSlug}/${entry.providerCompetitionId}/`
      );
      expect(entry.sourceId).toBe('sportscore');
      expect(entry.mappingValidatedAt).toBe(SPORTSCORE_REGISTRY_VALIDATED_AT);
      expect(entry.seasonPolicy).toBe('current');
      expect(['club', 'national-team']).toContain(entry.competitionType);
    }

    expect(validateSportScoreCompetitionRegistry(SPORTSCORE_COMPETITION_REGISTRY)).toEqual({ ok: true });
  });

  it('accepts a 51st national-team competition as registry data without core-code changes', () => {
    const additionalEntry: SportScoreCompetitionEntry = {
      entryId: 'sportscore-uefa-nations-league',
      sourceId: 'sportscore',
      competitionId: 'uefa-nations-league',
      competitionName: 'UEFA Nations League',
      country: 'World',
      group: 'americas_middle_east_asia_world',
      competitionType: 'national-team',
      providerCountrySlug: 'world',
      providerCompetitionSlug: 'uefa-nations-league',
      providerCompetitionId: 'd23xmvkh43oqg8n',
      competitionUrl: 'https://sportscore.com/football/competition/world/uefa-nations-league/d23xmvkh43oqg8n/',
      seasonPolicy: 'current',
      sourceTimezone: 'UTC',
      mappingValidatedAt: SPORTSCORE_REGISTRY_VALIDATED_AT,
      enabled: true
    };

    const expanded = [...SPORTSCORE_COMPETITION_REGISTRY, additionalEntry];
    expect(validateSportScoreCompetitionRegistry(expanded)).toEqual({ ok: true });
    expect(expanded.map((entry) => entry.competitionId)).toEqual([
      ...SPORTSCORE_COMPETITION_REGISTRY.map((entry) => entry.competitionId),
      'uefa-nations-league'
    ]);
  });

  it('rejects duplicate identities, invalid hosts, and unsupported competition types', () => {
    const first = SPORTSCORE_COMPETITION_REGISTRY[0]!;
    const invalid = [
      first,
      {
        ...first,
        entryId: 'sportscore-duplicate-provider-slug',
        competitionId: 'duplicate-canonical-id',
        providerCompetitionId: 'duplicate-provider-id',
        competitionUrl: 'http://example.com/football/competition/england/english-premier-league/duplicate-provider-id/',
        competitionType: 'international' as SportScoreCompetitionEntry['competitionType']
      }
    ];

    const result = validateSportScoreCompetitionRegistry(invalid);
    expect(result.ok).toBe(false);
    expect(result.ok ? [] : result.errors).toEqual(expect.arrayContaining([
      expect.stringContaining('providerCompetitionSlug'),
      expect.stringContaining('competitionUrl'),
      expect.stringContaining('competitionType')
    ]));
  });
});
