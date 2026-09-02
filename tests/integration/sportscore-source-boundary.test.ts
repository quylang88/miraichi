import { describe, expect, it, vi } from 'vitest';
import type { LocalMatch } from '../../packages/shared/src/index.js';
import { createMemoryCloudPersistenceAdapter } from '../../apps/api/src/persistence/memory-cloud-persistence-adapter.js';
import { SportScoreWidgetClient } from '../../apps/api/src/live/sportscore-widget-client.js';
import { LiveRefreshCoordinator } from '../../apps/api/src/live/live-refresh-coordinator.js';
import { handleLiveMatches } from '../../apps/api/src/routes/live-matches.js';

const canonicalMatch: LocalMatch = {
  id: 'match-arsenal-liverpool',
  competition: { id: 'eng-premier-league', name: 'Premier League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T11:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'arsenal', name: 'Arsenal' },
  awayTeam: { id: 'liverpool', name: 'Liverpool' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: '2026-09-02T10:00:00.000Z'
};

function response(payload: unknown): Response {
  return { ok: true, status: 200, headers: new Headers(), text: async () => JSON.stringify(payload) } as Response;
}

function httpResponse() {
  return {
    statusCode: 0,
    body: '',
    writeHead(code: number) { this.statusCode = code; },
    end(body?: unknown) { this.body = String(body ?? ''); },
    setHeader() {}
  };
}

describe('SportScore widget live integration boundary', () => {
  it('flows only widget live data through canonical resolution, durable storage, and sanitized owner API', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL) => response({
      matches: [{
        home: 'Arsenal', away: 'Liverpool', home_score: 2, away_score: 1,
        status: 'second_half', status_text: "67'", time: canonicalMatch.kickoffUtc,
        slug: 'arsenal-vs-liverpool'
      }]
    }));
    const source = new SportScoreWidgetClient({ fetcher });
    const persistence = createMemoryCloudPersistenceAdapter({ now: () => '2026-09-02T12:00:00.000Z' });
    const repository = { listMatches: async () => ({ matches: [canonicalMatch], snapshot: {} }) };
    const coordinator = new LiveRefreshCoordinator({
      ownerProfileId: 'owner-primary', persistence, source, repository: repository as never,
      now: () => '2026-09-02T12:00:00.000Z', createLeaseId: () => 'integration-lease'
    });

    expect((await coordinator.refresh('visible')).outcome).toBe('refreshed');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe('https://sportscore.com/api/widget/matches/?sport=football&limit=50');

    const out = httpResponse();
    await handleLiveMatches({ method: 'GET', url: '/api/v1/live', headers: {} } as never, out as never, { coordinator });
    expect(out.statusCode).toBe(200);
    const payload = JSON.parse(out.body);
    expect(payload.snapshot.matches[0]).toMatchObject({
      matchId: canonicalMatch.id, status: 'live', elapsedMinute: 67, score: { home: 2, away: 1 }
    });
    expect(out.body).not.toContain('arsenal-vs-liverpool');
    expect(out.body).not.toContain('sourceUrl');
    expect(out.body).not.toContain('leaseId');
  });
});
