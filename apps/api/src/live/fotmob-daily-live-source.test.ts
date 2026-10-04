import { describe, expect, it, vi } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { FotMobDailyLiveSource } from './fotmob-daily-live-source.js';
import { LiveRefreshCoordinator } from './live-refresh-coordinator.js';
import { FotMobAccessBlockedError } from '../../../worker/src/sources/fotmob/fotmob-season-client.js';
import type { LocalMatch } from '@miraichi/shared';
import { liveCanonical, dailyLiveFixture } from '../../../../tests/fixtures/fotmob-live.js';

function setup(start = '2026-09-12T14:20:00Z', count = 60) {
  let now = start;
  const matches: LocalMatch[] = Array.from({ length: count }, (_, i) => ({
    id: `match-${i}`, competition: { ...liveCanonical.competition },
    homeTeam: { id: `home-${i}`, name: `Home ${i}` }, awayTeam: { id: `away-${i}`, name: `Away ${i}` },
    kickoffUtc: '2026-09-12T14:00:00Z', status: 'scheduled', score: { home: null, away: null }, updatedAt: '2026-09-12T00:00:00Z',
    sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: String(1000 + i), importedAt: '2026-09-12T00:00:00Z' }]
  }));
  const payload = { date: '20260912', leagues: [{ id: dailyLiveFixture.leagues[0]!.id, matches: matches.map((m, i) => ({ id: 1000 + i,
    home: { name: m.homeTeam.name, score: 1 }, away: { name: m.awayTeam.name, score: 0 },
    status: { utcTime: m.kickoffUtc, started: true, finished: false, liveTime: { short: '20’', basePeriod: 45 } } })) }] };
  const daily = { getDailyMatches: vi.fn(async (request: { date: string }) => ({ status: 'modified' as const, rawText: '{}', payload: { ...payload, date: request.date.replaceAll('-', '') } })) };
  const repository = { listMatches: vi.fn(async () => ({ matches, snapshot: {} })) };
  const persistence = createMemoryCloudPersistenceAdapter({ now: () => now });
  const coordinator = new LiveRefreshCoordinator({ ownerProfileId: 'owner-primary', persistence,
    repository: repository as never, source: new FotMobDailyLiveSource(daily), now: () => now });
  return { coordinator, daily, payload, matches, persistence, setNow: (value: string) => { now = value; } };
}
describe('daily LIVE source through durable refresh', () => {
  it('discovers more than 50 current matches while leaving canonical fixtures unchanged', async () => {
    const ctx = setup(); const result = await ctx.coordinator.refresh('manual');
    expect(result.outcome).toBe('refreshed'); expect(result.snapshot?.matches).toHaveLength(60);
    expect(result.snapshot?.coverage).toMatchObject({ kind: 'registered-daily-window', upstreamCount: 60 });
    expect(ctx.matches.every(m => m.status === 'scheduled' && m.score.home === null)).toBe(true);
    ctx.setNow('2026-09-12T14:20:30Z'); await ctx.coordinator.refresh('manual');
    expect(ctx.daily.getDailyMatches).toHaveBeenCalledTimes(1);
    ctx.setNow('2026-09-12T14:25:00Z'); await ctx.coordinator.refresh('visible');
    expect(ctx.daily.getDailyMatches).toHaveBeenCalledTimes(2);
  });
  it('includes yesterday across UTC midnight with at most two date requests', async () => {
    const ctx = setup('2026-09-13T00:10:00Z', 1); await ctx.coordinator.refresh('manual');
    expect(ctx.daily.getDailyMatches.mock.calls.map(([r]) => r.date)).toEqual(['2026-09-12', '2026-09-13']);
  });
  it('retains a missing observation briefly without manufacturing FT, then removes stale LIVE', async () => {
    const ctx = setup(undefined, 1); const first = await ctx.coordinator.refresh('manual');
    ctx.payload.leagues[0]!.matches = [];
    ctx.setNow('2026-09-12T14:25:00Z'); const missing = await ctx.coordinator.refresh('visible');
    expect(missing.snapshot?.matches).toEqual(first.snapshot?.matches);
    expect(missing.snapshot?.warnings).toContain('missing_live_observations:1');
    ctx.setNow('2026-09-12T14:31:00Z'); const expired = await ctx.coordinator.refresh('visible');
    expect(expired.snapshot?.matches).toEqual([]);
    expect(expired.snapshot?.warnings).toContain('expired_live_observations:1');
  });
  it('preserves the last good snapshot and stops immediately after an access block', async () => {
    const ctx = setup(undefined, 1); const first = await ctx.coordinator.refresh('manual');
    ctx.setNow('2026-09-13T00:10:00Z'); ctx.daily.getDailyMatches.mockRejectedValue(new FotMobAccessBlockedError(429));
    const failed = await ctx.coordinator.refresh('manual');
    expect(failed.outcome).toBe('failed'); expect(failed.snapshot).toEqual(first.snapshot);
    expect(failed.state?.lastErrorCode).toBe('upstream_blocked');
    expect(ctx.daily.getDailyMatches).toHaveBeenCalledTimes(2);
  });
  it('uses an actual terminal observation to remove a match from active LIVE', async () => {
    const ctx = setup(undefined, 1); await ctx.coordinator.refresh('manual');
    ctx.payload.leagues[0]!.matches[0]!.status.finished = true;
    ctx.setNow('2026-09-12T14:25:00Z'); const final = await ctx.coordinator.refresh('visible');
    expect(final.snapshot?.matches[0]).toMatchObject({ status: 'completed', period: null, elapsedMinute: null });
  });
});
