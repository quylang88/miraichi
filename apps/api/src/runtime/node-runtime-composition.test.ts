import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createNodeRuntimeComposition } from './node-runtime-composition.js';

describe('Node API runtime composition', () => {
  it('keeps local filesystem/static concerns in the Node composition root', () => {
    const rootDir = path.resolve('C:/miraichi-composition-test');
    const result = createNodeRuntimeComposition({
      rootDir,
      env: {
        APP_ENV: 'test',
        CLOUD_PERSISTENCE_MODE: 'memory',
        MIRAICHI_OWNER_PROFILE_ID: 'owner-primary',
        HOSTED_WEB_MODE: 'required',
        HOSTED_WEB_ROOT: 'built-web',
        PROVIDER_CAPTURE_ROOT: 'provider-data',
        SPORTSCORE_LIVE_MODE: 'disabled'
      }
    });

    expect(result.runtime.cloudDependencies.ownerProfileId).toBe('owner-primary');
    expect(result.runtime.matchDetailDependencies.repository).toBe(result.runtime.matchRepository);
    expect(result.runtime.matchDetailDependencies.detailStore).toBeDefined();
    expect(result.runtime.matchDetailDependencies.queue).toBeUndefined();
    expect(result.hostedWebMode).toBe('required');
    expect(result.hostedWebRoot).toBe(path.resolve(rootDir, 'built-web'));
  });

  it('rejects an unknown hosted or live mode before starting Node HTTP', () => {
    expect(() => createNodeRuntimeComposition({
      rootDir: process.cwd(),
      env: { APP_ENV: 'test', CLOUD_PERSISTENCE_MODE: 'memory', HOSTED_WEB_MODE: 'sometimes' }
    })).toThrow('HOSTED_WEB_MODE must be disabled or required');
    expect(() => createNodeRuntimeComposition({
      rootDir: process.cwd(),
      env: { APP_ENV: 'test', CLOUD_PERSISTENCE_MODE: 'memory', SPORTSCORE_LIVE_MODE: 'sometimes' }
    })).toThrow('SPORTSCORE_LIVE_MODE must be disabled or widget');
  });
});
