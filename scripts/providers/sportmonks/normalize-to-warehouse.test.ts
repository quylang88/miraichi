import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPayloadHash, writeRawProviderPayload } from '../shared/raw-cache.js';
import {
  normalizeSportmonksFixtureToWarehouseRecords,
  normalizeSportmonksRawCaptureToWarehouse
} from './normalize-to-warehouse.js';

const observedAt = '2026-07-04T00:00:00.000Z';

describe('sportmonks warehouse normalization', () => {
  it('normalizes completed national-team fixtures into provider-neutral warehouse records', () => {
    const result = normalizeSportmonksFixtureToWarehouseRecords({
      id: 19032598,
      league_id: 1326,
      season_id: 22842,
      starting_at: '2024-07-14 19:00:00',
      state_id: 5,
      league: { id: 1326, name: 'European Championship' },
      season: { id: 22842, name: '2024' },
      stage: { id: 1, name: 'Final' },
      venue: { id: 10, name: 'Olympiastadion Berlin' },
      participants: [
        { id: 18710, name: 'Spain', meta: { location: 'home' } },
        { id: 18645, name: 'England', meta: { location: 'away' } }
      ],
      scores: [
        { participant_id: 18645, score: { goals: 1, participant: 'away' }, description: 'CURRENT' },
        { participant_id: 18710, score: { goals: 2, participant: 'home' }, description: 'CURRENT' }
      ],
      odds: [{ id: 1 }],
      predictions: [{ id: 2 }],
      xGFixture: { home: 1.4, away: 0.8 }
    }, observedAt);

    expect(result.status).toBe('normalized');
    if (result.status !== 'normalized') {
      throw new Error(`Expected normalized fixture, got ${result.reason}`);
    }

    expect(result.match).toMatchObject({
      matchId: 'match-20240714-spain-england',
      competitionId: 'competition-european-championship',
      season: '2024',
      kickoffUtc: '2024-07-14T19:00:00.000Z',
      status: 'completed',
      homeTeamId: 'team-spain',
      awayTeamId: 'team-england',
      scoreHome: 2,
      scoreAway: 1,
      venueId: 'venue-olympiastadion-berlin',
      stage: 'Final'
    });
    expect(result.teams).toEqual([
      { teamId: 'team-spain', name: 'Spain', updatedAt: observedAt },
      { teamId: 'team-england', name: 'England', updatedAt: observedAt }
    ]);
    expect(result.competition).toEqual({
      competitionId: 'competition-european-championship',
      name: 'European Championship',
      type: 'national-team',
      updatedAt: observedAt
    });
    expect(result.links).toEqual(expect.arrayContaining([
      expect.objectContaining({
        entityType: 'match',
        entityId: 'match-20240714-spain-england',
        provider: 'sportmonks',
        providerEntityType: 'fixture',
        providerEntityId: '19032598'
      }),
      expect.objectContaining({
        entityType: 'team',
        entityId: 'team-spain',
        providerEntityType: 'team',
        providerEntityId: '18710'
      })
    ]));
    expect(result.provenance).toEqual(expect.arrayContaining([
      expect.objectContaining({ fieldPath: 'kickoffUtc', providerEntityId: '19032598' }),
      expect.objectContaining({ fieldPath: 'scoreHome', providerEntityId: '19032598' }),
      expect.objectContaining({ fieldPath: 'scoreAway', providerEntityId: '19032598' })
    ]));
    expect(JSON.stringify(result)).not.toContain('predictions');
    expect(JSON.stringify(result)).not.toContain('xGFixture');
    expect(JSON.stringify(result)).not.toContain('odds');
  });

  it('skips club competitions instead of marking them as national-team competitions', () => {
    const result = normalizeSportmonksFixtureToWarehouseRecords({
      id: 1,
      league_id: 5,
      season_id: 25581,
      starting_at: '2026-07-30 19:00:00',
      state_id: 1,
      league: { id: 5, name: 'Europa League' },
      season: { id: 25581, name: '2026/2027' },
      participants: [
        { id: 10, name: 'Club A', meta: { location: 'home' } },
        { id: 11, name: 'Club B', meta: { location: 'away' } }
      ]
    }, observedAt);

    expect(result).toEqual({
      status: 'skipped',
      reason: 'unsupported_competition'
    });
  });

  it('writes normalized enriched fixture raw captures into warehouse jsonl files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'miraichi-sportmonks-normalize-'));
    const payload = {
      data: {
        id: 19606945,
        league_id: 732,
        season_id: 26618,
        starting_at: '2026-07-03 18:00:00',
        state_id: 1,
        league: { id: 732, name: 'World Cup' },
        season: { id: 26618, name: '2026' },
        stage: { id: 77479086, name: 'Round of 32' },
        venue: { id: 72372, name: 'Dallas Stadium' },
        participants: [
          { id: 18730, name: 'Australia', meta: { location: 'home' } },
          { id: 18546, name: 'Egypt', meta: { location: 'away' } }
        ],
        scores: []
      }
    };

    await writeRawProviderPayload(root, {
      schemaVersion: 'miraichi.provider.raw.v1',
      provider: 'sportmonks',
      endpointKey: 'fixtures.enrichedById',
      urlPath: '/fixtures/19606945',
      query: { include: 'scores;participants;league;season;stage;venue;state' },
      fetchedAt: observedAt,
      payloadHash: createPayloadHash(payload),
      rateLimit: {},
      payload
    });

    const report = await normalizeSportmonksRawCaptureToWarehouse({
      captureRoot: root,
      observedAt
    });

    expect(report).toEqual({ normalized: 1, skipped: 0, failed: 0 });
    expect(await readFile(join(root, 'warehouse', 'canonical-matches.jsonl'), 'utf8')).toContain('match-20260703-australia-egypt');
    expect(await readFile(join(root, 'warehouse', 'canonical-teams.jsonl'), 'utf8')).toContain('team-australia');
    expect(await readFile(join(root, 'warehouse', 'match-provider-links.jsonl'), 'utf8')).toContain('19606945');
    expect(await readFile(join(root, 'warehouse', 'field-provenance.jsonl'), 'utf8')).toContain('kickoffUtc');
  });
});
