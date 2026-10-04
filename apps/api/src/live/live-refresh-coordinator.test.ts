import { describe, expect, it, vi } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import type { LocalMatch } from '@miraichi/shared';
import { LiveRefreshCoordinator } from './live-refresh-coordinator.js';

const canonical: LocalMatch = {
  id: 'match-arsenal-liverpool', competition: { id: 'fixture-league', name: 'Fixture League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T11:00:00.000Z', status: 'scheduled', homeTeam: { id: 'arsenal', name: 'Arsenal' }, awayTeam: { id: 'liverpool', name: 'Liverpool' },
  score: { home: null, away: null }, sourceRefs: [], updatedAt: '2026-09-02T10:00:00.000Z'
};
const rawLive = { home: 'Arsenal', away: 'Liverpool', home_score: 1, away_score: 0, status: 'live', status_text: "20'", time: canonical.kickoffUtc, slug: 'arsenal-vs-liverpool' };

function setup(nowValue = '2026-09-02T12:00:00.000Z') {
  let now = nowValue;
  const persistence = createMemoryCloudPersistenceAdapter({ now: () => now });
  const source = { listMatches: vi.fn(async () => ({ matches: [rawLive] })), getMatch: vi.fn(async () => ({ match: { ...rawLive, status: 'finished', status_text: 'FT', home_score: 2 } })) };
  const repository = { listMatches: vi.fn(async () => ({ matches: [canonical], snapshot: {} })) };
  const coordinator = new LiveRefreshCoordinator({ ownerProfileId: 'owner-primary', persistence, source, repository: repository as never, now: () => now, createLeaseId: () => `lease-${now}` });
  return { persistence, source, repository, coordinator, setNow(value: string) { now = value; } };
}

describe('live refresh coordinator', () => {
  it('refreshes background every five minutes and applies cooldown after failed manual attempts', async () => {
    const ctx = setup();
    await ctx.coordinator.refresh('visible');
    ctx.setNow('2026-09-02T12:04:00.000Z');
    expect((await ctx.coordinator.refresh('background')).outcome).toBe('fresh');
    ctx.setNow('2026-09-02T12:05:00.000Z');
    expect((await ctx.coordinator.refresh('background' as never)).outcome).toBe('refreshed');
    ctx.setNow('2026-09-02T12:06:00.000Z');
    ctx.source.listMatches.mockRejectedValue(new Error('offline'));
    expect((await ctx.coordinator.refresh('manual')).outcome).toBe('failed');
    ctx.setNow('2026-09-02T12:06:30.000Z');
    await ctx.coordinator.refresh('manual');
    expect(ctx.source.listMatches).toHaveBeenCalledTimes(3);
  });
  it('enforces a shared manual floor atomically at lease acquisition', async () => {
    const ctx = setup();
    await ctx.coordinator.refresh('manual');
    expect(await ctx.persistence.acquireLiveRefreshLease('owner-primary', {
      leaseId: 'stale-reader', reason: 'manual', acquiredAt: '2026-09-02T12:00:30.000Z', expiresAt: '2026-09-02T12:01:30.000Z'
    })).toBe(false);
  });
  it('shares freshness policy and the durable lease across visible/manual/hourly reasons', async () => {
    const ctx = setup();
    expect((await ctx.coordinator.refresh('visible')).outcome).toBe('refreshed');
    expect(ctx.repository.listMatches).toHaveBeenCalledWith({ date: '2026-09-02', timezone: 'UTC' });
    ctx.setNow('2026-09-02T12:00:30.000Z');
    expect((await ctx.coordinator.refresh('manual')).outcome).toBe('fresh');
    ctx.setNow('2026-09-02T12:04:59.000Z');
    expect((await ctx.coordinator.refresh('visible')).outcome).toBe('fresh');
    ctx.setNow('2026-09-02T12:59:59.000Z');
    expect((await ctx.coordinator.refresh('hourly')).outcome).toBe('fresh');
    expect(ctx.source.listMatches).toHaveBeenCalledTimes(1);
  });

  it('checks a disappeared tracked live slug before marking terminal and keeps checks bounded', async () => {
    const ctx = setup();
    await ctx.coordinator.refresh('visible');
    ctx.source.listMatches.mockResolvedValue({ matches: [] });
    ctx.setNow('2026-09-02T12:05:00.000Z');
    const result = await ctx.coordinator.refresh('visible');
    expect(ctx.source.getMatch).toHaveBeenCalledWith('arsenal-vs-liverpool');
    expect(result.snapshot?.matches[0]).toMatchObject({ status: 'completed', score: { home: 2, away: 0 } });
    expect(ctx.source.getMatch).toHaveBeenCalledTimes(1);
  });

  it('preserves last-good overlay and records a sanitized state when the provider fails', async () => {
    const ctx = setup();
    const first = await ctx.coordinator.refresh('visible');
    ctx.setNow('2026-09-02T12:05:00.000Z');
    ctx.source.listMatches.mockRejectedValue(new Error('upstream secret response'));
    const failed = await ctx.coordinator.refresh('visible');
    expect(failed.outcome).toBe('failed');
    expect(failed.snapshot).toEqual(first.snapshot);
    expect(await ctx.persistence.getLiveRefreshState('owner-primary')).toMatchObject({ status: 'failed', lastErrorCode: 'internal_error' });
  });

  it('never treats disappearance as FT and caps tracked terminal checks at five requests', async () => {
    const now = '2026-09-02T12:05:00.000Z';
    const persistence = createMemoryCloudPersistenceAdapter({ now: () => now });
    const matches = Array.from({ length: 6 }, (_, index) => ({
      matchId: `match-${index}`,
      competition: { id: 'competition', name: 'Competition' },
      kickoffUtc: '2026-09-02T11:00:00.000Z',
      homeTeam: { id: `home-${index}`, name: `Home ${index}` },
      awayTeam: { id: `away-${index}`, name: `Away ${index}` },
      status: 'live' as const,
      period: 'second_half' as const,
      elapsedMinute: 70,
      score: { home: 1, away: 0 },
      sourceRefs: [{ sourceId: 'sportscore' as const, sourceMatchId: `home-${index}-vs-away-${index}`, observedAt: '2026-09-02T11:59:00.000Z' }],
      updatedAt: '2026-09-02T11:59:00.000Z'
    }));
    await persistence.acquireLiveRefreshLease('owner-primary', { leaseId: 'seed', reason: 'visible', acquiredAt: '2026-09-02T11:59:00.000Z', expiresAt: '2026-09-02T12:01:00.000Z' });
    await persistence.finishLiveRefresh('owner-primary', {
      leaseId: 'seed', outcome: 'succeeded', completedAt: '2026-09-02T11:59:30.000Z',
      snapshot: {
        schemaVersion: 'miraichi.live-match-snapshot.v1', snapshotId: 'seed', generatedAt: '2026-09-02T11:59:00.000Z',
        coverage: { kind: 'global-recent-window', upstreamLimit: 50, upstreamCount: 6, mappedCount: 6, publishedCount: 6, terminalCheckCount: 0, retainedTrackedCount: 0 },
        matches, warnings: []
      }
    });
    const source = { listMatches: vi.fn(async () => ({ matches: [] })), getMatch: vi.fn(async () => { throw new Error('not found'); }) };
    const repository = { listMatches: vi.fn(async () => ({ matches: [], snapshot: {} })) };
    const coordinator = new LiveRefreshCoordinator({ ownerProfileId: 'owner-primary', persistence, source, repository: repository as never, now: () => now, createLeaseId: () => 'refresh' });

    const result = await coordinator.refresh('visible');
    expect(source.getMatch).toHaveBeenCalledTimes(5);
    expect(result.snapshot?.matches).toHaveLength(6);
    expect(result.snapshot?.matches.every((match) => match.status === 'live')).toBe(true);
    expect(result.snapshot?.warnings).toContain('terminal_check_budget_exhausted:1');
  });
});
