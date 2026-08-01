import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { LocalMatch } from '@miraichi/shared';
import {
  buildServingMatchStore,
  readServingMatchStoreSnapshot
} from './serving-match-store.js';

const importedAt = '2026-07-05T00:00:00.000Z';

function match(overrides: Partial<LocalMatch> = {}): LocalMatch {
  return {
    id: 'match-1',
    competition: {
      id: 'world-cup-2026',
      name: 'FIFA World Cup',
      type: 'national-team',
      season: '2026'
    },
    kickoffUtc: '2026-06-11T19:00:00.000Z',
    status: 'scheduled',
    homeTeam: { id: 'team-mexico', name: 'Mexico' },
    awayTeam: { id: 'team-south-africa', name: 'South Africa' },
    score: { home: null, away: null },
    sourceRefs: [
      { sourceId: 'manual-snapshot', sourceMatchId: 'manual-1', importedAt }
    ],
    updatedAt: '2026-07-05T00:00:00.000Z',
    ...overrides
  };
}

async function tempServingRoot(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-serving-store-'));
}

describe('serving match store', () => {
  it('writes a manifest, partitions, index, and dedupes updates by match id', async () => {
    const root = await tempServingRoot();
    const older = match({
      updatedAt: '2026-07-04T00:00:00.000Z',
      sourceRefs: [
        { sourceId: 'manual-snapshot', sourceMatchId: 'manual-1', importedAt: '2026-07-04T00:00:00.000Z' }
      ]
    });
    const newer = match({
      status: 'completed',
      score: { home: 2, away: 1 },
      updatedAt: '2026-07-05T01:00:00.000Z',
      sourceRefs: [
        { sourceId: 'manual-snapshot', sourceMatchId: 'manual-99', importedAt: '2026-07-05T01:00:00.000Z' }
      ]
    });
    const second = match({
      id: 'match-2',
      kickoffUtc: '2024-07-14T19:00:00.000Z',
      competition: {
        id: 'euro-2024',
        name: 'UEFA Euro',
        type: 'national-team',
        season: '2024'
      },
      homeTeam: { id: 'team-spain', name: 'Spain' },
      awayTeam: { id: 'team-england', name: 'England' },
      status: 'completed',
      score: { home: 2, away: 1 }
    });

    const result = await buildServingMatchStore({
      servingRoot: root,
      version: '2026-07-05T00-00-00Z',
      snapshotId: 'serving-2026-07-05',
      generatedAt: importedAt,
      importedAt,
      sources: [
        { sourceId: 'manual-snapshot', importedAt }
      ],
      matches: [older, newer, second],
      scope: 'configured-competitions'
    });

    expect(result).toEqual({
      version: '2026-07-05T00-00-00Z',
      matchCount: 2,
      partitionCount: 4
    });

    const manifest = JSON.parse(await fs.readFile(path.join(root, 'manifest.json'), 'utf8'));
    expect(manifest.schemaVersion).toBe('miraichi.serving.match-store.v1');
    expect(manifest.currentVersion).toBe('2026-07-05T00-00-00Z');
    expect(manifest.scopes[0].scope).toBe('configured-competitions');
    expect(manifest.scopes[0].matchCount).toBe(2);
    expect(manifest.scopes[0].partitions.byDate).toEqual([
      'scope=configured-competitions/by-date/2024-07-14.json',
      'scope=configured-competitions/by-date/2026-06-11.json'
    ]);

    const datePartition = JSON.parse(await fs.readFile(
      path.join(root, 'versions', '2026-07-05T00-00-00Z', 'scope=configured-competitions', 'by-date', '2026-06-11.json'),
      'utf8'
    ));
    expect(datePartition.schemaVersion).toBe('miraichi.serving.matches.partition.v1');
    expect(datePartition.matches).toHaveLength(1);
    expect(datePartition.matches[0].id).toBe('match-1');
    expect(datePartition.matches[0].score).toEqual({ home: 2, away: 1 });
    expect(datePartition.matches[0].sourceRefs.map((ref: { sourceId: string }) => ref.sourceId)).toEqual([
      'manual-snapshot',
      'manual-snapshot'
    ]);

    const competitionPartition = JSON.parse(await fs.readFile(
      path.join(root, 'versions', '2026-07-05T00-00-00Z', 'scope=configured-competitions', 'by-competition', 'world-cup-2026', '2026.json'),
      'utf8'
    ));
    expect(competitionPartition.partition).toEqual({
      type: 'competition',
      key: 'world-cup-2026/2026'
    });

    const index = JSON.parse(await fs.readFile(
      path.join(root, 'versions', '2026-07-05T00-00-00Z', 'indexes', 'match-id.json'),
      'utf8'
    ));
    expect(index.entries['match-1']).toMatchObject({
      scope: 'configured-competitions',
      date: '2026-06-11',
      competitionId: 'world-cup-2026',
      season: '2026',
      partitionPath: 'scope=configured-competitions/by-date/2026-06-11.json'
    });

    await fs.rm(root, { recursive: true, force: true });
  });

  it('reads the current serving store snapshot from manifest partitions', async () => {
    const root = await tempServingRoot();
    await buildServingMatchStore({
      servingRoot: root,
      version: 'v1',
      snapshotId: 'serving-v1',
      generatedAt: importedAt,
      importedAt,
      sources: [{ sourceId: 'manual-snapshot', importedAt }],
      matches: [match()],
      scope: 'configured-competitions'
    });

    const snapshot = await readServingMatchStoreSnapshot(root);

    expect(snapshot.snapshotId).toBe('serving-v1');
    expect(snapshot.generatedAt).toBe(importedAt);
    expect(snapshot.matches).toHaveLength(1);
    expect(snapshot.matches[0].id).toBe('match-1');

    await fs.rm(root, { recursive: true, force: true });
  });

  it('throws serving_match_store_missing when manifest is absent', async () => {
    const root = await tempServingRoot();

    await expect(readServingMatchStoreSnapshot(root)).rejects.toMatchObject({
      code: 'serving_match_store_missing',
      statusCode: 503
    });

    await fs.rm(root, { recursive: true, force: true });
  });

  it('rejects invalid matches before writing serving partitions', async () => {
    const root = await tempServingRoot();
    const invalid = {
      ...match(),
      kickoffUtc: 'not-a-date'
    };

    await expect(buildServingMatchStore({
      servingRoot: root,
      version: 'v1',
      snapshotId: 'serving-v1',
      generatedAt: importedAt,
      importedAt,
      sources: [],
      matches: [invalid],
      scope: 'configured-competitions'
    })).rejects.toThrow('Invalid serving match at index 0');

    await fs.rm(root, { recursive: true, force: true });
  });
});
