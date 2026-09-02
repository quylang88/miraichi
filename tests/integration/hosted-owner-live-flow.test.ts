import { Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import type { LocalDataSnapshotStatus, LocalMatch } from '@miraichi/shared';
import { createOwnerPasswordHash, readOwnerAuthConfig } from '../../apps/api/src/auth/owner-auth.js';
import {
  enforceOwnerSession,
  handleOwnerAuthRoute
} from '../../apps/api/src/auth/owner-auth-boundary.js';
import { LiveRefreshCoordinator } from '../../apps/api/src/live/live-refresh-coordinator.js';
import { createMemoryCloudPersistenceAdapter } from '../../apps/api/src/persistence/memory-cloud-persistence-adapter.js';
import { TerminalLiveProjectionRepository } from '../../apps/api/src/repositories/terminal-live-projection-repository.js';
import { handleLiveMatches } from '../../apps/api/src/routes/live-matches.js';
import { handleMatches } from '../../apps/api/src/routes/matches.js';

function request(method: string, url: string, body = '', headers: Record<string, string> = {}) {
  const req = Readable.from(body ? [body] : []) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = url;
  req.headers = headers;
  return req;
}

function response() {
  return {
    statusCode: 0,
    headers: {} as Record<string, string | number | readonly string[]>,
    body: '',
    setHeader(name: string, value: string | number | readonly string[]) { this.headers[name] = value; },
    writeHead(code: number, headers?: Record<string, string | number | readonly string[]>) {
      this.statusCode = code;
      Object.assign(this.headers, headers ?? {});
    },
    end(body?: unknown) { this.body = String(body ?? ''); }
  };
}

const canonical: LocalMatch = {
  id: 'match-arsenal-liverpool',
  competition: { id: 'fixture-league', name: 'Fixture League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-02T11:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'arsenal', name: 'Arsenal' },
  awayTeam: { id: 'liverpool', name: 'Liverpool' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: '2026-09-02T10:00:00.000Z'
};

const snapshotStatus: LocalDataSnapshotStatus = {
  snapshotId: 'canonical-current',
  generatedAt: '2026-09-02T10:00:00.000Z',
  importedAt: '2026-09-02T10:00:00.000Z',
  matchCount: 1,
  competitions: [{ id: 'fixture-league', name: 'Fixture League', seasons: ['2026-27'], matchCount: 1 }],
  sources: [],
  freshness: 'fresh',
  warnings: []
};

describe('hosted owner live operation', () => {
  it('authenticates, refreshes live, confirms FT, and projects the score without leaking provider locators', async () => {
    let now = '2026-09-02T12:00:00.000Z';
    const authConfig = readOwnerAuthConfig({
      APP_ENV: 'production',
      MIRAICHI_OWNER_PASSWORD_HASH: await createOwnerPasswordHash('correct horse battery staple'),
      MIRAICHI_SESSION_SECRET: 'session-secret-with-at-least-thirty-two-characters'
    });
    const login = response();
    await handleOwnerAuthRoute(
      request('POST', '/api/v1/auth/login', JSON.stringify({ password: 'correct horse battery staple' }), { 'content-type': 'application/json' }) as never,
      login as never,
      authConfig,
      Date.parse(now)
    );
    const cookie = String(login.headers['Set-Cookie']).split(';')[0]!;
    expect(login.statusCode).toBe(204);
    expect(enforceOwnerSession(
      request('POST', '/api/v1/live/refresh?reason=visible', '', { cookie }) as never,
      response() as never,
      authConfig,
      Date.parse(now)
    )).toBe('continue');

    const persistence = createMemoryCloudPersistenceAdapter({ now: () => now });
    const canonicalRepository = {
      listMatches: vi.fn(async () => ({ matches: [canonical], snapshot: snapshotStatus })),
      findById: vi.fn(async (id: string) => id === canonical.id ? canonical : null),
      getStatus: vi.fn(async () => snapshotStatus)
    };
    const source = {
      listMatches: vi.fn(async () => ({ matches: [{
        home: 'Arsenal', away: 'Liverpool', home_score: 1, away_score: 0,
        status: 'live', status_text: "70'", time: canonical.kickoffUtc,
        slug: 'private-provider-live-slug'
      }] })),
      getMatch: vi.fn(async () => ({ match: {
        home: 'Arsenal', away: 'Liverpool', home_score: 2, away_score: 1,
        status: 'finished', status_text: 'FT', time: canonical.kickoffUtc,
        slug: 'private-provider-live-slug'
      } }))
    };
    const coordinator = new LiveRefreshCoordinator({
      ownerProfileId: 'owner-primary', persistence, source,
      repository: canonicalRepository as never,
      now: () => now,
      createLeaseId: () => `lease-${now}`
    });

    const live = response();
    await handleLiveMatches(
      request('POST', '/api/v1/live/refresh?reason=visible', '', { cookie }) as never,
      live as never,
      { coordinator }
    );
    expect(JSON.parse(live.body).snapshot.matches[0]).toMatchObject({ status: 'live', score: { home: 1, away: 0 } });

    now = '2026-09-02T12:05:00.000Z';
    source.listMatches.mockResolvedValue({ matches: [] });
    const terminal = response();
    await handleLiveMatches(
      request('POST', '/api/v1/live/refresh?reason=visible', '', { cookie }) as never,
      terminal as never,
      { coordinator }
    );
    expect(JSON.parse(terminal.body).snapshot.matches[0]).toMatchObject({ status: 'completed', score: { home: 2, away: 1 } });
    expect(terminal.body).not.toContain('private-provider-live-slug');

    const projectedRepository = new TerminalLiveProjectionRepository(
      canonicalRepository as never,
      persistence,
      'owner-primary'
    );
    const matches = response();
    await handleMatches(
      request('GET', '/api/v1/matches?status=completed', '', { cookie }) as never,
      matches as never,
      { repository: projectedRepository }
    );
    expect(JSON.parse(matches.body).matches[0]).toMatchObject({ status: 'completed', score: { home: 2, away: 1 } });
    expect(matches.body).not.toContain('private-provider-live-slug');

    const logout = response();
    await handleOwnerAuthRoute(request('POST', '/api/v1/auth/logout', '', { cookie }) as never, logout as never, authConfig);
    expect(String(logout.headers['Set-Cookie'])).toContain('Max-Age=0');
    const denied = response();
    expect(enforceOwnerSession(request('GET', '/api/v1/matches') as never, denied as never, authConfig)).toBe('handled');
    expect(denied.statusCode).toBe(401);
  });
});
