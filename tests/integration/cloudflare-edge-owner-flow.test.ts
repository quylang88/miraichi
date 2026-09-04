import { describe, expect, it, vi } from 'vitest';
import type { LocalMatch } from '@miraichi/shared';
import { createApiHandler } from '../../apps/api/src/api-router.js';
import { readLiveRefreshServiceAuthConfig } from '../../apps/api/src/auth/live-refresh-service-auth.js';
import { createOwnerPasswordHash, readOwnerAuthConfig } from '../../apps/api/src/auth/owner-auth.js';
import { LiveRefreshCoordinator } from '../../apps/api/src/live/live-refresh-coordinator.js';
import { createMemoryCloudPersistenceAdapter } from '../../apps/api/src/persistence/memory-cloud-persistence-adapter.js';
import { CloudMatchSnapshotRepository } from '../../apps/api/src/repositories/cloud-match-snapshot-repository.js';
import { TerminalLiveProjectionRepository } from '../../apps/api/src/repositories/terminal-live-projection-repository.js';
import { defineApiRuntime } from '../../apps/api/src/runtime/api-runtime.js';
import { createEdgeRequestHandler } from '../../apps/api/src/runtime/edge-runtime-composition.js';
import {
  createCloudflareGateway,
  type CloudflareGatewayEnv
} from '../../apps/cloudflare-gateway/src/index.js';

const origin = 'https://miraichi-stage.workers.dev';
const functionUrl = 'https://project-ref.supabase.co/functions/v1/miraichi-api';
const gatewayToken = 'integration-gateway-token-with-at-least-32-bytes';
const refreshToken = 'integration-refresh-token-with-at-least-32-bytes';
const password = 'correct horse battery staple';

const canonical: LocalMatch = {
  id: 'cloudflare-match-1',
  competition: { id: 'fixture-league', name: 'Fixture League', type: 'club', season: '2026-27' },
  kickoffUtc: '2026-09-03T10:00:00.000Z',
  status: 'scheduled',
  homeTeam: { id: 'home', name: 'Home' },
  awayTeam: { id: 'away', name: 'Away' },
  score: { home: null, away: null },
  sourceRefs: [],
  updatedAt: '2026-09-03T10:00:00.000Z'
};

function asRequest(input: string | URL | Request, init?: RequestInit): Request {
  if (input instanceof Request && init === undefined) return input;
  const requestInit: RequestInit = { ...init };
  if (requestInit.body) Object.assign(requestInit, { duplex: 'half' });
  return new Request(input, requestInit);
}

