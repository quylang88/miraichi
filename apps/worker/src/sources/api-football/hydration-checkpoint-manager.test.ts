import { describe, expect, it } from 'vitest';
import { HydrationCheckpointManager } from './hydration-checkpoint-manager.js';
import type { ApiFootballCompetitionEntry } from '@miraichi/config';

const SAMPLE_REGISTRY: readonly ApiFootballCompetitionEntry[] = [
  {
    entryId: 'api-football-eng-premier-league',
    sourceId: 'api-football',
    competitionId: 'eng-premier-league',
    competitionName: 'Premier League',
    country: 'England',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 39,
    currentSeason: 2026,
    historicalSeasons: [2024, 2025],
    sourceTimezone: 'Europe/London',
    enabled: true
  },
  {
    entryId: 'api-football-esp-la-liga',
    sourceId: 'api-football',
    competitionId: 'esp-la-liga',
    competitionName: 'La Liga',
    country: 'Spain',
    category: 'top5_europe',
    competitionType: 'club',
    providerLeagueId: 140,
    currentSeason: 2026,
    historicalSeasons: [2025],
    sourceTimezone: 'Europe/Madrid',
    enabled: true
  }
];

describe('HydrationCheckpointManager', () => {
  it('identifies un-hydrated seasons across configured competitions', () => {
    const manager = new HydrationCheckpointManager();
    const pending = manager.getPendingHydrations(SAMPLE_REGISTRY);

    // EPL has 3 seasons (2024, 2025, 2026) and La Liga has 2 (2025, 2026) -> Total 5
    expect(pending).toHaveLength(5);
    expect(pending[0]?.entry.competitionId).toBe('eng-premier-league');
    expect(pending[0]?.season).toBe(2024);
  });

  it('marks seasons as completed and excludes them from pending list', async () => {
    const manager = new HydrationCheckpointManager();
    await manager.markCompleted('eng-premier-league', 39, 2024, 380);
    await manager.markCompleted('eng-premier-league', 39, 2025, 380);

    expect(manager.isHydrated(39, 2024)).toBe(true);
    expect(manager.isHydrated(39, 2025)).toBe(true);
    expect(manager.isHydrated(39, 2026)).toBe(false);

    const pending = manager.getPendingHydrations(SAMPLE_REGISTRY);
    expect(pending).toHaveLength(3); // Only EPL 2026, La Liga 2025, La Liga 2026
    expect(pending.some((t) => t.entry.providerLeagueId === 39 && t.season === 2024)).toBe(false);
  });

  it('reports accurate hydration progress stats', async () => {
    const manager = new HydrationCheckpointManager();
    await manager.markCompleted('eng-premier-league', 39, 2024, 380);
    await manager.markFailed('esp-la-liga', 140, 2025, 'Rate limit exceeded');

    const progress = manager.getProgress(SAMPLE_REGISTRY);
    expect(progress.totalRequired).toBe(5);
    expect(progress.completed).toBe(1);
    expect(progress.failed).toBe(1);
    expect(progress.pending).toBe(4);
  });

  it('automatically detects newly added 51st competition in future', () => {
    const manager = new HydrationCheckpointManager({
      initialRecords: [
        { competitionId: 'eng-premier-league', leagueId: 39, season: 2024, status: 'completed', matchCount: 380 },
        { competitionId: 'eng-premier-league', leagueId: 39, season: 2025, status: 'completed', matchCount: 380 },
        { competitionId: 'eng-premier-league', leagueId: 39, season: 2026, status: 'completed', matchCount: 380 },
        { competitionId: 'esp-la-liga', leagueId: 140, season: 2025, status: 'completed', matchCount: 380 },
        { competitionId: 'esp-la-liga', leagueId: 140, season: 2026, status: 'completed', matchCount: 380 }
      ]
    });

    // All sample registry entries are done
    expect(manager.getPendingHydrations(SAMPLE_REGISTRY)).toHaveLength(0);

    // Now owner adds a new 3rd league (e.g. V-League)
    const expandedRegistry: ApiFootballCompetitionEntry[] = [
      ...SAMPLE_REGISTRY,
      {
        entryId: 'api-football-vie-v-league-1',
        sourceId: 'api-football',
        competitionId: 'vie-v-league-1',
        competitionName: 'V.League 1',
        country: 'Vietnam',
        category: 'asia_pacific',
        competitionType: 'club',
        providerLeagueId: 340,
        currentSeason: 2026,
        historicalSeasons: [2024, 2025],
        sourceTimezone: 'Asia/Ho_Chi_Minh',
        enabled: true
      }
    ];

    const newPending = manager.getPendingHydrations(expandedRegistry);
    expect(newPending).toHaveLength(3); // V-League 2024, 2025, 2026
    expect(newPending.every((p) => p.entry.providerLeagueId === 340)).toBe(true);
  });

  it('marks empty provider responses as empty and keeps them un-hydrated / retryable', async () => {
    const manager = new HydrationCheckpointManager();
    await manager.markEmpty('eng-premier-league', 39, 2024);

    expect(manager.isHydrated(39, 2024)).toBe(false);
    const rec = manager.getRecord(39, 2024);
    expect(rec?.status).toBe('empty');
    expect(rec?.matchCount).toBe(0);

    const pending = manager.getPendingHydrations(SAMPLE_REGISTRY);
    expect(pending.some((t) => t.entry.providerLeagueId === 39 && t.season === 2024)).toBe(true);
  });

  it('fails closed when loading a corrupt or malformed checkpoint file', async () => {
    const { mkdtemp, writeFile, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ckpt-test-'));
    const storagePath = join(tempDir, 'corrupt-checkpoints.json');

    try {
      // 1. Invalid JSON
      await writeFile(storagePath, 'NOT_JSON{{{', 'utf8');
      const manager1 = new HydrationCheckpointManager({ storagePath });
      await expect(manager1.load()).rejects.toThrow('hydration_checkpoint_corrupt');

      // 2. Invalid schema (missing schemaVersion or records)
      await writeFile(storagePath, JSON.stringify({ schemaVersion: 'wrong.version' }), 'utf8');
      const manager2 = new HydrationCheckpointManager({ storagePath });
      await expect(manager2.load()).rejects.toThrow('hydration_checkpoint_corrupt');

      await writeFile(storagePath, '', 'utf8');
      const manager3 = new HydrationCheckpointManager({ storagePath });
      await expect(manager3.load()).rejects.toThrow('hydration_checkpoint_corrupt');

      await writeFile(storagePath, JSON.stringify({
        schemaVersion: 'miraichi.hydration.v1',
        updatedAt: '2026-08-25T12:00:00.000Z',
        records: {
          '39:2025': {
            competitionId: 'eng-premier-league',
            leagueId: 39,
            season: 2024,
            status: 'completed',
            matchCount: 380,
            lastHydratedAt: '2026-08-25T12:00:00.000Z'
          }
        }
      }), 'utf8');
      const manager4 = new HydrationCheckpointManager({ storagePath });
      await expect(manager4.load()).rejects.toThrow('hydration_checkpoint_corrupt');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('recovers the last valid checkpoint backup after an interrupted replacement', async () => {
    const { mkdtemp, rename, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ckpt-recovery-'));
    const storagePath = join(tempDir, 'hydration-checkpoints.json');

    try {
      const manager1 = new HydrationCheckpointManager({ storagePath });
      await manager1.markCompleted('eng-premier-league', 39, 2024, 380);
      await rename(storagePath, `${storagePath}.backup`);

      const manager2 = new HydrationCheckpointManager({ storagePath });
      await manager2.load();

      expect(manager2.isHydrated(39, 2024)).toBe(true);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('atomically saves and reloads valid checkpoint records', async () => {
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const tempDir = await mkdtemp(join(tmpdir(), 'miraichi-ckpt-test-'));
    const storagePath = join(tempDir, 'valid-checkpoints.json');

    try {
      const manager1 = new HydrationCheckpointManager({ storagePath });
      await manager1.markCompleted('eng-premier-league', 39, 2024, 380);
      await manager1.markFailed('esp-la-liga', 140, 2025, 'quota');

      const manager2 = new HydrationCheckpointManager({ storagePath });
      await manager2.load();

      expect(manager2.isHydrated(39, 2024)).toBe(true);
      expect(manager2.getRecord(39, 2024)?.matchCount).toBe(380);
      expect(manager2.getRecord(140, 2025)?.status).toBe('failed');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
