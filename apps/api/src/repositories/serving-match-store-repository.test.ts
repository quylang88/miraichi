import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import type { LocalMatch } from '@miraichi/shared';
import { buildServingMatchStore } from './serving-match-store.js';
import { ServingMatchStoreRepository } from './serving-match-store-repository.js';

const importedAt = '2026-07-05T00:00:00.000Z';

const scheduledMatch: LocalMatch = {
  id: 'match-scheduled',
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
  sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: 'manual-1', importedAt }],
  updatedAt: importedAt
};

const completedMatch: LocalMatch = {
  id: 'match-completed',
  competition: {
    id: 'euro-2024',
    name: 'UEFA Euro',
    type: 'national-team',
    season: '2024'
  },
  kickoffUtc: '2024-07-14T19:00:00.000Z',
  status: 'completed',
  homeTeam: { id: 'team-spain', name: 'Spain' },
  awayTeam: { id: 'team-england', name: 'England' },
  score: { home: 2, away: 1 },
  sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: 'manual-2', importedAt }],
  updatedAt: importedAt
};

async function createStore(matches: LocalMatch[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-serving-repo-'));
  await buildServingMatchStore({
    servingRoot: root,
    version: 'v1',
    snapshotId: 'serving-v1',
    generatedAt: importedAt,
    importedAt,
    sources: [{ sourceId: 'manual-snapshot', importedAt }],
    matches,
    scope: 'configured-competitions'
  });
  return root;
}

describe('ServingMatchStoreRepository', () => {
  it('lists serving store matches with the existing app filters and sort order', async () => {
    const root = await createStore([completedMatch, scheduledMatch]);
    const repo = new ServingMatchStoreRepository({ servingRoot: root, now: () => new Date(importedAt) });

    const all = await repo.listMatches();
    expect(all.matches.map((item) => item.id)).toEqual(['match-scheduled', 'match-completed']);
    expect(all.snapshot.snapshotId).toBe('serving-v1');
    expect(all.snapshot.matchCount).toBe(2);

    const byDate = await repo.listMatches({ date: '2026-06-11' });
    expect(byDate.matches.map((item) => item.id)).toEqual(['match-scheduled']);

    const byCompetition = await repo.listMatches({ competitionId: 'euro-2024' });
    expect(byCompetition.matches.map((item) => item.id)).toEqual(['match-completed']);

    const byStatus = await repo.listMatches({ status: 'completed' });
    expect(byStatus.matches.map((item) => item.id)).toEqual(['match-completed']);

    await fs.rm(root, { recursive: true, force: true });
  });

  it('correctly partitions early-morning matches across midnight in user timezone', async () => {
    // Match at 19:30 UTC on 2026-08-31 is 02:30 AM on 2026-09-01 in Asia/Ho_Chi_Minh (+7)
    const earlyMorningMatch: LocalMatch = {
      id: 'match-aston-villa-vs-arsenal',
      competition: {
        id: 'eng-league-1',
        name: 'English League 1',
        type: 'club',
        season: '2026-27'
      },
      kickoffUtc: '2026-08-31T19:30:00.000Z',
      status: 'scheduled',
      homeTeam: { id: 'team-aston-villa', name: 'Aston Villa' },
      awayTeam: { id: 'team-arsenal', name: 'Arsenal' },
      score: { home: null, away: null },
      sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: 'manual-av-ars', importedAt }],
      updatedAt: importedAt
    };

    const root = await createStore([earlyMorningMatch]);
    const repo = new ServingMatchStoreRepository({ servingRoot: root, now: () => new Date(importedAt) });

    // In UTC, it belongs to 2026-08-31
    const utcAug31 = await repo.listMatches({ date: '2026-08-31', timezone: 'UTC' });
    expect(utcAug31.matches.map((m) => m.id)).toEqual(['match-aston-villa-vs-arsenal']);
    const utcSept1 = await repo.listMatches({ date: '2026-09-01', timezone: 'UTC' });
    expect(utcSept1.matches).toHaveLength(0);

    // In Asia/Ho_Chi_Minh (+7), it belongs to 2026-09-01 (02:30 AM)
    const vnAug31 = await repo.listMatches({ date: '2026-08-31', timezone: 'Asia/Ho_Chi_Minh' });
    expect(vnAug31.matches).toHaveLength(0);
    const vnSept1 = await repo.listMatches({ date: '2026-09-01', timezone: 'Asia/Ho_Chi_Minh' });
    expect(vnSept1.matches.map((m) => m.id)).toEqual(['match-aston-villa-vs-arsenal']);

    await fs.rm(root, { recursive: true, force: true });
  });

  it('finds a match by id from the serving store', async () => {
    const root = await createStore([scheduledMatch]);
    const repo = new ServingMatchStoreRepository({ servingRoot: root });

    await expect(repo.findById('match-scheduled')).resolves.toMatchObject({
      id: 'match-scheduled'
    });
    await expect(repo.findById('unknown')).resolves.toBeNull();

    await fs.rm(root, { recursive: true, force: true });
  });

  it('returns missing status when the serving store is absent and never falls back to the old single JSON file', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-serving-missing-'));
    const repo = new ServingMatchStoreRepository({
      servingRoot: root,
      now: () => new Date(importedAt)
    });

    await expect(repo.listMatches()).rejects.toMatchObject({
      code: 'serving_match_store_missing',
      statusCode: 503
    });

    const status = await repo.getStatus();
    expect(status).toMatchObject({
      snapshotId: 'missing-serving-match-store',
      generatedAt: importedAt,
      importedAt,
      matchCount: 0,
      competitions: [],
      sources: [],
      freshness: 'missing'
    });
    expect(status.warnings).toContain('Serving match store is missing');

    await fs.rm(root, { recursive: true, force: true });
  });

  it('keeps the serving store fresh through exactly twelve hours and marks it stale after', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-serving-stale-'));
    await buildServingMatchStore({
      servingRoot: root,
      version: 'v1',
      snapshotId: 'serving-v1',
      generatedAt: '2026-07-01T00:00:00.000Z',
      importedAt: '2026-07-01T00:00:00.000Z',
      sources: [{ sourceId: 'manual-snapshot', importedAt: '2026-07-01T00:00:00.000Z' }],
      matches: [scheduledMatch],
      scope: 'configured-competitions'
    });
    const statusAtTwelveHours = await new ServingMatchStoreRepository({
      servingRoot: root,
      now: () => new Date('2026-07-01T12:00:00.000Z')
    }).getStatus();
    const statusAfterTwelveHours = await new ServingMatchStoreRepository({
      servingRoot: root,
      now: () => new Date('2026-07-01T12:00:00.001Z')
    }).getStatus();

    expect(statusAtTwelveHours.freshness).toBe('fresh');
    expect(statusAfterTwelveHours.freshness).toBe('stale');

    await fs.rm(root, { recursive: true, force: true });
  });
});
