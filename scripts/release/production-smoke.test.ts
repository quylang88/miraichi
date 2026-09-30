import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runProductionSmoke, runProductionSmokeCli } from './production-smoke.js';
import { createReleaseManifest } from './release-manifest.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const origin = 'https://miraichi-production.workers.dev';
const edge = 'https://production-ref.supabase.co/functions/v1/miraichi-api';
const release = {
  environment: 'production' as const,
  gitSha: 'a'.repeat(40), artifactVersion: 'candidate-a', compatibilityVersion: 'owner-v3'
};
const releaseHeaders = {
  'x-miraichi-release-environment': release.environment,
  'x-miraichi-release-sha': release.gitSha,
  'x-miraichi-release-artifact': release.artifactVersion,
  'x-miraichi-compatibility-version': release.compatibilityVersion
};

function fixture(overrides: { region?: string; directDenied?: boolean } = {}) {
  const calls: Array<{ url: string; method: string }> = [];
  const fetcher = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    calls.push({ url: request.url, method: request.method });
    if (url.origin === new URL(edge).origin) {
      if (!request.headers.has('x-miraichi-gateway-token')) {
        return Response.json({ error: { code: 'gateway_auth_required' } }, { status: overrides.directDenied === false ? 200 : 401 });
      }
      return Response.json({ status: 'ok', release }, {
        status: 200, headers: { ...releaseHeaders, 'x-sb-edge-region': overrides.region ?? 'ap-southeast-1' }
      });
    }
    if (url.pathname === '/') return new Response('<!doctype html><html>Miraichi auth-bootstrap app-root</html>', { status: 200, headers: releaseHeaders });
    if (url.pathname === '/manifest.webmanifest') return Response.json({ name: 'Miraichi', start_url: '/' }, { headers: releaseHeaders });
    if (url.pathname === '/service-worker.js') return new Response(`const CACHE='miraichi-shell-${hash('web')}';`, { headers: releaseHeaders });
    if (url.pathname === '/release.json') return Response.json(release, { headers: releaseHeaders });
    if (url.pathname === '/api/v1/health') return Response.json({ status: 'ok', release }, { headers: releaseHeaders });
    if (url.pathname === '/api/v1/bet-drafts') return Response.json({ error: { code: 'authentication_required' } }, { status: 401, headers: releaseHeaders });
    return new Response('not found', { status: 404 });
  });
  return { fetcher: fetcher as typeof fetch, calls };
}

function input(fetcher: typeof fetch) {
  return {
    publicOrigin: origin, edgeFunctionUrl: edge, edgeGatewayToken: 'gateway-token-with-at-least-32-bytes',
    expectedRelease: release,
    expectedManifest: { sourceSha: release.gitSha, migrationHash: hash('migrations'), webHash: hash('web') },
    expectedRegion: 'ap-southeast-1' as const,
    expectedSchedulerTarget: edge,
    schedulerProbe: async () => ({ target: edge, vaultNames: [
      'miraichi_edge_function_url', 'miraichi_edge_gateway_token',
      'miraichi_live_refresh_token', 'miraichi_provider_refresh_token'
    ], activeJobNames: ['miraichi-current-refresh', 'miraichi-live-refresh', 'miraichi-terminal-refresh'] }),
    schemaProbe: async () => ({ migrationHash: hash('migrations'), compatibilityVersion: 'owner-v3' }),
    fetcher
  };
}

