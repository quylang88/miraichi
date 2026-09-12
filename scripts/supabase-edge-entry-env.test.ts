import { describe, expect, it } from 'vitest';
import { build } from 'esbuild';
describe('deployed Edge entry environment', () => {
  it('forwards the explicit daily LIVE mode from Deno to the runtime', async () => {
    const bundled = await build({ entryPoints: ['supabase/functions/miraichi-api/index.ts'], bundle: true, write: false, format: 'iife',
      plugins: [{ name: 'isolate-runtime-bootstrap', setup(builder) {
        builder.onResolve({ filter: /_shared\// }, args => ({ path: args.path, namespace: 'bootstrap-test' }));
        builder.onLoad({ filter: /.*/, namespace: 'bootstrap-test' }, () => ({ contents: `
          export const createEdgeRequestHandler = input => input.env;
          export const createEdgeRuntimeSmokeHandler = () => {};
          export const createPostgresEdgeApiHandler = () => {};
          export const createPostgresJsQueryClient = () => {};
          export const createPostgresRuntime = () => {};
        ` }));
      } }] });
    let forwarded: Record<string, string> = {};
    new Function('Deno', bundled.outputFiles[0]!.text)({ env: { get: (name: string) => name === 'LIVE_DATA_MODE' ? 'fotmob-daily' : undefined },
      serve: (env: Record<string, string>) => { forwarded = env; } });
    expect(forwarded.LIVE_DATA_MODE).toBe('fotmob-daily');
  });
});
