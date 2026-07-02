// Canonical warehouse tests are co-located with the combined raw-cache.test.ts suite.
// This file ensures the canonical-warehouse module is independently importable.
import { describe, expect, it } from 'vitest';
import { appendCanonicalWarehouseRecord } from './canonical-warehouse.js';

describe('appendCanonicalWarehouseRecord', () => {
  it('exports a callable function', () => {
    expect(typeof appendCanonicalWarehouseRecord).toBe('function');
  });
});
