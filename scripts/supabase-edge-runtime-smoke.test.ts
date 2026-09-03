import { describe, expect, it, vi } from 'vitest';
import {
  parseEdgeRuntimeSmokeArgs,
  runEdgeRuntimeSmoke
} from './supabase-edge-runtime-smoke.js';

describe('Supabase Edge runtime smoke', () => {
  it('accepts only the postgres scope', () => {
    expect(parseEdgeRuntimeSmokeArgs(['--scope', 'postgres'])).toEqual({ scope: 'postgres' });
    expect(() => parseEdgeRuntimeSmokeArgs(['--scope', 'auth'])).toThrow('Unsupported Edge runtime smoke scope');
  });

  it('requires a successful parameter, rollback, commit, and cleanup result', async () => {
    const fetcher = vi.fn(async (_input: string | URL | Request) => new Response(JSON.stringify({
      scope: 'postgres',
      parameterizedQuery: true,
      rollback: true,
      commit: true,
      cleanup: true
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(runEdgeRuntimeSmoke({
      scope: 'postgres',
      functionUrl: 'http://127.0.0.1:15421/functions/v1/miraichi-api',
      gatewayToken: 'edge-gateway-token-with-at-least-32-bytes',
      fetcher
    })).resolves.toMatchObject({ scope: 'postgres', rollback: true, commit: true });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]![0]).toBe(
      'http://127.0.0.1:15421/functions/v1/miraichi-api/__runtime-smoke/postgres'
    );
  });

  it('fails when the runtime omits any transaction proof', async () => {
    await expect(runEdgeRuntimeSmoke({
      scope: 'postgres',
      functionUrl: 'http://127.0.0.1:15421/functions/v1/miraichi-api',
      gatewayToken: 'edge-gateway-token-with-at-least-32-bytes',
      fetcher: async () => new Response(JSON.stringify({
        scope: 'postgres', parameterizedQuery: true, rollback: false, commit: true, cleanup: true
      }), { status: 200 })
    })).rejects.toThrow('Edge postgres smoke did not prove all gates');
  });
});
