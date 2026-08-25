import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import {
  LocalMatchDetailStore,
  resolveContainedPath
} from './local-match-detail-store.js';
import type {
  LocalMatch,
  LocalMatchDetail,
  LocalScoreBreakdown,
  LocalMatchTeamStats,
  LocalMatchEvent
} from '@miraichi/shared';

const mockCompletedMatch: LocalMatch = {
  id: 'match-euro-2024-esp-eng',
  competition: {
    id: 'euro-2024',
    name: 'UEFA Euro',
    type: 'national-team',
    season: '2024'
  },
  kickoffUtc: '2024-07-14T19:00:00.000Z',
  status: 'completed',
  homeTeam: { id: 'team-spain', name: 'Spain', countryCode: 'ESP' },
  awayTeam: { id: 'team-england', name: 'England', countryCode: 'ENG' },
  score: { home: 2, away: 1 },
  venue: 'Olympiastadion Berlin',
  round: 'Final',
  stage: 'final',
  neutralVenue: true,
  sourceRefs: [
    {
      sourceId: 'openfootball',
      importedAt: '2026-07-01T00:00:00.000Z'
    }
  ],
  updatedAt: '2026-07-01T00:00:00.000Z'
};

const mockScoreBreakdown: LocalScoreBreakdown = {
  halftime: { home: 0, away: 0 },
  fulltime: { home: 2, away: 1 },
  extratime: { home: null, away: null },
  penalty: { home: null, away: null }
};

const mockEvents: LocalMatchEvent[] = [
  {
    minute: 47,
    extraMinute: null,
    teamId: 'team-spain',
    type: 'goal',
    detail: 'Normal Goal',
    player: 'Nico Williams',
    assist: 'Lamine Yamal',
    label: 'Goal 1-0: Nico Williams (47)'
  },
  {
    minute: 73,
    extraMinute: null,
    teamId: 'team-england',
    type: 'goal',
    detail: 'Normal Goal',
    player: 'Cole Palmer',
    assist: 'Jude Bellingham',
    label: 'Goal 1-1: Cole Palmer (73)'
  },
  {
    minute: 86,
    extraMinute: null,
    teamId: 'team-spain',
    type: 'goal',
    detail: 'Normal Goal',
    player: 'Mikel Oyarzabal',
    assist: 'Marc Cucurella',
    label: 'Goal 2-1: Mikel Oyarzabal (86)'
  }
];

const mockTeamStats: LocalMatchTeamStats[] = [
  {
    teamId: 'team-spain',
    teamName: 'Spain',
    cornerKicks: 10,
    yellowCards: 1,
    redCards: 0,
    totalShots: 16,
    shotsOnGoal: 6,
    possessionPercentage: 65.5
  },
  {
    teamId: 'team-england',
    teamName: 'England',
    cornerKicks: 2,
    yellowCards: 3,
    redCards: 0,
    totalShots: 9,
    shotsOnGoal: 4,
    possessionPercentage: 34.5
  }
];

const mockRichDetail: LocalMatchDetail = {
  match: mockCompletedMatch,
  status: 'completed',
  elapsedMinute: 90,
  referee: 'François Letexier',
  scoreBreakdown: mockScoreBreakdown,
  events: mockEvents,
  teamStats: mockTeamStats,
  warnings: ['No extra time required'],
  notes: ['Final match of Euro 2024'],
  updatedAt: '2026-07-01T00:00:00.000Z'
};