describe('production smoke', () => {
  it('uses the exact password-free pooler preflight for standalone production SQL probes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'miraichi-smoke-pooler-'));
    const ctx = fixture();
    const captured: string[][] = [];
    vi.stubGlobal('fetch', ctx.fetcher);
    try {
      await mkdir(path.join(root, 'supabase', 'migrations'), { recursive: true });
      await writeFile(path.join(root, 'supabase', 'migrations', '20260901000000_fixture.sql'), 'select 1;');
      const manifestPath = path.join(root, 'manifest.json');
      await writeFile(manifestPath, JSON.stringify(createReleaseManifest({
        sourceSha: release.gitSha, treeId: 'b'.repeat(40), migrationHash: hash('migrations'),
        webHash: hash('web'), edgeHash: hash('edge'), workerHash: hash('worker'),
        builtAt: '2026-09-30T00:00:00.000Z',
        toolchain: { node: '22.23.3', pnpm: '10.18.3', supabase: '2.109.0', wrangler: '4.128.0' }
      })));
      const report = await runProductionSmokeCli({
        GITHUB_WORKSPACE: root, MIRAICHI_RELEASE_ENVIRONMENT: 'production',
        MIRAICHI_RELEASE_SHA: release.gitSha, MIRAICHI_RELEASE_ARTIFACT: release.artifactVersion,
        MIRAICHI_SCHEMA_COMPAT_VERSION: release.compatibilityVersion,
        MIRAICHI_RELEASE_MANIFEST_PATH: manifestPath, MIRAICHI_PUBLIC_ORIGIN: origin,
        MIRAICHI_EDGE_FUNCTION_URL: edge, MIRAICHI_GATEWAY_TOKEN: 'gateway-token-with-at-least-32-bytes',
        SUPABASE_PROJECT_REF: 'abcdefghijklmnopqrst',
        SUPABASE_DATABASE_URL: 'postgresql://postgres.abcdefghijklmnopqrst:private@aws-3-ap-southeast-1.pooler.supabase.com:5432/postgres'
      }, { run: async (_command, args, options) => {
        captured.push([...args]);
        expect(options?.env?.PGPASSWORD).toBe('private');
        const sql = args.at(-1)!;
        const rows = sql.includes('vault_names') ? [{ target: edge, vault_names: [
          'miraichi_edge_function_url', 'miraichi_edge_gateway_token', 'miraichi_live_refresh_token', 'miraichi_provider_refresh_token'
        ], active_job_names: ['miraichi-current-refresh', 'miraichi-live-refresh', 'miraichi-terminal-refresh'] }]
          : sql.includes('schema_migrations') ? [{ version: '20260901000000' }] : [{ compatible: true }];
        return { stdout: JSON.stringify({ rows }), stderr: '', exitCode: 0 };
      } });
      expect(report.status).toBe('passed');
      expect(captured).toHaveLength(3);
      for (const args of captured) {
        expect(args.slice(1, -1)).toEqual(['db', 'query', '--db-url',
          'postgresql://postgres.abcdefghijklmnopqrst@aws-3-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require',
          '--output', 'json', '--agent', 'yes']);
        expect(JSON.stringify(args)).not.toContain('private');
      }
    } finally {
      vi.unstubAllGlobals();
      await rm(root, { recursive: true, force: true });
    }
  });
  it('proves shell, PWA, release, auth, schema, scheduler, and Singapore region without owner writes', async () => {
    const ctx = fixture();
    const report = await runProductionSmoke(input(ctx.fetcher));
    expect(report).toMatchObject({ status: 'passed', edgeRegion: 'ap-southeast-1', releaseSha: release.gitSha });
    expect(report.schedulerTargetSha256).toBe(hash(edge));
    expect(ctx.calls.every((call) => call.method === 'GET')).toBe(true);
    expect(ctx.calls.some((call) => /\/api\/v1\/(?:backups\/import|bets|bankroll|bet-drafts\?)/u.test(call.url))).toBe(false);
  });

  it('fails closed on wrong Edge region or an exposed direct Edge route', async () => {
    await expect(runProductionSmoke(input(fixture({ region: 'eu-central-1' }).fetcher))).rejects.toMatchObject({ code: 'edge_region_mismatch' });
    await expect(runProductionSmoke(input(fixture({ directDenied: false }).fetcher))).rejects.toMatchObject({ code: 'direct_edge_not_denied' });
  });

  it('fails closed on release, schema, or scheduler mismatch', async () => {
    const releaseMismatch = input(fixture().fetcher);
    releaseMismatch.expectedRelease = { ...release, gitSha: 'b'.repeat(40) };
    await expect(runProductionSmoke(releaseMismatch)).rejects.toMatchObject({ code: 'release_identity_mismatch' });
    const schemaMismatch = input(fixture().fetcher);
    schemaMismatch.schemaProbe = async () => ({ migrationHash: hash('wrong'), compatibilityVersion: 'owner-v3' });
    await expect(runProductionSmoke(schemaMismatch)).rejects.toMatchObject({ code: 'schema_compatibility_mismatch' });
    const schedulerMismatch = input(fixture().fetcher);
    schedulerMismatch.schedulerProbe = async () => ({ target: 'https://wrong.invalid/functions/v1/miraichi-api', vaultNames: [], activeJobNames: [] });
    await expect(runProductionSmoke(schedulerMismatch)).rejects.toMatchObject({ code: 'scheduler_contract_mismatch' });
  });
});
