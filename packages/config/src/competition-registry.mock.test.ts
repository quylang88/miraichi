import { describe, expect, it } from 'vitest';
import { COMPETITION_REGISTRY, validateConfig } from './competition-registry.mock.js';

describe('competition registry config validation', () => {
  it('keeps registry entries competition-agnostic and football-scoped', () => {
    expect(COMPETITION_REGISTRY.comp_international_cup_2026).toMatchObject({
      id: 'comp_international_cup_2026',
      sport: 'football',
      status: 'active'
    });
  });

  it('allows the initial World Cup target as registry metadata', () => {
    const initialCompetitionName = ['World', 'Cup'].join(' ');

    expect(validateConfig({
      competitionId: 'comp_int_world_cup',
      name: initialCompetitionName,
      sport: 'football',
      status: 'active'
    })).toBe(true);
  });

  it('rejects unknown configuration keys', () => {
    expect(() => validateConfig({ unsupportedKey: 'value' })).toThrow(
      /Invalid configuration key/
    );
  });
});
