import { describe, expect, it } from 'vitest';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import { readServingMatchStoreSnapshot } from '../apps/api/src/repositories/serving-match-store.js';
import { runBuildServingMatchStoreFromWarehouse } from './build-serving-match-store.js';
import { writeCanonicalWarehouseRun } from './providers/shared/canonical-warehouse.js';

async function appendJsonl(filePath: string, rows: unknown[]): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, rows.map((row) => JSON.stringify(row)).join('\n') + '\n', 'utf8');
}

describe('build-serving-match-store script', () => {
  it('builds app serving partitions from canonical warehouse JSONL', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-serving-cli-'));
    const warehouseRoot = path.join(dataRoot, 'warehouse');
    const observedAt = '2026-07-05T00:00:00.000Z';
    const messages: string[] = [];

    await appendJsonl(path.join(warehouseRoot, 'canonical-matches.jsonl'), [
      {
        matchId: 'match-world-cup-2026-mexico-south-africa',
        competitionId: 'competition-world-cup',
        season: '2026',
        kickoffUtc: '2026-06-11T19:00:00.000Z',
        status: 'scheduled',
        homeTeamId: 'team-mexico',
        awayTeamId: 'team-south-africa',
        scoreHome: null,
        scoreAway: null,
        updatedAt: observedAt
      }
    ]);
    await appendJsonl(path.join(warehouseRoot, 'canonical-teams.jsonl'), [
      { teamId: 'team-mexico', name: 'Mexico', updatedAt: observedAt },
      { teamId: 'team-south-africa', name: 'South Africa', updatedAt: observedAt }
    ]);
    await appendJsonl(path.join(warehouseRoot, 'canonical-competitions.jsonl'), [
      { competitionId: 'competition-world-cup', name: 'FIFA World Cup', type: 'national-team', updatedAt: observedAt }
    ]);
    await appendJsonl(path.join(warehouseRoot, 'match-provider-links.jsonl'), [
      {
        entityType: 'match',
        entityId: 'match-world-cup-2026-mexico-south-africa',
        provider: 'manual-snapshot',
        providerEntityType: 'fixture',
        providerEntityId: '12345',
        confidence: 0.98,
        linkedBy: 'test',
        linkedAt: observedAt
      }
    ]);

    const result = await runBuildServingMatchStoreFromWarehouse({
      dataRoot,
      version: 'v-test',
      now: () => new Date(observedAt),
      log: (message) => messages.push(message)
    });

    expect(result).toEqual({
      version: 'v-test',
      matchCount: 1,
      partitionCount: 2
    });
    expect(messages).toEqual([
      `Built serving match store v-test: 1 matches -> ${path.join(dataRoot, 'serving')}`
    ]);

    const snapshot = await readServingMatchStoreSnapshot(path.join(dataRoot, 'serving'));
    expect(snapshot.snapshotId).toBe('serving-v-test');
    expect(snapshot.sources).toEqual([
      { sourceId: 'manual-snapshot', sourceMatchId: '12345', importedAt: observedAt }
    ]);
    expect(snapshot.matches[0]).toMatchObject({
      id: 'match-world-cup-2026-mexico-south-africa',
      competition: {
        id: 'competition-world-cup',
        name: 'FIFA World Cup',
        type: 'national-team',
        season: '2026'
      },
      homeTeam: { id: 'team-mexico', name: 'Mexico' },
      awayTeam: { id: 'team-south-africa', name: 'South Africa' }
    });

    await fs.rm(dataRoot, { recursive: true, force: true });
  });

  it('builds from an explicit immutable warehouse run and traces it in the serving manifest', async () => {
    const dataRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-serving-cli-run-'));
    const observedAt = '2026-08-01T00:00:00.000Z';
    await writeCanonicalWarehouseRun(dataRoot, 'run-001', {
      matches: [{
        matchId: 'match-run-001', competitionId: 'competition-world-cup', season: '2026',
        kickoffUtc: '2026-06-11T19:00:00.000Z', status: 'scheduled', homeTeamId: 'team-mexico', awayTeamId: 'team-south-africa',
        scoreHome: null, scoreAway: null, updatedAt: observedAt
      }],
      teams: [
        { teamId: 'team-mexico', name: 'Mexico', updatedAt: observedAt },
        { teamId: 'team-south-africa', name: 'South Africa', updatedAt: observedAt }
      ],
      competitions: [{ competitionId: 'competition-world-cup', name: 'FIFA World Cup', type: 'national-team', updatedAt: observedAt }],
      links: [{
        entityType: 'match', entityId: 'match-run-001', provider: 'openfootball', providerEntityType: 'match',
        providerEntityId: 'entry:match-run-001', confidence: 1, linkedBy: 'test', linkedAt: observedAt
      }],
      provenance: []
    });

    await runBuildServingMatchStoreFromWarehouse({
      dataRoot, warehouseRunId: 'run-001', version: 'v-run', now: () => new Date(observedAt), log: () => undefined
    });

    const manifest = JSON.parse(await fs.readFile(path.join(dataRoot, 'serving', 'manifest.json'), 'utf8'));
    expect(manifest.warehouseRunId).toBe('run-001');
    await fs.rm(dataRoot, { recursive: true, force: true });
  });
});
