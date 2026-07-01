import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { updateNationalTeamData } from './update-national-team-data.js';
import { validateLocalMatch } from '../packages/shared/src/contracts/local-match-contracts.js';

describe('update-national-team-data script', () => {
  const mockSeed = {
    sourceBatchId: 'test-batch',
    sources: [
      {
        sourceId: 'openfootball',
        sourceUrl: 'https://github.com/openfootball/worldcup'
      }
    ],
    matches: [
      {
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
        sourceRefs: [
          {
            sourceId: 'openfootball',
            sourceMatchId: '2024/final/spain-england',
            sourceUrl: 'https://github.com/openfootball/euro'
          }
        ]
      },
      {
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
        awayTeam: { id: 'team-safrica', name: 'South Africa' },
        score: { home: null, away: null },
        sourceRefs: [
          {
            sourceId: 'openfootball',
            sourceMatchId: '2026/group-a/mexico-south-africa',
            sourceUrl: 'https://github.com/openfootball/worldcup'
          }
        ]
      }
    ]
  };

  async function createTempSeed(data: unknown): Promise<string> {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-seed-test-'));
    const filePath = path.join(tempDir, 'seed.json');
    await fs.writeFile(filePath, JSON.stringify(data));
    return filePath;
  }

  it('reads seed JSON, normalizes, sorts, and writes output', async () => {
    const tempSeedPath = await createTempSeed(mockSeed);
    const tempOutputPath = path.join(path.dirname(tempSeedPath), 'output.json');

    const testTime = new Date('2026-07-01T12:00:00.000Z');
    const result = await updateNationalTeamData({
      inputPath: tempSeedPath,
      outputPath: tempOutputPath,
      now: () => testTime
    });

    expect(result.matchCount).toBe(2);
    expect(result.snapshotId).toBe('snapshot-test-batch');

    const writtenContent = await fs.readFile(tempOutputPath, 'utf-8');
    const snapshot = JSON.parse(writtenContent);

    expect(snapshot.snapshotId).toBe('snapshot-test-batch');
    expect(snapshot.generatedAt).toBe(testTime.toISOString());
    expect(snapshot.importedAt).toBe(testTime.toISOString());
    expect(snapshot.sources[0].importedAt).toBe(testTime.toISOString());

    // Sorting: scheduled (World Cup 2026) comes before completed (Euro 2024)
    expect(snapshot.matches[0].id).toBe('match-scheduled');
    expect(snapshot.matches[1].id).toBe('match-completed');

    // Each match has updatedAt and sourceRef importedAt populated
    expect(snapshot.matches[0].updatedAt).toBe(testTime.toISOString());
    expect(snapshot.matches[0].sourceRefs[0].importedAt).toBe(testTime.toISOString());

    // Output validates through contract validateLocalMatch
    for (const match of snapshot.matches) {
      expect(validateLocalMatch(match).ok).toBe(true);
    }

    await fs.rm(path.dirname(tempSeedPath), { recursive: true, force: true });
  });

  it('rejects match with in_play status', async () => {
    const invalidSeed = {
      ...mockSeed,
      matches: [
        {
          ...mockSeed.matches[0],
          status: 'in_play'
        }
      ]
    };

    const tempSeedPath = await createTempSeed(invalidSeed);
    const tempOutputPath = path.join(path.dirname(tempSeedPath), 'output.json');

    await expect(updateNationalTeamData({
      inputPath: tempSeedPath,
      outputPath: tempOutputPath
    })).rejects.toThrow('Field "status" cannot be "in_play" in Phase 9');

    await fs.rm(path.dirname(tempSeedPath), { recursive: true, force: true });
  });

  it('rejects club competition type', async () => {
    const invalidSeed = {
      ...mockSeed,
      matches: [
        {
          ...mockSeed.matches[0],
          competition: {
            ...mockSeed.matches[0].competition,
            type: 'club' as unknown as 'national-team'
          }
        }
      ]
    };

    const tempSeedPath = await createTempSeed(invalidSeed);
    const tempOutputPath = path.join(path.dirname(tempSeedPath), 'output.json');

    await expect(updateNationalTeamData({
      inputPath: tempSeedPath,
      outputPath: tempOutputPath
    })).rejects.toThrow('competition.type must be "national-team"');

    await fs.rm(path.dirname(tempSeedPath), { recursive: true, force: true });
  });
});
