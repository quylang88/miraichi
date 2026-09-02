import { describe, expect, it, vi } from 'vitest';
import type { LiveMatchSnapshot, LocalMatch } from '@miraichi/shared';
import { TerminalLiveProjectionRepository } from './terminal-live-projection-repository.js';

const canonical: LocalMatch = {
  id: 'match-1', competition: { id: 'competition-1', name: 'Fixture League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T11:00:00.000Z', status: 'scheduled', homeTeam: { id: 'home', name: 'Home' }, awayTeam: { id: 'away', name: 'Away' },
  score: { home: null, away: null }, sourceRefs: [], updatedAt: '2026-09-02T10:00:00.000Z'
};
const snapshot: LiveMatchSnapshot = {
  schemaVersion: 'miraichi.live-match-snapshot.v1', snapshotId: 'live-1', generatedAt: '2026-09-02T13:00:00.000Z',
  coverage: { kind: 'global-recent-window', upstreamLimit: 50, upstreamCount: 1, mappedCount: 1, publishedCount: 1, terminalCheckCount: 1, retainedTrackedCount: 0 },
  matches: [{
    matchId: canonical.id, competition: { id: 'competition-1', name: 'Fixture League' }, kickoffUtc: canonical.kickoffUtc,
    homeTeam: canonical.homeTeam, awayTeam: canonical.awayTeam, status: 'completed', period: null, elapsedMinute: null,
    score: { home: 2, away: 1 }, sourceRefs: [{ sourceId: 'sportscore', sourceMatchId: 'private-slug', observedAt: '2026-09-02T13:00:00.000Z' }],
    updatedAt: '2026-09-02T13:00:00.000Z'
  }], warnings: []
};

describe('terminal live projection repository', () => {
  it('projects confirmed FT over canonical reads before applying status filters', async () => {
    const base = {
      listMatches: vi.fn(async () => ({ matches: [canonical], snapshot: { warnings: [] } })),
      findById: vi.fn(async () => canonical), getStatus: vi.fn()
    };
    const persistence = { getLiveMatchSnapshot: vi.fn(async () => snapshot) };
    const repository = new TerminalLiveProjectionRepository(base as never, persistence as never, 'owner-primary');

    const completed = await repository.listMatches({ status: 'completed' });
    expect(base.listMatches).toHaveBeenCalledWith({ status: undefined });
    expect(completed.matches[0]).toMatchObject({ status: 'completed', score: { home: 2, away: 1 } });
    expect(completed.matches[0]?.sourceRefs[0]).toMatchObject({ sourceId: 'sportscore', importedAt: snapshot.generatedAt });
    expect(completed.snapshot.warnings).toContain('live_terminal_overlay_applied');

    expect((await repository.listMatches({ status: 'scheduled' })).matches).toEqual([]);
    expect(await repository.findById(canonical.id)).toMatchObject({ status: 'completed', score: { home: 2, away: 1 } });
  });

  it('never projects in-play overlay records into the terminal canonical contract', async () => {
    const base = { listMatches: vi.fn(async () => ({ matches: [canonical], snapshot: { warnings: [] } })), findById: vi.fn(async () => canonical), getStatus: vi.fn() };
    const persistence = { getLiveMatchSnapshot: vi.fn(async () => ({ ...snapshot, matches: [{ ...snapshot.matches[0], status: 'live', score: { home: 1, away: 0 } }] })) };
    const repository = new TerminalLiveProjectionRepository(base as never, persistence as never, 'owner-primary');
    expect((await repository.listMatches()).matches[0]).toEqual(canonical);
  });

  it('rejects completed overlays with a mismatched identity or older evidence', async () => {
    const base = {
      listMatches: vi.fn(async () => ({ matches: [canonical], snapshot: { warnings: [] } })),
      findById: vi.fn(async () => canonical),
      getStatus: vi.fn()
    };
    const persistence = {
      getLiveMatchSnapshot: vi.fn(async () => ({
        ...snapshot,
        matches: [{ ...snapshot.matches[0], homeTeam: { id: 'wrong-home', name: 'Home' } }]
      }))
    };
    const repository = new TerminalLiveProjectionRepository(base as never, persistence as never, 'owner-primary');
    expect((await repository.listMatches()).matches[0]).toEqual(canonical);

    persistence.getLiveMatchSnapshot.mockResolvedValue({
      ...snapshot,
      matches: [{ ...snapshot.matches[0], updatedAt: '2026-09-02T09:00:00.000Z' }]
    });
    expect((await repository.listMatches()).matches[0]).toEqual(canonical);
  });
});
