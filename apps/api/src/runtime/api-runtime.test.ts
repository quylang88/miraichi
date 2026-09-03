import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { defineApiRuntime } from './api-runtime.js';

describe('API runtime definition', () => {
  it('requires one non-empty server-controlled owner profile', () => {
    const adapter = createMemoryCloudPersistenceAdapter();
    const dependencies = {
      ownerAuthConfig: { mode: 'disabled' as const, sessionTtlSeconds: 1 },
      liveRefreshServiceAuthConfig: { token: undefined },
      cloudDependencies: { adapter, ownerProfileId: ' ' },
      matchRepository: {} as never,
      matchDetailDependencies: { repository: {} as never },
      liveCoordinator: {} as never
    };

    expect(() => defineApiRuntime(dependencies)).toThrow('ownerProfileId is required');
    expect(defineApiRuntime({
      ...dependencies,
      cloudDependencies: { adapter, ownerProfileId: 'owner-primary' }
    }).cloudDependencies.ownerProfileId).toBe('owner-primary');
  });
});
