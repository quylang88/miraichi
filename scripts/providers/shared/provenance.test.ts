// Provenance tests are co-located in entity-resolution.test.ts.
// This file ensures the provenance module is independently importable.
import { describe, expect, it } from 'vitest';
import { createFieldProvenance } from './provenance.js';

describe('createFieldProvenance', () => {
  it('exports a callable function', () => {
    expect(typeof createFieldProvenance).toBe('function');
  });
});
