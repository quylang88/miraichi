import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { LocalMatchSnapshotRepository } from './local-match-snapshot-repository.js';
import { LocalMatch, validateLocalDataSnapshotStatus } from '@miraichi/shared';

describe('LocalMatchSnapshotRepository', () => {
  const mockMatch1: LocalMatch = {
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
    awayTeam: { id: 'team-safrica', name: 'South Africa' },
    score: { home: null, away: null },
    sourceRefs: [
      { sourceId: 'manual-snapshot', importedAt: '2026-07-01T00:00:00.000Z' }
    ],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const mockMatch2: LocalMatch = {
    id: 'match-2',
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
    sourceRefs: [
      { sourceId: 'manual-snapshot', importedAt: '2026-07-01T00:00:00.000Z' }
    ],
    updatedAt: '2026-07-01T00:00:00.000Z'
  };

  const mockSnapshot = {
    snapshotId: 'test-snapshot-1',
    generatedAt: '2026-07-01T00:00:00.000Z',
    importedAt: '2026-07-01T00:00:00.000Z',
    sources: [
      { sourceId: 'manual-snapshot', importedAt: '2026-07-01T00:00:00.000Z' }
    ],
    matches: [mockMatch1, mockMatch2]
  };

  async function createTempSnapshot(data: unknown): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-repo-test-'));
    const filePath = path.join(tempDir, 'snapshot.json');
    await fs.writeFile(filePath, JSON.stringify(data));
    return filePath;
  }

  it('loads snapshot JSON from explicit path', async () => {
    const tempPath = await createTempSnapshot(mockSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });
    const loaded = await repo.loadSnapshot();

    expect(loaded.snapshotId).toBe('test-snapshot-1');
    expect(loaded.matches).toHaveLength(2);

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('returns scheduled matches before completed matches and sorts correctly', async () => {
    const tempPath = await createTempSnapshot(mockSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });
    const feed = await repo.listMatches();

    expect(feed.matches[0].id).toBe('match-1'); // Scheduled match 2026 comes first
    expect(feed.matches[1].id).toBe('match-2'); // Completed match 2024 comes second

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('filters matches by date=YYYY-MM-DD', async () => {
    const tempPath = await createTempSnapshot(mockSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });

    const feed1 = await repo.listMatches({ date: '2026-06-11' });
    expect(feed1.matches).toHaveLength(1);
    expect(feed1.matches[0].id).toBe('match-1');

    const feed2 = await repo.listMatches({ date: '2024-07-14' });
    expect(feed2.matches).toHaveLength(1);
    expect(feed2.matches[0].id).toBe('match-2');

    const feed3 = await repo.listMatches({ date: '1999-12-31' });
    expect(feed3.matches).toHaveLength(0);

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('filters matches by competitionId', async () => {
    const tempPath = await createTempSnapshot(mockSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });

    const feed1 = await repo.listMatches({ competitionId: 'world-cup-2026' });
    expect(feed1.matches).toHaveLength(1);
    expect(feed1.matches[0].id).toBe('match-1');

    const feed2 = await repo.listMatches({ competitionId: 'euro-2024' });
    expect(feed2.matches).toHaveLength(1);
    expect(feed2.matches[0].id).toBe('match-2');

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('filters matches by status', async () => {
    const tempPath = await createTempSnapshot(mockSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });

    const feed1 = await repo.listMatches({ status: 'scheduled' });
    expect(feed1.matches).toHaveLength(1);
    expect(feed1.matches[0].id).toBe('match-1');

    const feed2 = await repo.listMatches({ status: 'completed' });
    expect(feed2.matches).toHaveLength(1);
    expect(feed2.matches[0].id).toBe('match-2');

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('rejects malformed snapshot with validation errors', async () => {
    const malformedSnapshot = {
      ...mockSnapshot,
      matches: [
        {
          ...mockMatch1,
          kickoffUtc: 'invalid-kickoff-time'
        }
      ]
    };
    const tempPath = await createTempSnapshot(malformedSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });

    await expect(repo.loadSnapshot()).rejects.toThrow('Invalid match at index 0');

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('finds match by id or returns null', async () => {
    const tempPath = await createTempSnapshot(mockSnapshot);
    const repo = new LocalMatchSnapshotRepository({ snapshotPath: tempPath });

    const match = await repo.findById('match-1');
    expect(match).not.toBeNull();
    expect(match?.id).toBe('match-1');

    const notFound = await repo.findById('unknown-id');
    expect(notFound).toBeNull();

    await fs.rm(path.dirname(tempPath), { recursive: true, force: true });
  });

  it('returns missing freshness status when snapshot file is not found', async () => {
    const now = new Date('2026-07-02T00:00:00.000Z');
    const repo = new LocalMatchSnapshotRepository({
      snapshotPath: 'nonexistent-file.json',
      now: () => now
    });
    const status = await repo.getStatus();

    expect(validateLocalDataSnapshotStatus(status).ok).toBe(true);
    expect(status.snapshotId).toBe('missing-local-snapshot');
    expect(status.generatedAt).toBe(now.toISOString());
    expect(status.importedAt).toBe(now.toISOString());
    expect(status.freshness).toBe('missing');
    expect(status.matchCount).toBe(0);
    expect(status.warnings).toContain('Local snapshot file is missing');
  });

  it('returns correct freshness status based on generatedAt date', async () => {
    const freshDate = new Date();
    const staleDate = new Date(freshDate.getTime() - 8 * 24 * 60 * 60 * 1000);

    const freshSnapshot = { ...mockSnapshot, generatedAt: freshDate.toISOString() };
    const staleSnapshot = { ...mockSnapshot, generatedAt: staleDate.toISOString() };

    const freshPath = await createTempSnapshot(freshSnapshot);
    const stalePath = await createTempSnapshot(staleSnapshot);

    const repoFresh = new LocalMatchSnapshotRepository({
      snapshotPath: freshPath,
      now: () => freshDate
    });
    const statusFresh = await repoFresh.getStatus();
    expect(statusFresh.freshness).toBe('fresh');

    const repoStale = new LocalMatchSnapshotRepository({
      snapshotPath: stalePath,
      now: () => freshDate
    });
    const statusStale = await repoStale.getStatus();
    expect(statusStale.freshness).toBe('stale');

    await fs.rm(path.dirname(freshPath), { recursive: true, force: true });
    await fs.rm(path.dirname(stalePath), { recursive: true, force: true });
  });
});
