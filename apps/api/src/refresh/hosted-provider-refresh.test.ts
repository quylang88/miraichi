import { describe, expect, it, vi } from 'vitest';
import { COMPETITION_SOURCE_REGISTRY } from '@miraichi/config';
import { FotMobAccessBlockedError } from '../../../worker/src/sources/fotmob/fotmob-season-client.js';
import type { HostedProviderStore, ProviderState } from './hosted-provider-store.js';
import type { FotMobSeasonResponse } from '../../../worker/src/sources/fotmob/fotmob-season-client.js';
import type { FotMobDailyResponse } from '../../../worker/src/sources/fotmob/fotmob-daily-client.js';

async function setup() {
  const module = await import('./hosted-provider-refresh.js').catch(() => null);
  expect(module?.HostedProviderRefresh).toBeTypeOf('function');
  if (!module) throw new Error('Hosted provider runner missing');
  let state: ProviderState = { current: {}, dates: {}, matches: {}, circuits: {} };
  let revision = 0;
  const finish = vi.fn<HostedProviderStore['finish']>(async (_lease, next, _deltas) => { state = structuredClone(next); revision++; return null; });
  const store: HostedProviderStore = {
    acquire: vi.fn(async () => ({ id: 'lease', revision, startedAt: '2026-09-09T12:00:00.000Z', state: structuredClone(state) })),
    readMatches: vi.fn(async () => []), finish
  };
  const current = vi.fn(async (request): Promise<FotMobSeasonResponse> => ({ status: 'modified' as const, etag: '"v1"', rawText: '{}', payload: {
    details: { id: request.externalCompetitionId, selectedSeason: request.providerSeason }, fixtures: { allMatches: [] }
  } }));
  const daily = vi.fn(async (): Promise<FotMobDailyResponse> => ({ status: 'not_modified' as const, etag: '"daily"' }));
  let clock = new Date('2026-09-09T12:00:00.000Z');
  const runner = new module.HostedProviderRefresh({ store, registry: COMPETITION_SOURCE_REGISTRY,
    currentClient: { getSeasonMatches: current }, dailyClient: { getDailyMatches: daily },
    now: () => clock, sleep: async () => undefined });
  return { runner, store, finish, current, daily, state: () => state, setClock: (iso: string) => { clock = new Date(iso); } };
}

describe('hosted provider refresh', () => {
  it('caps current requests at nine, persists checkpoints and moves forward in registry order', async () => {
    const test = await setup();
    expect(await test.runner.run('current')).toMatchObject({ outcome: 'refreshed', requests: 9, publications: 0 });
    const first = test.current.mock.calls.map(([request]) => request.externalCompetitionId);
    expect(new Set(first).size).toBe(9);
    await test.runner.run('current');
    expect(test.current.mock.calls.slice(9).every(([request]) => !first.includes(request.externalCompetitionId))).toBe(true);
    expect(Object.keys(test.state().current)).toHaveLength(18);
    expect(test.finish).toHaveBeenCalledTimes(2);
  });
  it('does not call a provider or read matches when another caller holds the lease', async () => {
    const test = await setup();
    vi.mocked(test.store.acquire).mockResolvedValue(null);
    expect(await test.runner.run('current')).toMatchObject({ outcome: 'leased', requests: 0 });
    expect(test.current).not.toHaveBeenCalled();
    expect(test.store.readMatches).not.toHaveBeenCalled();
  });
  it('performs zero terminal requests without a due known match', async () => {
    const test = await setup();
    expect(await test.runner.run('terminal')).toMatchObject({ outcome: 'fresh', requests: 0, publications: 0 });
    expect(test.daily).not.toHaveBeenCalled();
  });
  it('persists access-block circuit across runner invocations and preserves last-good', async () => {
    const test = await setup();
    test.current.mockRejectedValue(new FotMobAccessBlockedError(429));
    expect(await test.runner.run('current')).toMatchObject({ outcome: 'failed', requests: 1, publications: 0 });
    expect(await test.runner.run('current')).toMatchObject({ outcome: 'failed', requests: 0, publications: 0 });
    expect(test.current).toHaveBeenCalledTimes(1);
    expect(test.state().circuits['fotmob-unofficial']).toBeTruthy();
  });
  it('honors the 24h TTL and ETag 304 without publishing', async () => {
    const test = await setup();
    for (let batch = 0; batch < 5; batch++) await test.runner.run('current');
    expect(test.current).toHaveBeenCalledTimes(45);
    expect(await test.runner.run('current')).toMatchObject({ outcome: 'fresh', requests: 0 });
    test.setClock('2026-09-10T12:00:00.000Z');
    test.current.mockResolvedValue({ status: 'not_modified', etag: '"v1"' });
    expect(await test.runner.run('current')).toMatchObject({ outcome: 'refreshed', requests: 9, publications: 0 });
    expect(test.current.mock.calls.at(-1)?.[0].etag).toBe('"v1"');
  });
  it('coalesces due matches, publishes FT only and persists the two-minute due clock', async () => {
    const test = await setup();
    vi.mocked(test.store.readMatches).mockResolvedValue([1, 2].map((id) => ({
      id: `match-${id}`, competition: { id: COMPETITION_SOURCE_REGISTRY[0].competitionId, name: 'Cup', type: 'club', season: '2026-27' },
      kickoffUtc: '2026-09-09T10:00:00.000Z', status: 'scheduled',
      homeTeam: { id: `home-${id}`, name: `Home ${id}` }, awayTeam: { id: `away-${id}`, name: `Away ${id}` },
      score: { home: null, away: null }, updatedAt: '2026-09-09T00:00:00.000Z',
      sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: String(id), importedAt: '2026-09-09T00:00:00.000Z' }]
    })));
    test.daily.mockResolvedValue({ status: 'modified', rawText: '{}', payload: { date: '20260909', leagues: [{
      id: COMPETITION_SOURCE_REGISTRY[0].sourceBindings.result!.externalNumericId!, matches: [
        { id: 1, home: { score: 2 }, away: { score: 1 }, status: { finished: true, scoreStr: '2 - 1' } },
        { id: 2, home: { score: 9 }, away: { score: 8 }, status: { started: true } }
      ]
    }] } });
    await test.runner.run('terminal');
    expect(test.daily).toHaveBeenCalledTimes(1);
    const deltas = test.finish.mock.calls[0]?.[2];
    expect(deltas.flatMap((delta) => delta.matches).map((match) => match.matchId)).toEqual(['match-1']);
    expect(test.state().matches['fotmob-unofficial|match-2']?.nextCheckAt).toBe('2026-09-09T12:02:00.000Z');
    expect(await test.runner.run('terminal')).toMatchObject({ requests: 0 });
  });
});
