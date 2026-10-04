import { describe, expect, it } from 'vitest';
import {
  createOwnerPasswordHash,
  createOwnerSessionToken,
  readOwnerAuthConfig,
  verifyOwnerPassword,
  verifyOwnerSessionToken
} from './owner-auth.js';

describe('owner authentication primitives', () => {
  it('keeps auth disabled for local tests but requires password mode and both secrets outside local/test', async () => {
    expect(readOwnerAuthConfig({ APP_ENV: 'local' })).toMatchObject({ mode: 'disabled' });
    expect(readOwnerAuthConfig({ APP_ENV: 'test' })).toMatchObject({ mode: 'disabled' });
    expect(() => readOwnerAuthConfig({ APP_ENV: 'production' })).toThrow(/MIRAICHI_OWNER_PASSWORD_HASH/);
    expect(() => readOwnerAuthConfig({
      APP_ENV: 'production',
      MIRAICHI_OWNER_PASSWORD_HASH: 'not-a-supported-hash',
      MIRAICHI_SESSION_SECRET: 'x'.repeat(32)
    })).toThrow(/MIRAICHI_OWNER_PASSWORD_HASH/);
    const validHash = await createOwnerPasswordHash('config-validation-password');
    expect(() => readOwnerAuthConfig({
      APP_ENV: 'production',
      MIRAICHI_OWNER_PASSWORD_HASH: validHash,
      MIRAICHI_SESSION_SECRET: 'short'
    })).toThrow(/MIRAICHI_SESSION_SECRET/);
    expect(() => readOwnerAuthConfig({
      APP_ENV: 'production',
      MIRAICHI_OWNER_AUTH_MODE: 'disabled'
    })).toThrow(/cannot be disabled/i);
  });

  it('verifies the supported scrypt password hash without accepting a wrong password', async () => {
    const passwordHash = await createOwnerPasswordHash('a-long-owner-password');
    expect(passwordHash).toMatch(/^scrypt-v1\$16384\$8\$1\$/);
    await expect(verifyOwnerPassword('a-long-owner-password', passwordHash)).resolves.toBe(true);
    await expect(verifyOwnerPassword('wrong-password', passwordHash)).resolves.toBe(false);
  });

  it('signs an expiring owner session and rejects tampering or expiry', () => {
    const secret = 'session-secret-with-at-least-thirty-two-characters';
    const issuedAtMs = Date.parse('2026-09-02T00:00:00.000Z');
    const token = createOwnerSessionToken(secret, issuedAtMs, 600);

    expect(verifyOwnerSessionToken(token, secret, issuedAtMs + 599_000)).toBe(true);
    expect(verifyOwnerSessionToken(`${token}x`, secret, issuedAtMs + 1_000)).toBe(false);
    expect(verifyOwnerSessionToken(token, `${secret}x`, issuedAtMs + 1_000)).toBe(false);
    expect(verifyOwnerSessionToken(token, secret, issuedAtMs + 600_000)).toBe(false);
  });
});
