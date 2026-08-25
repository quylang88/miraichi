import { describe, expect, it } from 'vitest';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import { join } from 'node:path';
import type {
  CanonicalCompetition,
  CanonicalMatch,
  CanonicalTeam,
  FieldProvenance,
  ProviderLink
} from '@miraichi/shared';
import {
  writeCanonicalWarehouseRun,
  type CanonicalWarehouseSnapshot
} from '../../../../../scripts/providers/shared/canonical-warehouse.js';
import { buildServingMatchStore } from '../../../../api/src/repositories/serving-match-store.js';
import {
  loadLastGoodWarehouseSnapshot,
  mergeCanonicalWarehouseSnapshots
} from './api-football-snapshot-merge.js';

function createMatch(overrides: Partial<CanonicalMatch> = {}): CanonicalMatch {
  return {
    matchId: 'match-1',
    competitionId: 'comp-alpha',
    season: '2026',
    kickoffUtc: '2026-08-25T19:00:00.000Z',
    status: 'scheduled',
    homeTeamId: 'team-alpha',
    awayTeamId: 'team-beta',
    scoreHome: null,
    scoreAway: null,
    updatedAt: '2026-08-25T12:00:00.000Z',
    ...overrides
  };
}

function createTeam(overrides: Partial<CanonicalTeam> = {}): CanonicalTeam {
  return {
    teamId: 'team-alpha',
    name: 'Team Alpha',
    countryCode: 'XX-ABC',
    updatedAt: '2026-08-25T12:00:00.000Z',
    ...overrides
  };
}

function createCompetition(overrides: Partial<CanonicalCompetition> = {}): CanonicalCompetition {
  return {
    competitionId: 'comp-alpha',
    name: 'Competition Alpha',
    type: 'club',
    updatedAt: '2026-08-25T12:00:00.000Z',
    ...overrides
  };
}

function createLink(overrides: Partial<ProviderLink> = {}): ProviderLink {
  return {
    entityType: 'match',
    entityId: 'match-1',
    provider: 'api-football',
    providerEntityType: 'fixture',
    providerEntityId: '1001',
    confidence: 1,
    linkedBy: 'api-football-adapter',
    linkedAt: '2026-08-25T12:00:00.000Z',
    ...overrides
  };
}

function createProvenance(overrides: Partial<FieldProvenance> = {}): FieldProvenance {
  return {
    entityType: 'match',
    entityId: 'match-1',
    fieldPath: 'status',
    provider: 'api-football',
    providerEntityId: '1001',
    observedAt: '2026-08-25T12:00:00.000Z',
    confidence: 1,
    valueHash: 'a'.repeat(64),
    ...overrides
  };
}

