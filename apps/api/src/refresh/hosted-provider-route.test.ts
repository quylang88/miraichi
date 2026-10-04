import { describe, expect, it, vi } from 'vitest';

describe('hosted provider route', () => {
  it('denies missing/wrong tokens and owner cookies before constructing a coordinator', async () => {
    const module = await import('./hosted-provider-route.js').catch(() => null);
    expect(module?.createHostedProviderRoute).toBeTypeOf('function');
    if (!module) return;
    const create = vi.fn();
    const handle = module.createHostedProviderRoute('provider-refresh-test-token-at-least-32-bytes', create);
    for (const headers of [{}, { authorization: 'Bearer wrong' }, { cookie: '__Host-miraichi_owner=owner-session' }]) {
      const response = await handle(new Request('https://staging.test/api/internal/providers/current/refresh', { method: 'POST', headers }));
      expect(response?.status).toBe(401);
    }
    expect(create).not.toHaveBeenCalled();
  });
  it('accepts only the exact POST token route and sanitizes failures', async () => {
    const module = await import('./hosted-provider-route.js').catch(() => null);
    expect(module?.createHostedProviderRoute).toBeTypeOf('function');
    if (!module) return;
    const token = 'provider-refresh-test-token-at-least-32-bytes';
    const run = vi.fn(async () => ({ outcome: 'fresh' as const, requests: 0, publications: 0, snapshotId: null }));
    const handle = module.createHostedProviderRoute(token, () => ({ run }));
    const response = await handle(new Request('https://staging.test/api/internal/providers/terminal/refresh', { method: 'POST', headers: { authorization: `Bearer ${token}` } }));
    expect(response?.status).toBe(200);
    expect(run).toHaveBeenCalledWith('terminal');
    expect(await handle(new Request('https://staging.test/api/v1/bets'))).toBeNull();
    expect((await handle(new Request('https://staging.test/api/internal/providers/current/refresh', { headers: { authorization: `Bearer ${token}` } })))?.status).toBe(405);
  });
});
