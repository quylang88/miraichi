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
});
