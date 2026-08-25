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
});
