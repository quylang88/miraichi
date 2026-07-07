import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import { buildSportmonksLeagueCaptureInventory } from './league-capture-inventory.js';

async function writeRaw(root: string, endpointKey: string, urlPath: string, payload: unknown): Promise<void> {
  await writeRawProviderPayload(root, {
    schemaVersion: 'miraichi.provider.raw.v1',
    provider: 'sportmonks',
    endpointKey,
    urlPath,
    query: { page: '1' },
    fetchedAt: '2026-07-07T00:00:00.000Z',
    payloadHash: createPayloadHash(payload),
    rateLimit: {},
    payload
  });
}

describe('sportmonks league capture inventory', () => {
  it('selects one league, newest seasons, fixtures, teams, and team-season pairs', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await writeRaw(root, 'fixtures.all', '/fixtures', {
      data: [
        { id: 100, league_id: 8, season_id: 2025 },
        { id: 101, league_id: 8, season_id: 2024 },
        { id: 999, league_id: 9, season_id: 2025 }
      ]
    });
    await writeRaw(root, 'seasons.all', '/seasons', {
      data: [
        { id: 2024, league_id: 8, name: '2024/2025', ending_at: '2025-05-31' },
        { id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }
      ]
    });
    await writeRaw(root, 'teams.bySeasonId', '/teams/seasons/2025', {
      data: [{ id: 1 }, { id: 2 }]
    });

    await expect(buildSportmonksLeagueCaptureInventory({
      captureRoot: root,
      leagueId: 8,
      maxSeasons: 1
    })).resolves.toEqual({
      leagueId: 8,
      seasons: [{ seasonId: 2025, name: '2025/2026', sortDate: '2026-05-31' }],
      fixtureIds: [100],
      teamIds: [1, 2],
      teamSeasons: [{ teamId: 1, seasonId: 2025 }, { teamId: 2, seasonId: 2025 }]
    });
  });

  it('fails instead of starting a hidden global crawl when inventory is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await expect(buildSportmonksLeagueCaptureInventory({ captureRoot: root, leagueId: 8 }))
      .rejects.toThrow('No local Sportmonks fixture inventory found for league 8');
  });

  it('includes all seasons when maxSeasons is not specified', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await writeRaw(root, 'fixtures.all', '/fixtures', {
      data: [
        { id: 100, league_id: 8, season_id: 2025 },
        { id: 101, league_id: 8, season_id: 2024 }
      ]
    });
    await writeRaw(root, 'seasons.all', '/seasons', {
      data: [
        { id: 2024, league_id: 8, name: '2024/2025', ending_at: '2025-05-31' },
        { id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }
      ]
    });

    const inventory = await buildSportmonksLeagueCaptureInventory({
      captureRoot: root,
      leagueId: 8
    });

    expect(inventory.seasons).toHaveLength(2);
    expect(inventory.fixtureIds).toEqual([100, 101]);
  });

  it('filters to explicit seasonIds only', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await writeRaw(root, 'fixtures.all', '/fixtures', {
      data: [
        { id: 100, league_id: 8, season_id: 2025 },
        { id: 101, league_id: 8, season_id: 2024 }
      ]
    });
    await writeRaw(root, 'seasons.all', '/seasons', {
      data: [
        { id: 2024, league_id: 8, name: '2024/2025', ending_at: '2025-05-31' },
        { id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }
      ]
    });

    const inventory = await buildSportmonksLeagueCaptureInventory({
      captureRoot: root,
      leagueId: 8,
      seasonIds: [2024]
    });

    expect(inventory.seasons).toEqual([{ seasonId: 2024, name: '2024/2025', sortDate: '2025-05-31' }]);
    expect(inventory.fixtureIds).toEqual([101]);
  });

  it('falls back to fixture participants when teams.bySeasonId is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await writeRaw(root, 'fixtures.all', '/fixtures', {
      data: [{ id: 100, league_id: 8, season_id: 2025 }]
    });
    await writeRaw(root, 'seasons.all', '/seasons', {
      data: [{ id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }]
    });
    // Write enriched fixture with participants instead of teams.bySeasonId
    await writeRaw(root, 'fixtures.enrichedById', '/fixtures/100', {
      data: {
        id: 100,
        league_id: 8,
        season_id: 2025,
        participants: [
          { id: 5, meta: { location: 'home' } },
          { id: 6, meta: { location: 'away' } }
        ]
      }
    });

    const inventory = await buildSportmonksLeagueCaptureInventory({
      captureRoot: root,
      leagueId: 8
    });

    expect(inventory.teamIds).toEqual([5, 6]);
  });

  it('rejects maxSeasons less than 1', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-league-inventory-'));
    await writeRaw(root, 'fixtures.all', '/fixtures', {
      data: [{ id: 100, league_id: 8, season_id: 2025 }]
    });
    await writeRaw(root, 'seasons.all', '/seasons', {
      data: [{ id: 2025, league_id: 8, name: '2025/2026', ending_at: '2026-05-31' }]
    });

    await expect(buildSportmonksLeagueCaptureInventory({
      captureRoot: root,
      leagueId: 8,
      maxSeasons: 0
    })).rejects.toThrow('maxSeasons must be at least 1');
  });
});
