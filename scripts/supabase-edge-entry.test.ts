import { createRequire } from 'node:module';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { build } from 'esbuild';
import { describe, expect, it } from 'vitest';
import { buildSupabaseEdgeFunction } from './build-supabase-edge-function.js';

describe('deployed Supabase Edge entry', () => {
  it('returns configured release identity from health without database access', async () => {
    const outputRoot = await mkdtemp(path.join(os.tmpdir(), 'miraichi-edge-entry-'));
    try {
      const runtime = await buildSupabaseEdgeFunction({ outputRoot });
      const bundle = await build({
        entryPoints: ['supabase/functions/miraichi-api/index.ts'],
        bundle: true, write: false, platform: 'node', format: 'cjs', logLevel: 'silent',
        plugins: [{ name: 'disposable-postgres-driver', setup(context) {
          context.onResolve({ filter: /miraichi-edge-runtime\.js$/ }, () => ({ path: runtime.outputFile }));
          context.onResolve({ filter: /postgres-runtime\.ts$/ }, () => ({ path: 'driver', namespace: 'fixture' }));
          context.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: `
            export function createPostgresRuntime() {
              return { unsafe() { throw new Error('Health must not query the database'); } };
            }
          ` }));
        } }]
      });
      const release = {
        environment: 'staging', gitSha: 'a'.repeat(40),
        artifactVersion: 'entry-fixture-a', compatibilityVersion: 'owner-v3'
      };
      const env: Record<string, string> = {
        APP_ENV: 'local', SUPABASE_DB_URL: 'postgresql://postgres:postgres@db:5432/postgres',
        MIRAICHI_GATEWAY_TOKEN: 'disposable-gateway-token-at-least-32-bytes',
        MIRAICHI_RELEASE_ENVIRONMENT: release.environment, MIRAICHI_RELEASE_SHA: release.gitSha,
        MIRAICHI_RELEASE_ARTIFACT: release.artifactVersion,
        MIRAICHI_SCHEMA_COMPAT_VERSION: release.compatibilityVersion
      };
      let handler: ((request: Request) => Promise<Response>) | undefined;
      const deno = { env: { get: (name: string) => env[name] },
        serve: (value: typeof handler) => { handler = value; } };
      new Function('require', 'Deno', bundle.outputFiles[0]!.text)(createRequire(import.meta.url), deno);
      expect(handler).toBeTypeOf('function');
      const response = await handler!(new Request('http://edge.internal/functions/v1/miraichi-api/api/v1/health', {
        headers: { 'x-miraichi-gateway-token': env.MIRAICHI_GATEWAY_TOKEN! }
      }));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ status: 'ok', release });
    } finally {
      await rm(outputRoot, { recursive: true, force: true });
    }
  });
});
