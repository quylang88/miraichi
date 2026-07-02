// Manifest tests are co-located with the combined raw-cache.test.ts suite.
// This file ensures the manifest module is independently importable.
import { describe, expect, it } from 'vitest';
import { appendProviderManifestEntry } from './manifest.js';

describe('appendProviderManifestEntry', () => {
  it('exports a callable function', () => {
    expect(typeof appendProviderManifestEntry).toBe('function');
  });
});
