import { describe, expect, it } from 'vitest';
import { readReleaseMetadata } from './release-metadata.js';

const valid = {
  MIRAICHI_RELEASE_ENVIRONMENT: 'staging',
  MIRAICHI_RELEASE_SHA: 'a'.repeat(40),
  MIRAICHI_RELEASE_ARTIFACT: 'candidate-a1',
  MIRAICHI_SCHEMA_COMPAT_VERSION: 'owner-v1'
} as const;

describe('release metadata', () => {
  it('normalizes one complete non-secret release identity', () => {
    expect(readReleaseMetadata(valid)).toEqual({
      environment: 'staging',
      gitSha: 'a'.repeat(40),
      artifactVersion: 'candidate-a1',
      compatibilityVersion: 'owner-v1'
    });
  });

  it.each([
    [{ ...valid, MIRAICHI_RELEASE_ENVIRONMENT: 'prod' }, 'environment'],
    [{ ...valid, MIRAICHI_RELEASE_SHA: 'A'.repeat(40) }, 'SHA'],
    [{ ...valid, MIRAICHI_RELEASE_SHA: 'a'.repeat(39) }, 'SHA'],
    [{ ...valid, MIRAICHI_RELEASE_ARTIFACT: '' }, 'artifact'],
    [{ ...valid, MIRAICHI_SCHEMA_COMPAT_VERSION: '' }, 'compatibility']
  ])('rejects an incomplete or ambiguous identity', (environment, message) => {
    expect(() => readReleaseMetadata(environment)).toThrow(message);
  });
});
