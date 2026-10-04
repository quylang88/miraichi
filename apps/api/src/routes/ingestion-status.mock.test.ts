import { describe, expect, it } from 'vitest';
import { createApiHandler } from '../api-router.js';
import type { ApiRuntime } from '../runtime/api-runtime.js';

describe('ingestion status route through Web API', () => {
  it('keeps the provider-neutral mock payload behind the canonical router', async () => {
    const handler = createApiHandler({
      ownerAuthConfig: { mode: 'disabled', sessionTtlSeconds: 1 },
      liveRefreshServiceAuthConfig: { token: undefined },
      cloudDependencies: { ownerProfileId: 'owner-primary' } as never,
      matchRepository: {} as never,
      matchDetailDependencies: { repository: {} as never },
      liveCoordinator: {} as never
    } satisfies ApiRuntime);

    const response = await handler(new Request('https://miraichi.test/api/v1/ingestion/status'));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({
      status: 'active',
      providerId: 'provider-mock-alpha'
    });
  });
});
