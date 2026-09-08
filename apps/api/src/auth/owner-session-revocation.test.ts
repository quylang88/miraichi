import { describe, expect, it } from 'vitest';
import { createOwnerPasswordHash, createOwnerSessionToken, readOwnerAuthConfig } from './owner-auth.js';

describe('durable owner session invalidation', () => {
  it('issues distinct sessions at the same timestamp', () => {
    const secret = 'session-secret-at-least-thirty-two-characters';
    expect(createOwnerSessionToken(secret, 100_000, 600) === createOwnerSessionToken(secret, 100_000, 600)).toBe(false);
  });
  it('blocks saved cookie replay across handler instances after logout', async () => {
    const module = await import('./owner-session-revocation.js').catch(() => null);
    expect(module?.withRevocableOwnerSessions).toBeTypeOf('function');
    if (!module) return;
    const config = readOwnerAuthConfig({ APP_ENV: 'staging', MIRAICHI_OWNER_PASSWORD_HASH: await createOwnerPasswordHash('test-only-disposable-password'), MIRAICHI_SESSION_SECRET: 'session-secret-at-least-thirty-two-characters' });
    const now = Date.now();
    const token = createOwnerSessionToken(config.sessionSecret!, now, 600);
    const revoked = new Set<string>();
    const store = { isRevoked: async (hash: string) => revoked.has(hash), revoke: async (hash: string) => { revoked.add(hash); } };
    const downstream = async () => new Response(null, { status: 204 });
    const first = module.withRevocableOwnerSessions(downstream, config, store);
    const second = module.withRevocableOwnerSessions(downstream, config, store);
    const headers = { cookie: `__Host-miraichi_owner=${token}` };
    expect((await first(new Request('https://staging.test/api/v1/auth/logout', { method: 'POST', headers })))?.status).toBe(204);
    expect((await second(new Request('https://staging.test/api/v1/matches', { headers })))?.status).toBe(401);
    expect(revoked.has(token)).toBe(false);
  });
});
