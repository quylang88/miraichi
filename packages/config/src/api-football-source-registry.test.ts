import { describe, expect, it } from 'vitest';
import {
  API_FOOTBALL_COMPETITION_REGISTRY,
  API_FOOTBALL_QUOTA_CONFIG,
  findCompetitionByEntryId,
  findCompetitionByLeagueId,
  getEnabledCompetitions,
  getHydrationSeasonsForCompetition,
  validateApiFootballSourceRegistry
} from './api-football-source-registry.js';

describe('api-football-source-registry', () => {
  it('contains exactly 50 prominent club & cup competitions', () => {
    expect(API_FOOTBALL_COMPETITION_REGISTRY).toHaveLength(50);
  });

  it('passes complete registry schema and integrity validation', () => {
    const errors = validateApiFootballSourceRegistry(API_FOOTBALL_COMPETITION_REGISTRY);
    expect(errors).toEqual([]);
  });

  it('configures quota guard with <= 85 daily requests hard ceiling and 15 reserve', () => {
    expect(API_FOOTBALL_QUOTA_CONFIG.dailyLimit).toBe(100);
    expect(API_FOOTBALL_QUOTA_CONFIG.hardCeiling).toBe(85);
    expect(API_FOOTBALL_QUOTA_CONFIG.reserveBudget).toBe(15);
    expect(API_FOOTBALL_QUOTA_CONFIG.concludingWindowStartMinutes).toBe(88);
    expect(API_FOOTBALL_QUOTA_CONFIG.concludingWindowEndMinutes).toBe(115);
    expect(API_FOOTBALL_QUOTA_CONFIG.pollingIntervalSeconds).toBe(150);
  });

  it('finds competitions by providerLeagueId and entryId', () => {
    const epl = findCompetitionByLeagueId(39);
    expect(epl).toBeDefined();
    expect(epl?.competitionName).toBe('Premier League');
    expect(epl?.country).toBe('England');

    const ucl = findCompetitionByEntryId('api-football-uefa-champions-league');
    expect(ucl).toBeDefined();
    expect(ucl?.providerLeagueId).toBe(2);
  });

  it('extracts unique hydration seasons ordered newest-first [current, previous, older]', () => {
    const epl = findCompetitionByLeagueId(39)!;
    const seasons = getHydrationSeasonsForCompetition(epl);
    expect(seasons).toEqual([2026, 2025, 2024]);
  });

  it('filters enabled competitions properly', () => {
    const enabled = getEnabledCompetitions();
    expect(enabled.length).toBeGreaterThan(0);
    expect(enabled.every((c) => c.enabled)).toBe(true);
  });

  it('accepts national-team competition type', () => {
    const validNationalTeamEntry = [
      {
        ...API_FOOTBALL_COMPETITION_REGISTRY[0]!,
        competitionType: 'national-team' as const
      }
    ];
    expect(validateApiFootballSourceRegistry(validNationalTeamEntry)).toEqual([]);
  });

  it('rejects unknown competition types', () => {
    const invalidEntry = [
      {
        ...API_FOOTBALL_COMPETITION_REGISTRY[0]!,
        competitionType: 'invalid-type'
      }
    ];
    const errors = validateApiFootballSourceRegistry(invalidEntry);
    expect(errors).toContain('entries[0].competitionType must be "club" or "national-team"');
  });

  it('rejects invalid or duplicate registry entries', () => {
    expect(validateApiFootballSourceRegistry([])).toEqual(['Registry entries must be a non-empty array']);

    const duplicateLeague = [
      { ...API_FOOTBALL_COMPETITION_REGISTRY[0]! },
      { ...API_FOOTBALL_COMPETITION_REGISTRY[0]!, entryId: 'duplicate-entry' }
    ];
    expect(validateApiFootballSourceRegistry(duplicateLeague)).toContain('entries[1] has duplicate providerLeagueId: 39');

    const duplicateCompetition = [
      { ...API_FOOTBALL_COMPETITION_REGISTRY[0]! },
      {
        ...API_FOOTBALL_COMPETITION_REGISTRY[1]!,
        competitionId: API_FOOTBALL_COMPETITION_REGISTRY[0]!.competitionId
      }
    ];
    expect(validateApiFootballSourceRegistry(duplicateCompetition)).toContain(
      `entries[1] has duplicate competitionId: ${API_FOOTBALL_COMPETITION_REGISTRY[0]!.competitionId}`
    );

    const invalidCategory = [
      { ...API_FOOTBALL_COMPETITION_REGISTRY[0]!, category: 'unknown-category' }
    ];
    expect(validateApiFootballSourceRegistry(invalidCategory)).toContain(
      'entries[0].category must be a supported competition category'
    );

    const futureHistoricalSeason = [
      {
        ...API_FOOTBALL_COMPETITION_REGISTRY[0]!,
        currentSeason: 2026,
        historicalSeasons: [2025, 2027]
      }
    ];
    expect(validateApiFootballSourceRegistry(futureHistoricalSeason)).toContain(
      'entries[0].historicalSeasons cannot contain a season newer than currentSeason'
    );
  });
});
