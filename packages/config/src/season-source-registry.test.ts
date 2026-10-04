import { describe, expect, it } from 'vitest';
import {
  COMPETITION_SOURCE_REGISTRY,
  NATIONAL_TEAM_REGISTRY_VALIDATED_AT,
  OPENFOOTBALL_VERIFIED_TREE_SHA,
  SOURCE_REGISTRY_VALIDATED_AT,
  validateCompetitionSourceRegistry
} from './season-source-registry.js';

describe('provider-neutral season source registry', () => {
  it('pins the owner-approved FotMob mapping for club and current national-team competitions', () => {
    expect(SOURCE_REGISTRY_VALIDATED_AT).toBe('2026-08-31');
    expect(OPENFOOTBALL_VERIFIED_TREE_SHA)
      .toBe('4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f');
    expect(NATIONAL_TEAM_REGISTRY_VALIDATED_AT).toBe('2026-09-24');
    expect(COMPETITION_SOURCE_REGISTRY).toHaveLength(64);

    const counts = Object.fromEntries(['supported', 'partial', 'unsupported'].map((status) => [
      status,
      COMPETITION_SOURCE_REGISTRY.filter((entry) => entry.coverageStatus === status).length
    ]));
    expect(counts).toEqual({ supported: 53, partial: 11, unsupported: 0 });

    expect(COMPETITION_SOURCE_REGISTRY.every((entry) => (
      entry.fixtureSource === 'fotmob-unofficial'
      && entry.resultSource === 'fotmob-unofficial'
      && entry.detailSource === 'fotmob-unofficial'
      && entry.sourceBindings.fixture?.externalNumericId !== undefined
      && entry.sourceBindings.fixture.externalCountryCode !== undefined
    ))).toBe(true);
    expect(COMPETITION_SOURCE_REGISTRY.slice(0, 50).map((entry) => (
      entry.sourceBindings.fixture!.externalNumericId
    ))).toEqual([
      47, 87, 55, 54, 53, 42, 73, 10216, 74, 45,
      299, 525, 48, 140, 86, 146, 110, 57, 61, 40,
      64, 71, 69, 38, 46, 135, 67, 59, 196, 536,
      130, 230, 268, 112, 274, 223, 9080, 113, 120, 8984,
      9088, 78, 132, 133, 138, 209, 141, 134, 186, 235
    ]);

    const nationalTeams = COMPETITION_SOURCE_REGISTRY.filter((entry) => (
      entry.competitionType === 'national-team'
    ));
    expect(nationalTeams).toHaveLength(14);
    expect(nationalTeams.map((entry) => entry.competitionId)).toEqual([
      'uefa-nations-league-a',
      'uefa-nations-league-b',
      'uefa-nations-league-c',
      'uefa-nations-league-d',
      'concacaf-nations-league',
      'fifa-asean-cup',
      'fifa-u20-womens-world-cup',
      'asian-games-football',
      'caf-afcon-qualification',
      'uefa-u21-qualification',
      'fifa-u17-world-cup',
      'fifa-womens-world-cup-qualification-uefa',
      'fifa-womens-world-cup-qualification-concacaf',
      'afc-asian-cup'
    ]);
    expect(nationalTeams.every((entry) => entry.group === 'national_team')).toBe(true);
    expect(nationalTeams.every((entry) => (
      entry.sourceBindings.fixture?.mappingValidatedAt === NATIONAL_TEAM_REGISTRY_VALIDATED_AT
    ))).toBe(true);
  });

  it('separates season, daily-result, and lazy-detail capabilities', () => {
    expect(COMPETITION_SOURCE_REGISTRY.every((entry) => (
      entry.sourceBindings.fixture?.endpointKind === 'season-api'
      && entry.sourceBindings.result?.endpointKind === 'daily-api'
      && entry.sourceBindings.result.executionStatus === 'enabled'
      && entry.sourceBindings.result.externalNumericId === entry.sourceBindings.fixture.externalNumericId
      && entry.sourceBindings.detail?.endpointKind === 'match-api'
      && entry.sourceBindings.result.urlTemplate.includes('/api/data/matches?')
      && entry.sourceBindings.result.urlTemplate.includes('ccode3={ownerCountryCode}')
      && !entry.sourceBindings.result.urlTemplate.includes('ccode3={externalCountryCode}')
      && entry.sourceBindings.detail.urlTemplate.includes('/api/data/matchDetails?')
    ))).toBe(true);
  });

  it('keeps ESPN unofficial mappings disabled and never treats missing mappings as enabled', () => {
    const espnBindings = COMPETITION_SOURCE_REGISTRY.flatMap((entry) => (
      entry.sourceBindings.fixtureFallbacks?.filter((binding) => (
        binding.sourceId === 'espn-unofficial'
      )) ?? []
    ));
    expect(espnBindings).toHaveLength(45);
    expect(espnBindings.every((binding) => binding.executionStatus === 'disabled')).toBe(true);
  });

  it('binds every selected source to an external ID, exact URL template, and verification date', () => {
    for (const entry of COMPETITION_SOURCE_REGISTRY) {
      const fixture = entry.sourceBindings.fixture;
      if (!fixture) {
        expect(entry.fixtureSource).toBe('none');
        expect(entry.externalCompetitionId).toBeNull();
        expect(entry.endpointKind).toBe('none');
        continue;
      }
      expect(entry.fixtureSource).toBe(fixture.sourceId);
      expect(entry.externalCompetitionId).toBe(fixture.externalCompetitionId);
      expect(entry.endpointKind).toBe(fixture.endpointKind);
      expect([SOURCE_REGISTRY_VALIDATED_AT, NATIONAL_TEAM_REGISTRY_VALIDATED_AT])
        .toContain(fixture.mappingValidatedAt);
      expect(new URL(fixture.urlTemplate).protocol).toBe('https:');
    }
    expect(validateCompetitionSourceRegistry(COMPETITION_SOURCE_REGISTRY)).toEqual({ ok: true });
  });

  it('stores exact current national-team editions instead of relabelling future seasons', () => {
    const byId = new Map(COMPETITION_SOURCE_REGISTRY.map((entry) => [entry.competitionId, entry]));
    expect(byId.get('afc-asian-cup')?.currentEdition).toEqual({
      canonicalSeason: '2027',
      startDate: '2027-01-07',
      endDate: '2027-02-05'
    });
    expect(byId.get('uefa-u21-qualification')?.currentEdition).toEqual({
      canonicalSeason: '2025-26',
      startDate: '2025-06-05',
      endDate: '2026-10-06'
    });
    expect(byId.get('afc-asian-cup')?.sourceBindings.fixture?.providerSeasonByCanonicalSeason)
      .toEqual({ '2027': '2027' });
  });

  it('stores provider-season exceptions in bindings instead of core competition branches', () => {
    const byId = new Map(COMPETITION_SOURCE_REGISTRY.map((entry) => [entry.competitionId, entry]));
    expect(byId.get('uefa-super-cup')?.sourceBindings.fixture?.providerSeasonByCanonicalSeason)
      .toMatchObject({ '2026-27': '2025/2026' });
    expect(byId.get('mex-liga-mx')?.sourceBindings.fixture?.providerSeasonByCanonicalSeason)
      .toMatchObject({ '2026-27': '2026/2027 - Apertura' });
    expect(byId.get('col-primera-a')?.sourceBindings.fixture?.providerSeasonByCanonicalSeason)
      .toMatchObject({ '2026': '2026 - Clausura' });
    expect(byId.get('jpn-j1-league')?.seasonCycle).toBe('cross-year');
    for (const competitionId of [
      'fifa-club-world-cup',
      'eng-fa-cup',
      'esp-copa-del-rey',
      'fra-coupe-de-france',
      'ned-knvb-beker'
    ]) {
      const entry = byId.get(competitionId)!;
      const current = entry.seasonCycle === 'calendar-year' ? '2026' : '2026-27';
      expect(entry.sourceBindings.fixture?.availableCanonicalSeasons).not.toContain(current);
    }
  });
});
