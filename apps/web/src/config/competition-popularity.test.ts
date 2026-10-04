import { describe, expect, it } from 'vitest';
import {
  COMPETITION_POPULARITY_RANKING,
  compareCompetitionsByPopularity,
  getCompetitionPopularityRank
} from './competition-popularity.js';

describe('competition popularity ranking configuration', () => {
  it('contains all club and current national-team competitions with unique sequential ranks', () => {
    expect(COMPETITION_POPULARITY_RANKING).toHaveLength(64);
    const ranks = COMPETITION_POPULARITY_RANKING.map((c) => c.rank);
    const expectedRanks = Array.from({ length: 64 }, (_, i) => i + 1);
    expect(ranks).toEqual(expectedRanks);
    expect(COMPETITION_POPULARITY_RANKING.map((entry) => entry.id)).toEqual(expect.arrayContaining([
      'uefa-nations-league-a',
      'concacaf-nations-league',
      'fifa-asean-cup',
      'fifa-u20-womens-world-cup',
      'asian-games-football',
      'afc-asian-cup'
    ]));
  });

  it('ranks Premier League and Champions League higher than Austrian Bundesliga', () => {
    const uclRank = getCompetitionPopularityRank('UEFA Champions League');
    const eplRank = getCompetitionPopularityRank('Premier League');
    const austrianRank = getCompetitionPopularityRank('Austrian Bundesliga');

    expect(uclRank).toBe(1);
    expect(eplRank).toBe(2);
    expect(austrianRank).toBeGreaterThan(35);
    expect(uclRank).toBeLessThan(austrianRank);
    expect(eplRank).toBeLessThan(austrianRank);
  });

  it('does not bury major national-team competitions below secondary club leagues', () => {
    expect(getCompetitionPopularityRank('UEFA Nations League A'))
      .toBeLessThan(getCompetitionPopularityRank('Championship'));
    expect(getCompetitionPopularityRank('AFC Asian Cup'))
      .toBeLessThan(getCompetitionPopularityRank('Ligue 2'));
    expect(getCompetitionPopularityRank('FIFA ASEAN Cup'))
      .toBeLessThan(getCompetitionPopularityRank('Ligue 2'));
  });

  it('correctly compares competitions by popularity order', () => {
    expect(compareCompetitionsByPopularity('Premier League', 'Austrian Bundesliga')).toBeLessThan(0);
    expect(compareCompetitionsByPopularity('Austrian Bundesliga', 'La Liga')).toBeGreaterThan(0);
    expect(compareCompetitionsByPopularity('UEFA Champions League', 'UEFA Europa League')).toBeLessThan(0);
  });

  it('supports lookup by ID, standard name, and common aliases', () => {
    expect(getCompetitionPopularityRank('eng-premier-league')).toBe(2);
    expect(getCompetitionPopularityRank('EPL')).toBe(2);
    expect(getCompetitionPopularityRank('English Premier League')).toBe(2);
    expect(getCompetitionPopularityRank('uefa-champions-league')).toBe(1);
    expect(getCompetitionPopularityRank('UCL')).toBe(1);
  });

  it('gracefully handles unranked or unknown competitions with fallback rank', () => {
    expect(getCompetitionPopularityRank('Unknown Tournament 51')).toBe(9999);
    expect(compareCompetitionsByPopularity('Premier League', 'Unknown Tournament')).toBeLessThan(0);
    expect(compareCompetitionsByPopularity('Unknown A', 'Unknown B')).toBeLessThan(0);
  });
});
