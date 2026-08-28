import { describe, expect, it } from 'vitest';
import {
  COMPETITION_SOURCE_REGISTRY,
  OPENFOOTBALL_VERIFIED_TREE_SHA,
  SOURCE_REGISTRY_VALIDATED_AT,
  validateCompetitionSourceRegistry
} from './season-source-registry.js';

describe('provider-neutral season source registry', () => {
  it('reports the verified free coverage without promoting historical-only mappings', () => {
    expect(SOURCE_REGISTRY_VALIDATED_AT).toBe('2026-08-28');
    expect(OPENFOOTBALL_VERIFIED_TREE_SHA)
      .toBe('4e4146c901b62bcafa1b6deabb7e4a3fccdc9b1f');
    expect(COMPETITION_SOURCE_REGISTRY).toHaveLength(50);

    const counts = Object.fromEntries(['supported', 'partial', 'unsupported'].map((status) => [
      status,
      COMPETITION_SOURCE_REGISTRY.filter((entry) => entry.coverageStatus === status).length
    ]));
    expect(counts).toEqual({ supported: 1, partial: 24, unsupported: 25 });

    const executableCurrent = COMPETITION_SOURCE_REGISTRY.filter((entry) => (
      entry.sourceBindings.fixture?.executionStatus === 'enabled'
      && entry.sourceBindings.fixture.availableCanonicalSeasons.includes(
        entry.seasonCycle === 'calendar-year' ? '2026' : '2026-27'
      )
    ));
    expect(executableCurrent).toHaveLength(9);
    expect(executableCurrent.map((entry) => entry.competitionId)).toEqual([
      'eng-premier-league',
      'esp-la-liga',
      'ita-serie-a',
      'ger-bundesliga',
      'fra-ligue-1',
      'eng-championship',
      'ned-eredivisie',
      'por-primeira-liga',
      'bra-serie-a'
    ]);
  });

  it('keeps free authenticated daily results separate and exposes no invented detail source', () => {
    const footballDataResults = COMPETITION_SOURCE_REGISTRY.filter((entry) => (
      entry.resultSource === 'football-data-org'
    ));
    expect(footballDataResults).toHaveLength(10);
    expect(footballDataResults.every((entry) => (
      entry.sourceBindings.result?.requiresCredential === true
      && entry.sourceBindings.result.executionStatus === 'pending-owner'
      && entry.sourceBindings.result.endpointKind === 'season-api'
    ))).toBe(true);
    expect(COMPETITION_SOURCE_REGISTRY.every((entry) => (
      entry.detailSource === 'none' && entry.sourceBindings.detail === undefined
    ))).toBe(true);
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
      expect(fixture.mappingValidatedAt).toBe(SOURCE_REGISTRY_VALIDATED_AT);
      expect(new URL(fixture.urlTemplate).protocol).toBe('https:');
    }
    expect(validateCompetitionSourceRegistry(COMPETITION_SOURCE_REGISTRY)).toEqual({ ok: true });
  });

  it('marks only the full-kickoff current OpenFootball feed as supported', () => {
    const supported = COMPETITION_SOURCE_REGISTRY.find((entry) => (
      entry.coverageStatus === 'supported'
    ));
    expect(supported?.competitionId).toBe('eng-premier-league');
    expect(supported?.sourceBindings.fixture?.currentRecordCoverage).toEqual({
      total: 380,
      exactKickoff: 380
    });

    const laLiga = COMPETITION_SOURCE_REGISTRY.find((entry) => (
      entry.competitionId === 'esp-la-liga'
    ));
    expect(laLiga?.coverageStatus).toBe('partial');
    expect(laLiga?.sourceBindings.fixture?.currentRecordCoverage).toEqual({
      total: 380,
      exactKickoff: 41
    });
  });
});
