import { describe, expect, it } from 'vitest';
import {
  buildOpenFootballRawUrl,
  OPENFOOTBALL_SOURCE_REGISTRY,
  validateOpenFootballSourceRegistry
} from './openfootball-source-registry.js';

describe('OpenFootball source registry', () => {
  it('locks the two approved competition files and constructs their raw URL', () => {
    expect(OPENFOOTBALL_SOURCE_REGISTRY.map((entry) => entry.entryId)).toEqual([
      'openfootball-england-premier-league-2026-27',
      'openfootball-world-cup-2026-group-stage'
    ]);
    expect(buildOpenFootballRawUrl(OPENFOOTBALL_SOURCE_REGISTRY[0]!)).toBe(
      'https://raw.githubusercontent.com/openfootball/england/master/2026-27/1-premierleague.txt'
    );
  });

  it.each([
    ['duplicate entry IDs', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [entry, { ...entry }], 'duplicate entryId'],
    ['duplicate repository/ref/file-path triples', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [entry, { ...entry, entryId: 'another-entry' }], 'duplicate repository/ref/filePath'],
    ['empty expected headers', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, expectedCompetitionHeader: '' }], 'expectedCompetitionHeader'],
    ['unknown repositories', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, repository: 'unknown' }], 'repository'],
    ['non-master refs', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, ref: 'main' }], 'master'],
    ['backslash paths', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, filePath: '2026-27\\1-premierleague.txt' }], 'backslashes'],
    ['leading-slash paths', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, filePath: '/2026-27/1-premierleague.txt' }], 'leading slash'],
    ['path traversal', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, filePath: '../README.md' }], 'path traversal'],
    ['query/hash paths', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, filePath: '2026-27/1-premierleague.txt?raw=1' }], 'query or hash'],
    ['non-text paths', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, filePath: '2026-27/1-premierleague.csv' }], '.txt'],
    ['invalid IANA timezones', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, sourceTimezone: 'Mars/Olympus' }], 'IANA'],
    ['short refreshes', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, refreshIntervalMinutes: 359 }], '360'],
    ['payload limits below one byte', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, maxPayloadBytes: 0 }], 'maxPayloadBytes'],
    ['payload limits above one mebibyte', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, maxPayloadBytes: 1_048_577 }], 'maxPayloadBytes'],
    ['minimum match counts below one', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, minimumExpectedMatches: 0 }], 'minimumExpectedMatches'],
    ['missing ratios outside the reviewed bound', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, maximumMissingRatio: 0.051 }], 'maximumMissingRatio'],
    ['negative missing ratios', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, maximumMissingRatio: -0.01 }], 'maximumMissingRatio'],
    ['non-HTTPS origins', (entry: typeof OPENFOOTBALL_SOURCE_REGISTRY[number]) => [{ ...entry, origin: 'http://raw.githubusercontent.com' }], 'HTTPS']
  ])('rejects %s', (_label, createEntries, message) => {
    expect(validateOpenFootballSourceRegistry(createEntries(OPENFOOTBALL_SOURCE_REGISTRY[0]!))).toEqual(
      expect.arrayContaining([expect.stringContaining(message)])
    );
  });

  it('rejects a registry containing no enabled entries', () => {
    expect(validateOpenFootballSourceRegistry(
      OPENFOOTBALL_SOURCE_REGISTRY.map((entry) => ({ ...entry, enabled: false }))
    )).toEqual(expect.arrayContaining([expect.stringContaining('enabled')]));
  });
});
