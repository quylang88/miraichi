import { expect, it } from 'vitest';

it('requires the exact hosted Frankfurt origin and owner credential instead of skipping', async () => {
  const module = await import('./staging-hosted-config.js').catch(() => null);
  expect(module?.requireStagingConfig).toBeTypeOf('function');
  if (!module) return;
  expect(() => module.requireStagingConfig({})).toThrow('STAGING_URL');
  expect(() => module.requireStagingConfig({ STAGING_URL: 'http://localhost:3000', MIRAICHI_OWNER_PASSWORD: 'test' })).toThrow('Frankfurt');
  expect(() => module.requireStagingConfig({ STAGING_URL: module.FRANKFURT_STAGING_ORIGIN })).toThrow('MIRAICHI_OWNER_PASSWORD');
  expect(module.requireStagingConfig({ STAGING_URL: module.FRANKFURT_STAGING_ORIGIN, MIRAICHI_OWNER_PASSWORD: 'test-local-password' }).origin).toBe(module.FRANKFURT_STAGING_ORIGIN);
});