describe('LocalMatchDetailStore', () => {
  let tempDir: string;
  let store: LocalMatchDetailStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-detail-store-test-'));
    store = new LocalMatchDetailStore({ dataRoot: tempDir });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('constructor and options', () => {
    it('accepts string dataRoot or object options', () => {
      const storeFromString = new LocalMatchDetailStore(tempDir);
      expect(storeFromString).toBeInstanceOf(LocalMatchDetailStore);

      const storeFromOptions = new LocalMatchDetailStore({ dataRoot: tempDir });
      expect(storeFromOptions).toBeInstanceOf(LocalMatchDetailStore);
    });

    it('rejects empty or missing dataRoot', () => {
      expect(() => new LocalMatchDetailStore('')).toThrow();
      expect(() => new LocalMatchDetailStore({ dataRoot: '   ' })).toThrow();
    });
  });

  describe('round-trip upsert and get', () => {
    it('saves and reads rich valid detail accurately', async () => {
      await store.upsertDetail(mockRichDetail);

      const retrieved = await store.getDetail(mockRichDetail.match.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved).toEqual(mockRichDetail);

      const has = await store.hasDetail(mockRichDetail.match.id);
      expect(has).toBe(true);
    });

    it('stores file at <dataRoot>/match-details/<match-id>.json', async () => {
      await store.upsertDetail(mockRichDetail);

      const expectedPath = path.join(tempDir, 'match-details', `${mockRichDetail.match.id}.json`);
      const fileExists = await fs.stat(expectedPath).then(() => true).catch(() => false);
      expect(fileExists).toBe(true);

      const raw = JSON.parse(await fs.readFile(expectedPath, 'utf8'));
      expect(raw.match.id).toBe(mockRichDetail.match.id);
    });

    it('returns null for non-existent match ID', async () => {
      const retrieved = await store.getDetail('non-existent-match-id');
      expect(retrieved).toBeNull();

      const has = await store.hasDetail('non-existent-match-id');
      expect(has).toBe(false);
    });

    it('recovers the last valid backup after an interrupted Windows replacement', async () => {
      await store.upsertDetail(mockRichDetail);
      const detailsDir = path.join(tempDir, 'match-details');
      const targetPath = path.join(detailsDir, `${mockRichDetail.match.id}.json`);
      const backupPath = path.join(detailsDir, `.backup-${mockRichDetail.match.id}.json`);
      await fs.rename(targetPath, backupPath);

      const restartedStore = new LocalMatchDetailStore({ dataRoot: tempDir });
      expect(await restartedStore.getDetail(mockRichDetail.match.id)).toEqual(mockRichDetail);
      expect(await fs.readFile(targetPath, 'utf8')).toContain(mockRichDetail.match.id);
      await expect(fs.stat(backupPath)).rejects.toMatchObject({ code: 'ENOENT' });
    });

    it('propagates storage read errors instead of treating them as a cache miss', async () => {
      const detailsDir = path.join(tempDir, 'match-details');
      await fs.mkdir(path.join(detailsDir, 'directory-instead-of-file.json'), { recursive: true });
      await expect(store.getDetail('directory-instead-of-file')).rejects.toThrow();
    });

    it('lists stored detail match IDs in sorted order', async () => {
      const match2: LocalMatchDetail = {
        ...mockRichDetail,
        match: {
          ...mockCompletedMatch,
          id: 'match-abc-001'
        },
        updatedAt: '2026-07-01T01:00:00.000Z'
      };

      const match3: LocalMatchDetail = {
        ...mockRichDetail,
        match: {
          ...mockCompletedMatch,
          id: 'match-xyz-999'
        },
        updatedAt: '2026-07-01T02:00:00.000Z'
      };

      await store.upsertDetail(mockRichDetail);
      await store.upsertDetail(match2);
      await store.upsertDetail(match3);

      const list = await store.listDetailMatchIds();
      expect(list).toEqual([
        'match-abc-001',
        'match-euro-2024-esp-eng',
        'match-xyz-999'
      ]);
    });

    it('returns empty array if match-details directory does not exist when listing', async () => {
      const emptyStore = new LocalMatchDetailStore(path.join(tempDir, 'fresh-subdir'));
      const list = await emptyStore.listDetailMatchIds();
      expect(list).toEqual([]);
    });
  });

  describe('validation and forbidden fields rejection', () => {
    it('rejects detail with forbidden top-level fields on upsertDetail', async () => {
      const forbiddenFields = [
        'providerFixtureId',
        'sourceProviderId',
        'providerUrl',
        'fixtureId',
        'xG',
        'expectedGoals',
        'expected_goals',
        'predictions',
        'odds'
      ];

      for (const field of forbiddenFields) {
        const invalidDetail = {
          ...mockRichDetail,
          [field]: 'forbidden_value'
        };
        await expect(store.upsertDetail(invalidDetail as unknown as LocalMatchDetail)).rejects.toThrow(
          /Forbidden field/
        );
      }
    });

    it('rejects detail with forbidden fields nested in teamStats, events, scoreBreakdown, or match', async () => {
      const withNestedXg = {
        ...mockRichDetail,
        teamStats: [
          {
            ...mockTeamStats[0]!,
            xG: 1.85
          }
        ]
      };
      await expect(store.upsertDetail(withNestedXg as unknown as LocalMatchDetail)).rejects.toThrow(
        /Forbidden field/
      );

      const withMatchProviderId = {
        ...mockRichDetail,
        match: {
          ...mockCompletedMatch,
          providerFixtureId: 12345
        }
      };
      await expect(store.upsertDetail(withMatchProviderId as unknown as LocalMatchDetail)).rejects.toThrow(
        /Forbidden field/
      );
    });

    it('rejects detail with invalid status (e.g. in_play)', async () => {
      const invalidStatusDetail = {
        ...mockRichDetail,
        status: 'in_play'
      };
      await expect(store.upsertDetail(invalidStatusDetail as unknown as LocalMatchDetail)).rejects.toThrow(
        /Field "status" cannot be "in_play"/
      );
    });

    it('returns null on getDetail if file on disk has invalid JSON syntax', async () => {
      const detailsDir = path.join(tempDir, 'match-details');
      await fs.mkdir(detailsDir, { recursive: true });
      await fs.writeFile(path.join(detailsDir, 'corrupt-match.json'), '{ invalid json syntax ...', 'utf8');

      const retrieved = await store.getDetail('corrupt-match');
      expect(retrieved).toBeNull();
      expect(await store.hasDetail('corrupt-match')).toBe(false);
    });

    it('returns null on getDetail if file on disk fails schema validation', async () => {
      const detailsDir = path.join(tempDir, 'match-details');
      await fs.mkdir(detailsDir, { recursive: true });
      await fs.writeFile(
        path.join(detailsDir, 'bad-schema.json'),
        JSON.stringify({ match: { id: 'bad-schema' }, status: 'not-a-valid-status' }),
        'utf8'
      );

      const retrieved = await store.getDetail('bad-schema');
      expect(retrieved).toBeNull();
    });
  });

  describe('path traversal protection', () => {
    it('rejects path traversal match IDs with slashes or parent directory in getDetail', async () => {
      await expect(store.getDetail('../outside')).rejects.toThrow(/Unsafe match ID|Path traversal/);
      await expect(store.getDetail('sub/dir/id')).rejects.toThrow(/Unsafe match ID|Path traversal/);
      await expect(store.getDetail('..\\outside')).rejects.toThrow(/Unsafe match ID|Path traversal/);
      await expect(store.getDetail('sub\\dir\\id')).rejects.toThrow(/Unsafe match ID|Path traversal/);
      await expect(store.getDetail('unsafe:windows-name')).rejects.toThrow(/Unsafe match ID/);
    });

    it('rejects path traversal match IDs in upsertDetail', async () => {
      const traversalDetail: LocalMatchDetail = {
        ...mockRichDetail,
        match: {
          ...mockCompletedMatch,
          id: '../../escaped-match'
        }
      };
      await expect(store.upsertDetail(traversalDetail)).rejects.toThrow(/Unsafe match ID|Path traversal/);
    });

    it('resolveContainedPath throws when path escapes root', () => {
      expect(() => resolveContainedPath(tempDir, '..', 'escaped.json')).toThrow(/escaped/i);
      expect(() => resolveContainedPath(tempDir, '../../outside.json')).toThrow(/escaped/i);
    });
  });

  describe('merge strategy', () => {
    it('preserves known terminal events when a newer partial detail contains only one event', async () => {
      await store.upsertDetail(mockRichDetail);
      await store.upsertDetail({
        ...mockRichDetail,
        events: [mockEvents[0]!],
        warnings: ['events_partial'],
        updatedAt: '2026-07-01T02:00:00.000Z'
      });

      const merged = await store.getDetail(mockRichDetail.match.id);
      expect(merged?.events).toEqual(mockEvents);
    });

    it('lets a newer complete replacement clear stale partial warnings and replace the event list', async () => {
      await store.upsertDetail({
        ...mockRichDetail,
        warnings: ['events_partial'],
        updatedAt: '2026-07-01T01:00:00.000Z'
      });
      await store.upsertDetail({
        ...mockRichDetail,
        events: [],
        warnings: [],
        updatedAt: '2026-07-01T02:00:00.000Z'
      });

      const merged = await store.getDetail(mockRichDetail.match.id);
      expect(merged?.events).toEqual([]);
      expect(merged?.warnings).not.toContain('events_partial');
    });

    it('does not regress completed detail status from a newer scheduled payload', async () => {
      await store.upsertDetail(mockRichDetail);
      await store.upsertDetail({
        ...mockRichDetail,
        match: {
          ...mockRichDetail.match,
          status: 'scheduled',
          score: { home: null, away: null }
        },
        status: 'scheduled',
        updatedAt: '2026-07-01T02:00:00.000Z'
      });

      const merged = await store.getDetail(mockRichDetail.match.id);
      expect(merged?.status).toBe('completed');
      expect(merged?.match.status).toBe('completed');
      expect(merged?.match.score).toEqual({ home: 2, away: 1 });
    });
    it('newer detail (updatedAt >= existing.updatedAt) merges properties, preserves non-null existing fields, and deduplicates warnings/notes', async () => {
      const initialDetail: LocalMatchDetail = {
        ...mockRichDetail,
        referee: 'Original Referee',
        teamStats: [
          {
            teamId: 'team-spain',
            teamName: 'Spain',
            cornerKicks: 8,
            yellowCards: 1,
            redCards: 0,
            totalShots: 15,
            shotsOnGoal: 5,
            possessionPercentage: 60.0
          },
          {
            teamId: 'team-england',
            teamName: 'England',
            cornerKicks: 2,
            yellowCards: 2,
            redCards: 0,
            totalShots: 8,
            shotsOnGoal: 3,
            possessionPercentage: 40.0
          }
        ],
        warnings: ['Warning 1'],
        notes: ['Note 1'],
        updatedAt: '2026-07-01T00:00:00.000Z'
      };

      await store.upsertDetail(initialDetail);

      // Newer detail with updated stats, additional events, and new notes/warnings
      const newerDetail: LocalMatchDetail = {
        ...mockRichDetail,
        referee: null, // Should preserve existing 'Original Referee' since incoming is null
        teamStats: [
          {
            teamId: 'team-spain',
            teamName: 'Spain',
            cornerKicks: 10, // Updated
            yellowCards: 1,
            redCards: 0,
            totalShots: 16, // Updated
            shotsOnGoal: 6, // Updated
            possessionPercentage: 65.5 // Updated
          },
          {
            teamId: 'team-england',
            teamName: 'England',
            cornerKicks: 2,
            yellowCards: 3, // Updated
            redCards: 0,
            totalShots: 9, // Updated
            shotsOnGoal: 4, // Updated
            possessionPercentage: 34.5 // Updated
          }
        ],
        warnings: ['Warning 1', 'Warning 2'], // Warning 1 is duplicate
        notes: ['Note 1', 'Note 2'], // Note 1 is duplicate
        updatedAt: '2026-07-01T01:00:00.000Z'
      };

      await store.upsertDetail(newerDetail);

      const merged = await store.getDetail(mockRichDetail.match.id);
      expect(merged).not.toBeNull();
      expect(merged!.referee).toBe('Original Referee');
      expect(merged!.teamStats).toEqual(mockTeamStats);
      expect(merged!.warnings).toEqual(['Warning 1', 'Warning 2']);
      expect(merged!.notes).toEqual(['Note 1', 'Note 2']);
      expect(merged!.updatedAt).toBe('2026-07-01T01:00:00.000Z');
    });

    it('older detail (updatedAt < existing.updatedAt) keeps existing as base and only enriches missing non-conflicting properties', async () => {
      const { teamStats: _, ...baseDetail } = mockRichDetail;
      const initialDetail: LocalMatchDetail = {
        ...baseDetail,
        referee: 'Original Referee',
        warnings: ['Warning A'],
        notes: ['Note A'],
        updatedAt: '2026-07-01T10:00:00.000Z'
      };

      await store.upsertDetail(initialDetail);

      // Older detail that has teamStats and referee: 'Older Referee'
      const olderDetail: LocalMatchDetail = {
        ...mockRichDetail,
        referee: 'Older Referee', // Should be ignored in favor of existing 'Original Referee'
        teamStats: mockTeamStats, // Should be enriched into existing
        warnings: ['Warning A', 'Warning B'],
        notes: ['Note A', 'Note B'],
        updatedAt: '2026-07-01T08:00:00.000Z' // Older
      };

      await store.upsertDetail(olderDetail);

      const merged = await store.getDetail(mockRichDetail.match.id);
      expect(merged).not.toBeNull();
      expect(merged!.referee).toBe('Original Referee'); // Kept existing
      expect(merged!.teamStats).toEqual(mockTeamStats); // Enriched from older
      expect(merged!.warnings).toEqual(['Warning A', 'Warning B']);
      expect(merged!.notes).toEqual(['Note A', 'Note B']);
      expect(merged!.updatedAt).toBe('2026-07-01T10:00:00.000Z'); // Kept newer updatedAt
    });

    it('overwrites corrupted file on disk when upserting valid detail', async () => {
      const detailsDir = path.join(tempDir, 'match-details');
      await fs.mkdir(detailsDir, { recursive: true });
      await fs.writeFile(
        path.join(detailsDir, `${mockRichDetail.match.id}.json`),
        'corrupted content',
        'utf8'
      );

      await store.upsertDetail(mockRichDetail);

      const retrieved = await store.getDetail(mockRichDetail.match.id);
      expect(retrieved).toEqual(mockRichDetail);
    });
  });

  describe('atomic file replacement and crash safety', () => {
    it('cleans up temporary file and leaves target completely unharmed if write fails during fsync', async () => {
      // First save a valid detail
      await store.upsertDetail(mockRichDetail);

      const originalFilePath = path.join(tempDir, 'match-details', `${mockRichDetail.match.id}.json`);
      const originalContent = await fs.readFile(originalFilePath, 'utf8');

      // Create store instance with hook that fails before sync
      const failingStore = new LocalMatchDetailStore({
        dataRoot: tempDir,
        _writeHook: (stage) => {
          if (stage === 'before-sync') {
            throw new Error('Simulated IO fsync failure');
          }
        }
      });

      const updatedDetail: LocalMatchDetail = {
        ...mockRichDetail,
        referee: 'New Referee Should Not Be Written',
        updatedAt: '2026-07-01T05:00:00.000Z'
      };

      await expect(failingStore.upsertDetail(updatedDetail)).rejects.toThrow('Simulated IO fsync failure');

      // Verify the target file content is identical to before the failure
      const currentContent = await fs.readFile(originalFilePath, 'utf8');
      expect(currentContent).toBe(originalContent);

      const currentDetail = await store.getDetail(mockRichDetail.match.id);
      expect(currentDetail?.referee).toBe('François Letexier');

      // Verify no temporary files remain
      const files = await fs.readdir(path.join(tempDir, 'match-details'));
      const tmpFiles = files.filter((f) => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });

    it('cleans up temporary file and leaves target completely unharmed if write fails before rename', async () => {
      await store.upsertDetail(mockRichDetail);

      const originalFilePath = path.join(tempDir, 'match-details', `${mockRichDetail.match.id}.json`);
      const originalContent = await fs.readFile(originalFilePath, 'utf8');

      const failingStore = new LocalMatchDetailStore({
        dataRoot: tempDir,
        _writeHook: (stage) => {
          if (stage === 'before-rename') {
            throw new Error('Simulated failure before atomic rename');
          }
        }
      });

      const updatedDetail: LocalMatchDetail = {
        ...mockRichDetail,
        referee: 'New Referee Should Not Be Written',
        updatedAt: '2026-07-01T05:00:00.000Z'
      };

      await expect(failingStore.upsertDetail(updatedDetail)).rejects.toThrow('Simulated failure before atomic rename');

      const currentContent = await fs.readFile(originalFilePath, 'utf8');
      expect(currentContent).toBe(originalContent);

      const currentDetail = await store.getDetail(mockRichDetail.match.id);
      expect(currentDetail?.referee).toBe('François Letexier');

      const files = await fs.readdir(path.join(tempDir, 'match-details'));
      const tmpFiles = files.filter((f) => f.startsWith('.tmp-'));
      expect(tmpFiles).toHaveLength(0);
    });
  });
});