describe('Cloudflare to Supabase Edge owner flow integration', () => {
  it('runs same-origin auth, cloud writes, live terminal projection, and logout with one subrequest each', async () => {
    let now = '2026-09-03T12:00:00.000Z';
    const adapter = createMemoryCloudPersistenceAdapter({ now: () => now });
    await adapter.upsertMatchSnapshot('owner-primary', {
      snapshotId: 'cloudflare-snapshot',
      generatedAt: '2026-09-03T10:00:00.000Z',
      importedAt: '2026-09-03T10:00:00.000Z',
      sources: [],
      matches: [canonical]
    });
    const cloudRepository = new CloudMatchSnapshotRepository(adapter, 'owner-primary');
    const projectedRepository = new TerminalLiveProjectionRepository(
      cloudRepository, adapter, 'owner-primary'
    );
    const source = {
      listMatches: vi.fn(async () => ({ matches: [{
        home: 'Home', away: 'Away', home_score: 1, away_score: 0,
        status: 'live', status_text: "70'", time: canonical.kickoffUtc,
        slug: 'private-provider-locator'
      }] })),
      getMatch: vi.fn(async () => ({ match: {
        home: 'Home', away: 'Away', home_score: 2, away_score: 1,
        status: 'finished', status_text: 'FT', time: canonical.kickoffUtc,
        slug: 'private-provider-locator'
      } }))
    };
    const coordinator = new LiveRefreshCoordinator({
      ownerProfileId: 'owner-primary',
      persistence: adapter,
      repository: cloudRepository,
      source,
      now: () => now,
      createLeaseId: () => `lease-${now}`
    });
    const ownerAuthConfig = readOwnerAuthConfig({
      APP_ENV: 'staging',
      MIRAICHI_OWNER_AUTH_MODE: 'password',
      MIRAICHI_OWNER_PASSWORD_HASH: await createOwnerPasswordHash(password),
      MIRAICHI_SESSION_SECRET: 'integration-session-secret-with-at-least-32-bytes'
    });
    const api = createApiHandler(defineApiRuntime({
      ownerAuthConfig,
      liveRefreshServiceAuthConfig: readLiveRefreshServiceAuthConfig({
        APP_ENV: 'staging', SPORTSCORE_LIVE_MODE: 'disabled', MIRAICHI_REFRESH_TOKEN: refreshToken
      }),
      cloudDependencies: { adapter, ownerProfileId: 'owner-primary' },
      matchRepository: projectedRepository,
      matchDetailDependencies: { repository: projectedRepository },
      liveCoordinator: coordinator,
      allowedOrigin: origin,
      now: () => Date.parse(now)
    }));
    const edge = createEdgeRequestHandler({
      env: { MIRAICHI_GATEWAY_TOKEN: gatewayToken },
      createHandler: () => api
    });
    const upstream = vi.fn(async (input: string | URL | Request, init?: RequestInit) => (
      edge(asRequest(input, init))
    ));
    const worker = createCloudflareGateway({ fetcher: upstream as typeof fetch });
    const assets = { fetch: vi.fn(async () => new Response('static')) };
    const env: CloudflareGatewayEnv = {
      ASSETS: assets,
      DEPLOYMENT_ENV: 'staging',
      MIRAICHI_EDGE_FUNCTION_URL: functionUrl,
      MIRAICHI_GATEWAY_TOKEN: gatewayToken,
      MIRAICHI_PUBLIC_ORIGIN: origin,
      MIRAICHI_EDGE_REGION: 'eu-central-1'
    };
    const call = (path: string, init: RequestInit = {}) => {
      const headers = new Headers(init.headers);
      headers.set('Origin', origin);
      return worker.fetch(new Request(`${origin}${path}`, { ...init, headers }), env);
    };

    expect((await call('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong password value' })
    })).status).toBe(401);
    const login = await call('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const setCookie = login.headers.get('set-cookie')!;
    const cookie = setCookie.split(';')[0]!;
    expect(login.status).toBe(204);
    expect(setCookie).toContain('HttpOnly; Secure; SameSite=Strict');

    const authorizedHeaders = { Cookie: cookie };
    const bankroll = await call('/api/v1/bankroll/setup', {
      method: 'POST', headers: { ...authorizedHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ openingBalancePoints: 100, timeZone: 'Asia/Tokyo', weekStartDay: 'monday' })
    });
    expect(bankroll.status).toBe(201);
    await expect(bankroll.json()).resolves.toMatchObject({ account: { currentBalancePoints: 100 } });

    const draft = await call('/api/v1/bet-drafts', {
      method: 'POST', headers: { ...authorizedHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draftId: 'draft-edge-1', matchGroupId: canonical.id, marketType: '1X2',
        oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 5,
        createdAt: now, updatedAt: now
      })
    });
    expect(draft.status).toBe(201);

    const live = await call('/api/v1/live/refresh?reason=visible', {
      method: 'POST', headers: authorizedHeaders
    });
    expect(live.status).toBe(200);
    await expect(live.json()).resolves.toMatchObject({
      snapshot: { matches: [{ status: 'live', score: { home: 1, away: 0 } }] }
    });

    now = '2026-09-03T12:05:01.000Z';
    source.listMatches.mockResolvedValue({ matches: [] });
    const terminal = await call('/api/v1/live/refresh?reason=visible', {
      method: 'POST', headers: authorizedHeaders
    });
    expect(terminal.status).toBe(200);
    const terminalBody = await terminal.text();
    expect(JSON.parse(terminalBody).snapshot.matches[0]).toMatchObject({
      status: 'completed', score: { home: 2, away: 1 }
    });
    expect(terminalBody).not.toContain('private-provider-locator');

    const matches = await call('/api/v1/matches?status=completed', { headers: authorizedHeaders });
    const matchBody = await matches.text();
    expect(JSON.parse(matchBody).matches[0]).toMatchObject({ status: 'completed', score: { home: 2, away: 1 } });
    expect(matchBody).not.toContain('private-provider-locator');

    const logout = await call('/api/v1/auth/logout', { method: 'POST', headers: authorizedHeaders });
    expect(logout.status).toBe(204);
    expect(logout.headers.get('set-cookie')).toContain('Max-Age=0');
    expect((await call('/api/v1/bet-drafts')).status).toBe(401);

    expect(upstream).toHaveBeenCalledTimes(9);
    expect(assets.fetch).not.toHaveBeenCalled();
    for (const [, init] of upstream.mock.calls) {
      expect(new Headers(init?.headers).get('x-miraichi-gateway-token')).toBe(gatewayToken);
    }
  });
});
