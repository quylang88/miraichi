import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
import type { LocalMatch } from '@miraichi/shared';

describe('hosted canonical dependencies', () => {
  it('bundles terminal planning without filesystem or local snapshot dependencies', async () => {
    const result = await build({
      entryPoints: ['apps/worker/src/sources/fotmob/fotmob-terminal-plan.ts'],
      bundle: true, write: false, platform: 'node', format: 'esm', metafile: true
    });
    const imports = Object.values(result.metafile!.inputs).flatMap((input) => input.imports.map((item) => item.path));
    expect(imports.filter((item) => /^(node:)?fs(?:\/|$)/u.test(item))).toEqual([]);
  });
  it('round trips DB match identities and keeps provider locators private through canonical conversion', async () => {
    const bridge = await import('./hosted-canonical.js').catch(() => null);
    expect(bridge?.toCanonicalWarehouse).toBeTypeOf('function');
    if (!bridge) return;
    const match: LocalMatch = {
      id: 'match-one', competition: { id: 'cup-one', name: 'Cup', type: 'national-team', season: '2026' },
      homeTeam: { id: 'team-one', name: 'One' }, awayTeam: { id: 'team-two', name: 'Two' },
      kickoffUtc: '2026-09-09T10:00:00.000Z', status: 'scheduled', score: { home: null, away: null },
      sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: '123', importedAt: '2026-09-09T00:00:00.000Z' }],
      updatedAt: '2026-09-09T00:00:00.000Z'
    };
    expect(bridge.fromCanonicalWarehouse(bridge.toCanonicalWarehouse([match]))).toEqual([match]);
    const base = bridge.toCanonicalWarehouse([match]);
    const changed = bridge.toCanonicalWarehouse([{ ...match, id: 'match-rescheduled', kickoffUtc: '2026-09-10T10:00:00.000Z', updatedAt: '2026-09-09T01:00:00.000Z' }]);
    const merged = bridge.mergeCanonicalWarehouseSnapshots(base, changed);
    expect(merged.matches).toHaveLength(1);
    expect(merged.matches[0]?.matchId).toBe('match-one');
    expect(merged.matches[0]?.kickoffUtc).toBe('2026-09-10T10:00:00.000Z');
  });
});
