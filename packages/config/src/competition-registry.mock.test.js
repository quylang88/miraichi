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

  it('rejects hardcoded competition names in config payloads', () => {
    const forbiddenCompetitionName = ['World', 'Cup'].join(' ');

    expect(() => validateConfig({ name: forbiddenCompetitionName })).toThrow(
      /Hardcoded competition names/
    );
  });

  it('rejects unknown configuration keys', () => {
    expect(() => validateConfig({ unsupportedKey: 'value' })).toThrow(
      /Invalid configuration key/
    );
  });
});
