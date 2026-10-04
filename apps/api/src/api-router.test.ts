import { describe, expect, it, vi } from 'vitest';
import { readLiveRefreshServiceAuthConfig } from './auth/live-refresh-service-auth.js';
import { createOwnerPasswordHash, createOwnerSessionToken, OWNER_SESSION_COOKIE, readOwnerAuthConfig } from './auth/owner-auth.js';
import { createMemoryCloudPersistenceAdapter } from './persistence/memory-cloud-persistence-adapter.js';
import { createApiHandler } from './api-router.js';
import { defineApiRuntime, type ApiRuntime } from './runtime/api-runtime.js';

function localRuntime(overrides: Partial<ApiRuntime> = {}): ApiRuntime {
  const adapter = createMemoryCloudPersistenceAdapter();
  const repository = {
    listMatches: vi.fn(async () => ({
      matches: [],
      snapshot: {
        snapshotId: 'router-test', generatedAt: '2026-09-03T00:00:00.000Z',
        importedAt: '2026-09-03T00:00:00.000Z', matchCount: 0,
        competitions: [], sources: [], freshness: 'fresh' as const, warnings: []
      }
    })),
    findById: vi.fn(async () => null),
    getStatus: vi.fn(async () => ({
      snapshotId: 'router-test', generatedAt: '2026-09-03T00:00:00.000Z',
      importedAt: '2026-09-03T00:00:00.000Z', matchCount: 0,
      competitions: [], sources: [], freshness: 'fresh' as const, warnings: []
    }))
  };
  return defineApiRuntime({
    ownerAuthConfig: readOwnerAuthConfig({ APP_ENV: 'local' }),
    liveRefreshServiceAuthConfig: readLiveRefreshServiceAuthConfig({ APP_ENV: 'local' }),
    cloudDependencies: { adapter, ownerProfileId: 'owner-primary' },
    matchRepository: repository,
    matchDetailDependencies: { repository },
    liveCoordinator: {
      read: vi.fn(async () => ({ outcome: 'fresh', snapshot: null, state: null })),
      refresh: vi.fn(async () => ({ outcome: 'fresh', snapshot: null, state: null }))
    } as never,
    ...overrides
  });
}

describe('Web API router', () => {
  it('permits explicit detail POST only for an owner session and rejects cross-origin/service bearer access', async () => {
    const secret='detail-router-session-secret-long-enough';
    const coordinator={read:vi.fn(),refresh:vi.fn(async()=>null)};
    const runtime=localRuntime({ownerAuthConfig:readOwnerAuthConfig({APP_ENV:'staging',MIRAICHI_OWNER_PASSWORD_HASH:await createOwnerPasswordHash('fixture-password'),MIRAICHI_SESSION_SECRET:secret}),
      matchDetailDependencies:{coordinator} as never,liveRefreshServiceAuthConfig:{token:'detail-test-service-token-at-least32characters'}});
    const handle=createApiHandler(runtime); const url='https://miraichi.example/api/v1/matches/detail/refresh?id=match-example';
    expect((await handle(new Request(url,{method:'POST'})))?.status).toBe(401);
    const cookie=`${OWNER_SESSION_COOKIE}=${createOwnerSessionToken(secret,Date.now(),600)}`;
    expect((await handle(new Request(url,{method:'POST',headers:{cookie,origin:'https://bad.example'}})))?.status).toBe(403);
    expect((await handle(new Request(url,{method:'POST',headers:{authorization:'Bearer detail-test-service-token-at-least32characters'}})))?.status).toBe(401);
    expect(coordinator.refresh).not.toHaveBeenCalled();
    expect((await handle(new Request(url,{method:'POST',headers:{cookie,origin:'https://miraichi.example'}})))?.status).toBe(404);
    expect(coordinator.refresh).toHaveBeenCalledExactlyOnceWith('match-example');
  });
  it('routes health before owner auth and returns null outside /api', async () => {
    const passwordHash = await createOwnerPasswordHash('correct horse battery staple');
    const runtime = localRuntime({
      ownerAuthConfig: readOwnerAuthConfig({
        APP_ENV: 'production',
        MIRAICHI_OWNER_PASSWORD_HASH: passwordHash,
        MIRAICHI_SESSION_SECRET: 'session-secret-with-at-least-thirty-two-characters'
      })
    });
    const handle = createApiHandler(runtime);

    const health = await handle(new Request('https://miraichi.example/api/v1/health'));
    expect(health?.status).toBe(200);
    await expect(health?.json()).resolves.toMatchObject({ status: 'ok' });
    await expect(handle(new Request('https://miraichi.example/'))).resolves.toBeNull();
  });

  it('protects owner routes while limiting the refresh bearer to the exact hourly operation', async () => {
    const token = 'hourly-refresh-token-with-at-least-32-bytes';
    const passwordHash = await createOwnerPasswordHash('correct horse battery staple');
    const refresh = vi.fn(async () => ({ outcome: 'fresh', snapshot: null, state: null }));
    const runtime = localRuntime({
      ownerAuthConfig: readOwnerAuthConfig({
        APP_ENV: 'production',
        MIRAICHI_OWNER_PASSWORD_HASH: passwordHash,
        MIRAICHI_SESSION_SECRET: 'session-secret-with-at-least-thirty-two-characters'
      }),
      liveRefreshServiceAuthConfig: { token },
      liveCoordinator: { read: vi.fn(), refresh } as never
    });
    const handle = createApiHandler(runtime);
    const authorization = { authorization: `Bearer ${token}` };

    const denied = await handle(new Request('https://miraichi.example/api/v1/matches', { headers: authorization }));
    expect(denied?.status).toBe(401);
    const hourly = await handle(new Request('https://miraichi.example/api/v1/live/refresh?reason=hourly', {
      method: 'POST', headers: authorization
    }));
    expect(hourly?.status).toBe(200);
    expect(refresh).toHaveBeenCalledWith('hourly');
  });

  it('rejects foreign browser origins, allows one configured origin, and returns JSON API 404', async () => {
    const handle = createApiHandler(localRuntime({ allowedOrigin: 'http://localhost:3000' }));

    const rejected = await handle(new Request('https://miraichi.example/api/v1/health', {
      headers: { origin: 'https://attacker.example' }
    }));
    expect(rejected?.status).toBe(403);

    const allowed = await handle(new Request('https://miraichi.example/api/v1/health', {
      headers: { origin: 'http://localhost:3000' }
    }));
    expect(allowed?.status).toBe(200);
    expect(allowed?.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');

    const missing = await handle(new Request('https://miraichi.example/api/v1/not-real'));
    expect(missing?.status).toBe(404);
    await expect(missing?.json()).resolves.toMatchObject({ error: { code: 'not_found' } });
  });
});
