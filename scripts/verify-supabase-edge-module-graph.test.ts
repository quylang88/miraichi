import { describe, expect, it } from 'vitest';
import { inspectSupabaseEdgeModuleGraph } from './verify-supabase-edge-module-graph.js';

describe('Supabase Edge module graph audit', () => {
  it('rejects Node HTTP, filesystem stores, pg, static hosting, and another function', () => {
    const findings = inspectSupabaseEdgeModuleGraph({
      inputs: {
        'apps/api/src/index.ts': { bytes: 1, imports: [{ path: 'node:http', kind: 'import-statement' }] },
        'apps/api/src/hosted-static-server.ts': { bytes: 1, imports: [] },
        'apps/api/src/repositories/local-match-detail-store.ts': { bytes: 1, imports: [] },
        'apps/api/src/persistence/supabase/postgres-query-client.ts': {
          bytes: 1, imports: [{ path: 'pg', kind: 'import-statement' }]
        },
        'supabase/functions/other-function/index.ts': { bytes: 1, imports: [] }
      },
      outputs: {}
    });

    expect(findings).toEqual(expect.arrayContaining([
      expect.stringContaining('apps/api/src/index.ts'),
      expect.stringContaining('node:http'),
      expect.stringContaining('hosted-static-server'),
      expect.stringContaining('local-match-detail-store'),
      expect.stringContaining('postgres-query-client'),
      expect.stringContaining('other-function')
    ]));
  });

  it('allows runtime-neutral API code and the documented node:crypto compatibility API', () => {
    expect(inspectSupabaseEdgeModuleGraph({
      inputs: {
        'apps/api/src/runtime/edge-runtime-composition.ts': {
          bytes: 1,
          imports: [{ path: 'node:crypto', kind: 'import-statement' }]
        },
        'apps/api/src/api-router.ts': { bytes: 1, imports: [] }
      },
      outputs: {}
    })).toEqual([]);
  });
});
