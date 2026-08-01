import { describe, expect, it } from 'vitest';
import {
  OPENFOOTBALL_TEAM_ALIASES,
  resolveOpenFootballTeamAlias
} from './openfootball-team-aliases.js';

describe('OpenFootball team aliases', () => {
  it('resolves the explicitly tracked Arsenal alias after safe whitespace normalization', () => {
    expect(resolveOpenFootballTeamAlias(
      'openfootball-england-premier-league-2026-27',
      '  Arsenal   FC  '
    )).toEqual({ teamId: 'team-arsenal', canonicalName: 'Arsenal' });
  });

  it('withholds unknown aliases instead of generating a team id', () => {
    expect(resolveOpenFootballTeamAlias(
      'openfootball-england-premier-league-2026-27',
      'Invented United FC'
    )).toBeUndefined();
  });

  it('tracks the reviewed club and national-team aliases without duplicate source keys', () => {
    const clubAliases = OPENFOOTBALL_TEAM_ALIASES.filter((alias) =>
      alias.sourceEntryId === 'openfootball-england-premier-league-2026-27'
    );
    const nationalAliases = OPENFOOTBALL_TEAM_ALIASES.filter((alias) =>
      alias.sourceEntryId === 'openfootball-world-cup-2026-group-stage'
    );
    const sourceKeys = OPENFOOTBALL_TEAM_ALIASES.map((alias) =>
      `${alias.sourceEntryId}|${alias.sourceName}`
    );

    expect(clubAliases).toHaveLength(20);
    expect(nationalAliases).toHaveLength(48);
    expect(new Set(sourceKeys).size).toBe(sourceKeys.length);
  });
});