describe('mergeCanonicalWarehouseSnapshots', () => {
  it('combines disjoint base and delta snapshots preserving all records', () => {
    const base: CanonicalWarehouseSnapshot = {
      matches: [createMatch({ matchId: 'match-base', season: '2024' })],
      teams: [createTeam({ teamId: 'team-base', name: 'Base Team' })],
      competitions: [createCompetition({ competitionId: 'comp-base', name: 'Base Comp' })],
      links: [createLink({ entityId: 'match-base', providerEntityId: '100' })],
      provenance: [createProvenance({ entityId: 'match-base', providerEntityId: '100' })]
    };

    const delta: CanonicalWarehouseSnapshot = {
      matches: [createMatch({ matchId: 'match-delta', season: '2026' })],
      teams: [createTeam({ teamId: 'team-delta', name: 'Delta Team' })],
      competitions: [createCompetition({ competitionId: 'comp-delta', name: 'Delta Comp' })],
      links: [createLink({ entityId: 'match-delta', providerEntityId: '200' })],
      provenance: [createProvenance({ entityId: 'match-delta', providerEntityId: '200' })]
    };

    const merged = mergeCanonicalWarehouseSnapshots(base, delta);

    expect(merged.matches).toHaveLength(2);
    expect(merged.matches.map((m) => m.matchId).sort()).toEqual(['match-base', 'match-delta']);
    expect(merged.teams).toHaveLength(2);
    expect(merged.competitions).toHaveLength(2);
    expect(merged.links).toHaveLength(2);
    expect(merged.provenance).toHaveLength(2);
  });

  it('updates a scheduled match to completed with scores when delta finishes match', () => {
    const base: CanonicalWarehouseSnapshot = {
      matches: [createMatch({ matchId: 'match-1', status: 'scheduled', scoreHome: null, scoreAway: null })],
      teams: [createTeam()],
      competitions: [createCompetition()],
      links: [createLink()],
      provenance: [createProvenance()]
    };

    const delta: CanonicalWarehouseSnapshot = {
      matches: [
        createMatch({
          matchId: 'match-1',
          status: 'completed',
          scoreHome: 2,
          scoreAway: 1,
          updatedAt: '2026-08-25T21:00:00.000Z'
        })
      ],
      teams: [createTeam()],
      competitions: [createCompetition()],
      links: [createLink({ linkedAt: '2026-08-25T21:00:00.000Z' })],
      provenance: [createProvenance({ observedAt: '2026-08-25T21:00:00.000Z' })]
    };

    const merged = mergeCanonicalWarehouseSnapshots(base, delta);

    expect(merged.matches).toHaveLength(1);
    expect(merged.matches[0]?.status).toBe('completed');
    expect(merged.matches[0]?.scoreHome).toBe(2);
    expect(merged.matches[0]?.scoreAway).toBe(1);
    expect(merged.matches[0]?.updatedAt).toBe('2026-08-25T21:00:00.000Z');
  });

  it('prevents a completed match from regressing to scheduled even if delta has newer timestamp', () => {
    const base: CanonicalWarehouseSnapshot = {
      matches: [
        createMatch({
          matchId: 'match-completed',
          status: 'completed',
          scoreHome: 3,
          scoreAway: 0,
          updatedAt: '2026-08-25T21:00:00.000Z'
        })
      ],
      teams: [createTeam()],
      competitions: [createCompetition()],
      links: [createLink({ entityId: 'match-completed' })],
      provenance: [createProvenance({ entityId: 'match-completed' })]
    };

    const delta: CanonicalWarehouseSnapshot = {
      matches: [
        createMatch({
          matchId: 'match-completed',
          status: 'scheduled',
          scoreHome: null,
          scoreAway: null,
          updatedAt: '2026-08-25T22:00:00.000Z'
        })
      ],
      teams: [createTeam()],
      competitions: [createCompetition()],
      links: [createLink({ entityId: 'match-completed', linkedAt: '2026-08-25T22:00:00.000Z' })],
      provenance: [createProvenance({ entityId: 'match-completed', observedAt: '2026-08-25T22:00:00.000Z' })]
    };

    const merged = mergeCanonicalWarehouseSnapshots(base, delta);

    expect(merged.matches).toHaveLength(1);
    expect(merged.matches[0]?.status).toBe('completed');
    expect(merged.matches[0]?.scoreHome).toBe(3);
    expect(merged.matches[0]?.scoreAway).toBe(0);
    expect(merged.matches[0]?.updatedAt).toBe('2026-08-25T22:00:00.000Z');
    expect(merged.provenance.find((item) => item.fieldPath === 'status')?.observedAt).toBe(
      '2026-08-25T12:00:00.000Z'
    );
  });

  it('merges teams, competitions, provider links, and provenance by canonical compound key', () => {
    const base: CanonicalWarehouseSnapshot = {
      matches: [],
      teams: [createTeam({ teamId: 'team-1', name: 'Alpha Team', updatedAt: '2026-08-01T00:00:00.000Z' })],
      competitions: [createCompetition({ competitionId: 'comp-1', name: 'Mock League', updatedAt: '2026-08-01T00:00:00.000Z' })],
      links: [createLink({ entityId: 'match-1', providerEntityId: '1001', linkedAt: '2026-08-01T00:00:00.000Z' })],
      provenance: [createProvenance({ entityId: 'match-1', fieldPath: 'status', observedAt: '2026-08-01T00:00:00.000Z' })]
    };

    const delta: CanonicalWarehouseSnapshot = {
      matches: [],
      teams: [createTeam({ teamId: 'team-1', name: 'Alpha Team Updated', updatedAt: '2026-08-25T00:00:00.000Z' })],
      competitions: [createCompetition({ competitionId: 'comp-1', name: 'Mock League Updated', updatedAt: '2026-08-25T00:00:00.000Z' })],
      links: [createLink({ entityId: 'match-1', providerEntityId: '1001', linkedAt: '2026-08-25T00:00:00.000Z' })],
      provenance: [createProvenance({ entityId: 'match-1', fieldPath: 'status', observedAt: '2026-08-25T00:00:00.000Z' })]
    };

    const merged = mergeCanonicalWarehouseSnapshots(base, delta);

    expect(merged.teams).toHaveLength(1);
    expect(merged.teams[0]?.name).toBe('Alpha Team Updated');
    expect(merged.competitions).toHaveLength(1);
    expect(merged.competitions[0]?.name).toBe('Mock League Updated');
    expect(merged.links).toHaveLength(1);
    expect(merged.links[0]?.linkedAt).toBe('2026-08-25T00:00:00.000Z');
    expect(merged.provenance).toHaveLength(1);
    expect(merged.provenance[0]?.observedAt).toBe('2026-08-25T00:00:00.000Z');
  });
});

