import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '../../../packages/shared/src/index.js';
import {
  appendCanonicalWarehouseRecord,
  readCanonicalWarehouseRun,
  resolveCanonicalWarehouseRun,
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from './canonical-warehouse.js';

const observedAt = '2026-08-01T00:00:00.000Z';

function snapshot(): CanonicalWarehouseSnapshot {
  const matches: CanonicalMatch[] = [{
    matchId: 'match-z',
    competitionId: 'eng-premier-league',
    season: '2026-27',
    kickoffUtc: '2026-08-10T12:00:00.000Z',
    status: 'scheduled',
    homeTeamId: 'team-z',
    awayTeamId: 'team-a',
    scoreHome: null,
    scoreAway: null,
    updatedAt: observedAt
  }, {
    matchId: 'match-a',
    competitionId: 'eng-premier-league',
    season: '2026-27',
    kickoffUtc: '2026-08-09T12:00:00.000Z',
    status: 'scheduled',
    homeTeamId: 'team-a',
    awayTeamId: 'team-z',
    scoreHome: null,
    scoreAway: null,
    updatedAt: observedAt
  }];
  const teams: CanonicalTeam[] = [
    { teamId: 'team-z', name: 'Zebra', updatedAt: observedAt },
    { teamId: 'team-a', name: 'Alpha', updatedAt: observedAt }
  ];
  const competitions: CanonicalCompetition[] = [{
    competitionId: 'eng-premier-league', name: 'English Premier League', type: 'club', updatedAt: observedAt
  }];
  const links: ProviderLink[] = [{
    entityType: 'match', entityId: 'match-z', provider: 'openfootball', providerEntityType: 'match',
    providerEntityId: 'entry:match-z', confidence: 1, linkedBy: 'test', linkedAt: observedAt
  }, {
    entityType: 'match', entityId: 'match-a', provider: 'openfootball', providerEntityType: 'match',
    providerEntityId: 'entry:match-a', confidence: 1, linkedBy: 'test', linkedAt: observedAt
  }];
  const provenance: FieldProvenance[] = [{
    entityType: 'match', entityId: 'match-a', fieldPath: 'status', provider: 'openfootball',
    providerEntityId: 'entry:match-a', observedAt, confidence: 1, valueHash: 'a'.repeat(64)
  }];
  return { matches, teams, competitions, links, provenance };
}

describe('appendCanonicalWarehouseRecord', () => {
  it('exports a callable function', () => {
    expect(typeof appendCanonicalWarehouseRecord).toBe('function');
  });
});

describe('immutable canonical warehouse runs', () => {
  it('writes complete, sorted JSONL under a safe immutable run directory', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    const staged = await writeCanonicalWarehouseRun(root, 'run-001', snapshot());

    expect(staged).toBe(join(root, 'warehouse', 'versions', 'run-001'));
    expect(await resolveCanonicalWarehouseRun(root, 'run-001')).toBe(staged);
    expect((await fs.readFile(join(staged, 'canonical-matches.jsonl'), 'utf8')).split('\n')[0]).toContain('match-a');
    await expect(fs.access(join(staged, 'canonical-teams.jsonl'))).resolves.toBeUndefined();
    await expect(fs.access(join(staged, 'canonical-competitions.jsonl'))).resolves.toBeUndefined();
    await expect(fs.access(join(staged, 'match-provider-links.jsonl'))).resolves.toBeUndefined();
    await expect(fs.access(join(staged, 'field-provenance.jsonl'))).resolves.toBeUndefined();
    await expect(fs.access(join(root, 'warehouse', 'current.json'))).rejects.toMatchObject({ code: 'ENOENT' });

    await expect(writeCanonicalWarehouseRun(root, 'run-001', snapshot())).rejects.toThrow('already exists');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('rejects unsafe and missing run identifiers without traversing warehouse versions', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    await expect(resolveCanonicalWarehouseRun(root, '.')).rejects.toThrow('safe run ID');
    await expect(resolveCanonicalWarehouseRun(root, '..')).rejects.toThrow('safe run ID');
    await expect(resolveCanonicalWarehouseRun(root, '../run-001')).rejects.toThrow('safe run ID');
    await expect(resolveCanonicalWarehouseRun(root, 'run/001')).rejects.toThrow('safe run ID');
    await expect(resolveCanonicalWarehouseRun(root, 'run..001')).rejects.toThrow('safe run ID');
    await expect(resolveCanonicalWarehouseRun(root, 'missing-run')).rejects.toThrow('does not exist');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('rejects file and symlink run paths instead of resolving outside warehouse versions', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    const versionsRoot = join(root, 'warehouse', 'versions');
    const outside = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-outside-'));
    await fs.mkdir(versionsRoot, { recursive: true });
    await fs.writeFile(join(versionsRoot, 'run-file'), 'not a directory', 'utf8');
    await fs.symlink(outside, join(versionsRoot, 'run-link'), 'junction');

    await expect(resolveCanonicalWarehouseRun(root, 'run-file')).rejects.toThrow('directory');
    await expect(resolveCanonicalWarehouseRun(root, 'run-link')).rejects.toThrow('directory');
    await fs.rm(root, { recursive: true, force: true });
    await fs.rm(outside, { recursive: true, force: true });
  });

  it('reads back a full canonical warehouse run matching the written snapshot', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    const initialSnapshot = snapshot();
    await writeCanonicalWarehouseRun(root, 'run-read-001', initialSnapshot);

    const loaded = await readCanonicalWarehouseRun(root, 'run-read-001');

    expect(loaded.matches).toHaveLength(initialSnapshot.matches.length);
    expect(loaded.matches.map((m) => m.matchId).sort()).toEqual(initialSnapshot.matches.map((m) => m.matchId).sort());
    expect(loaded.teams).toHaveLength(initialSnapshot.teams.length);
    expect(loaded.competitions).toHaveLength(initialSnapshot.competitions.length);
    expect(loaded.links).toHaveLength(initialSnapshot.links.length);
    expect(loaded.provenance).toHaveLength(initialSnapshot.provenance.length);
    await fs.rm(root, { recursive: true, force: true });
  });

  it('fails safely when reading a non-existent run', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    await expect(readCanonicalWarehouseRun(root, 'non-existent-run')).rejects.toThrow('does not exist');
    await fs.rm(root, { recursive: true, force: true });
  });

  it('fails closed when a referenced run is missing a required collection file', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    try {
      await writeCanonicalWarehouseRun(root, 'run-incomplete-001', snapshot());
      await fs.unlink(join(root, 'warehouse', 'versions', 'run-incomplete-001', 'canonical-teams.jsonl'));

      await expect(readCanonicalWarehouseRun(root, 'run-incomplete-001')).rejects.toThrow(
        'Canonical warehouse run is incomplete'
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it('refuses to write an invalid canonical snapshot', async () => {
    const root = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-warehouse-'));
    try {
      const invalidSnapshot = snapshot();
      invalidSnapshot.provenance[0] = {
        ...invalidSnapshot.provenance[0]!,
        valueHash: 'not-a-sha256'
      };

      await expect(writeCanonicalWarehouseRun(root, 'run-invalid-001', invalidSnapshot)).rejects.toThrow(
        'Canonical warehouse snapshot is invalid'
      );
    } finally {
      await fs.rm(root, { recursive: true, force: true });
    }
  });
});