describe('loadLastGoodWarehouseSnapshot', () => {
  it('returns an empty snapshot when serving store manifest is absent', async () => {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-merge-test-'));
    try {
      const snapshot = await loadLastGoodWarehouseSnapshot(tempDir);
      expect(snapshot).toEqual({
        matches: [],
        teams: [],
        competitions: [],
        links: [],
        provenance: []
      });
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('loads the warehouse run referenced in the serving manifest', async () => {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-merge-test-'));
    try {
      const initialSnapshot: CanonicalWarehouseSnapshot = {
        matches: [createMatch({ matchId: 'match-persisted' })],
        teams: [createTeam({ teamId: 'team-alpha' })],
        competitions: [createCompetition({ competitionId: 'comp-alpha' })],
        links: [createLink({ entityId: 'match-persisted' })],
        provenance: [createProvenance({ entityId: 'match-persisted' })]
      };

      const runId = 'run-persisted-001';
      await writeCanonicalWarehouseRun(tempDir, runId, initialSnapshot);

      const servingRoot = join(tempDir, 'serving');
      await buildServingMatchStore({
        servingRoot,
        version: 'v-1',
        snapshotId: 'snap-1',
        generatedAt: '2026-08-25T12:00:00.000Z',
        importedAt: '2026-08-25T12:00:00.000Z',
        sources: [{ sourceId: 'api-football', importedAt: '2026-08-25T12:00:00.000Z' }],
        matches: [],
        warehouseRunId: runId
      });

      const loaded = await loadLastGoodWarehouseSnapshot(tempDir);
      expect(loaded.matches).toHaveLength(1);
      expect(loaded.matches[0]?.matchId).toBe('match-persisted');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('fails closed when manifest references a missing or corrupt warehouse run', async () => {
    const tempDir = await fs.mkdtemp(join(os.tmpdir(), 'miraichi-merge-test-'));
    try {
      const servingRoot = join(tempDir, 'serving');
      await buildServingMatchStore({
        servingRoot,
        version: 'v-1',
        snapshotId: 'snap-1',
        generatedAt: '2026-08-25T12:00:00.000Z',
        importedAt: '2026-08-25T12:00:00.000Z',
        sources: [{ sourceId: 'api-football', importedAt: '2026-08-25T12:00:00.000Z' }],
        matches: [],
        warehouseRunId: 'run-missing'
      });

      await expect(loadLastGoodWarehouseSnapshot(tempDir)).rejects.toThrow('Canonical warehouse run does not exist');
    } finally {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });
});
