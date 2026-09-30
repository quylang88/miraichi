import { remoteQueryCommand } from './supabase-query.js';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getReleaseTarget, type ReleaseEdgeRegion } from '../../packages/config/src/release-targets.js';
import { readReleaseMetadata, type ReleaseMetadata } from '../../packages/shared/src/contracts/index.js';
import { createCommandRunner, type CommandRunner } from './command-runner.js';
import { createReleaseManifest, type ReleaseManifest } from './release-manifest.js';

export interface ProductionSmokeReport {
  readonly status: 'passed';
  readonly checks: number;
  readonly edgeRegion: ReleaseEdgeRegion;
  readonly releaseSha: string;
  readonly schedulerTargetSha256: string;
}

export interface SchedulerSmokeState {
  readonly target: string;
  readonly vaultNames: readonly string[];
  readonly activeJobNames: readonly string[];
}

export interface SchemaSmokeState {
  readonly migrationHash: string;
  readonly compatibilityVersion: string;
}

export interface ProductionSmokeInput {
  readonly publicOrigin: string;
  readonly edgeFunctionUrl: string;
  readonly edgeGatewayToken: string;
  readonly expectedRelease: ReleaseMetadata;
  readonly expectedManifest: {
    readonly sourceSha: string;
    readonly migrationHash: string;
    readonly webHash: string;
  };
  readonly expectedRegion: ReleaseEdgeRegion;
  readonly expectedSchedulerTarget: string;
  readonly schedulerProbe: () => Promise<SchedulerSmokeState>;
  readonly schemaProbe: () => Promise<SchemaSmokeState>;
  readonly fetcher?: typeof fetch;
}

export class ProductionSmokeError extends Error {
  constructor(readonly code: string) {
    super('Production smoke failed');
    this.name = 'ProductionSmokeError';
  }
}

const EXPECTED_VAULT_NAMES = [
  'miraichi_edge_function_url',
  'miraichi_edge_gateway_token',
  'miraichi_live_refresh_token',
  'miraichi_provider_refresh_token'
] as const;
const EXPECTED_JOB_NAMES = [
  'miraichi-current-refresh',
  'miraichi-live-refresh',
  'miraichi-terminal-refresh'
] as const;

function fail(code: string): never {
  throw new ProductionSmokeError(code);
}

function normalizedHttps(value: string, label: string): string {
  let parsed: URL;
  try { parsed = new URL(value); } catch { return fail(`${label}_invalid`); }
  if (parsed.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    return fail(`${label}_invalid`);
  }
  return parsed.toString().replace(/\/+$/u, '');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function releaseEquals(actual: ReleaseMetadata, expected: ReleaseMetadata): boolean {
  return actual.environment === expected.environment
    && actual.gitSha === expected.gitSha
    && actual.artifactVersion === expected.artifactVersion
    && actual.compatibilityVersion === expected.compatibilityVersion;
}

function releaseFromHeaders(headers: Headers): ReleaseMetadata {
  return readReleaseMetadata({
    MIRAICHI_RELEASE_ENVIRONMENT: headers.get('x-miraichi-release-environment') ?? '',
    MIRAICHI_RELEASE_SHA: headers.get('x-miraichi-release-sha') ?? '',
    MIRAICHI_RELEASE_ARTIFACT: headers.get('x-miraichi-release-artifact') ?? '',
    MIRAICHI_SCHEMA_COMPAT_VERSION: headers.get('x-miraichi-compatibility-version') ?? ''
  });
}

async function bodyText(response: Response, code: string): Promise<string> {
  if (!response.ok) fail(code);
  return await response.text();
}

function join(base: string, pathname: string): string {
  return `${base}${pathname.startsWith('/') ? pathname : `/${pathname}`}`;
}

export async function runProductionSmoke(input: ProductionSmokeInput): Promise<ProductionSmokeReport> {
  const publicOrigin = normalizedHttps(input.publicOrigin, 'public_origin');
  const edgeFunctionUrl = normalizedHttps(input.edgeFunctionUrl, 'edge_function_url');
  const expectedTarget = normalizedHttps(input.expectedSchedulerTarget, 'scheduler_target');
  if (input.expectedRelease.gitSha !== input.expectedManifest.sourceSha) {
    fail('release_identity_mismatch');
  }
  if (input.edgeGatewayToken.length < 32) fail('gateway_token_invalid');
  const fetcher = input.fetcher ?? fetch;
  const get = (url: string, headers: Record<string, string> = {}) => fetcher(url, {
    method: 'GET',
    headers: { 'Cache-Control': 'no-cache', ...headers },
    redirect: 'manual'
  });

  const shell = await get(join(publicOrigin, '/'));
  const shellBody = await bodyText(shell, 'shell_unavailable');
  if (!/<html\b/iu.test(shellBody) || !shellBody.includes('auth-bootstrap') || !shellBody.includes('app-root')) {
    fail('shell_contract_mismatch');
  }
  try {
    if (!releaseEquals(releaseFromHeaders(shell.headers), input.expectedRelease)) fail('release_identity_mismatch');
  } catch { fail('release_identity_mismatch'); }

  const webManifestResponse = await get(join(publicOrigin, '/manifest.webmanifest'));
  const webManifest = JSON.parse(await bodyText(webManifestResponse, 'web_manifest_unavailable')) as Record<string, unknown>;
  if (webManifest.name !== 'Miraichi' || webManifest.start_url !== '/') fail('web_manifest_contract_mismatch');

  const serviceWorker = await bodyText(
    await get(join(publicOrigin, '/service-worker.js')),
    'service_worker_unavailable'
  );
  if (!serviceWorker.includes(`miraichi-shell-${input.expectedManifest.webHash}`)) {
    fail('service_worker_identity_mismatch');
  }

  const releaseResponse = await get(join(publicOrigin, '/release.json'));
  const releaseFile = JSON.parse(await bodyText(releaseResponse, 'release_file_unavailable')) as Partial<ReleaseMetadata>;
  const publicRelease = readReleaseMetadata({
    MIRAICHI_RELEASE_ENVIRONMENT: releaseFile.environment,
    MIRAICHI_RELEASE_SHA: releaseFile.gitSha,
    MIRAICHI_RELEASE_ARTIFACT: releaseFile.artifactVersion,
    MIRAICHI_SCHEMA_COMPAT_VERSION: releaseFile.compatibilityVersion
  });
  if (!releaseEquals(publicRelease, input.expectedRelease)) fail('release_identity_mismatch');

  const healthResponse = await get(join(publicOrigin, '/api/v1/health'));
  const health = JSON.parse(await bodyText(healthResponse, 'same_origin_health_failed')) as {
    status?: string;
    release?: ReleaseMetadata;
  };
  if (health.status !== 'ok' || !health.release || !releaseEquals(health.release, input.expectedRelease)) {
    fail('release_identity_mismatch');
  }
  try {
    if (!releaseEquals(releaseFromHeaders(healthResponse.headers), input.expectedRelease)) fail('release_identity_mismatch');
  } catch { fail('release_identity_mismatch'); }

  const unauthenticated = await get(join(publicOrigin, '/api/v1/bet-drafts'));
  if (unauthenticated.status !== 401) fail('same_origin_auth_not_denied');

  const directDenied = await get(join(edgeFunctionUrl, '/api/v1/health'));
  if (![401, 403].includes(directDenied.status)) fail('direct_edge_not_denied');

  const directHealth = await get(join(edgeFunctionUrl, '/api/v1/health'), {
    'x-miraichi-gateway-token': input.edgeGatewayToken,
    'x-region': input.expectedRegion
  });
  const directHealthBody = JSON.parse(await bodyText(directHealth, 'direct_edge_health_failed')) as {
    status?: string;
    release?: ReleaseMetadata;
  };
  if (directHealthBody.status !== 'ok' || !directHealthBody.release
    || !releaseEquals(directHealthBody.release, input.expectedRelease)) fail('release_identity_mismatch');
  if (directHealth.headers.get('x-sb-edge-region') !== input.expectedRegion) fail('edge_region_mismatch');

  const [scheduler, schema] = await Promise.all([input.schedulerProbe(), input.schemaProbe()]);
  const vaultNames = [...scheduler.vaultNames].sort();
  const activeJobs = [...scheduler.activeJobNames].sort();
  if (normalizedHttps(scheduler.target, 'scheduler_target') !== expectedTarget
    || JSON.stringify(vaultNames) !== JSON.stringify([...EXPECTED_VAULT_NAMES].sort())
    || JSON.stringify(activeJobs) !== JSON.stringify([...EXPECTED_JOB_NAMES].sort())) {
    fail('scheduler_contract_mismatch');
  }
  if (schema.migrationHash !== input.expectedManifest.migrationHash
    || schema.compatibilityVersion !== input.expectedRelease.compatibilityVersion) {
    fail('schema_compatibility_mismatch');
  }

  return {
    status: 'passed',
    checks: 10,
    edgeRegion: input.expectedRegion,
    releaseSha: input.expectedRelease.gitSha,
    schedulerTargetSha256: sha256(expectedTarget)
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new ProductionSmokeError('production_smoke_configuration_missing');
  return value;
}

function parseJsonRows(output: string): Record<string, unknown>[] {
  const offset = output.indexOf('{');
  if (offset < 0) fail('remote_query_invalid');
  const parsed = JSON.parse(output.slice(offset)) as { rows?: unknown };
  if (!Array.isArray(parsed.rows)) fail('remote_query_invalid');
  return parsed.rows as Record<string, unknown>[];
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return [...value];
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1).split(',').filter(Boolean).map((item) => item.replace(/^"|"$/gu, ''));
  }
  return fail('remote_query_invalid');
}

async function readManifest(file: string): Promise<ReleaseManifest> {
  const value = JSON.parse(await readFile(path.resolve(file), 'utf8')) as ReleaseManifest;
  return createReleaseManifest({
    sourceSha: value.sourceSha, treeId: value.treeId, migrationHash: value.migrationHash,
    webHash: value.webHash, edgeHash: value.edgeHash, workerHash: value.workerHash,
    toolchain: value.toolchain, builtAt: value.builtAt
  });
}

async function migrationVersions(root: string): Promise<string[]> {
  return (await readdir(path.join(root, 'supabase', 'migrations')))
    .map((file) => /^(\d{14})_[a-z0-9_]+\.sql$/u.exec(file)?.[1])
    .filter((value): value is string => Boolean(value))
    .sort();
}

export async function runProductionSmokeCli(
  env: NodeJS.ProcessEnv = process.env,
  runner: CommandRunner = createCommandRunner()
): Promise<ProductionSmokeReport> {
  const target = getReleaseTarget(required(env, 'MIRAICHI_RELEASE_ENVIRONMENT'));
  if (target.environment !== 'production') throw new ProductionSmokeError('production_environment_required');
  const root = path.resolve(env.GITHUB_WORKSPACE?.trim() || process.cwd());
  const manifest = await readManifest(required(env, 'MIRAICHI_RELEASE_MANIFEST_PATH'));
  const expectedReleaseMetadata = readReleaseMetadata(env);
  const queryCommand = remoteQueryCommand({ projectRef: env.SUPABASE_PROJECT_REF ?? '',
    ...(env.SUPABASE_DATABASE_URL?.trim() ? { databaseUrl: env.SUPABASE_DATABASE_URL.trim() } : {}) }, env);
  const runQuery = async (sql: string) => {
    const result = await runner.run(process.execPath, [
      path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js'),
      ...queryCommand.args, sql
    ], { cwd: root, env: queryCommand.env, timeoutMs: 120_000 });
    return parseJsonRows(result.stdout);
  };
  const edgeFunctionUrl = required(env, 'MIRAICHI_EDGE_FUNCTION_URL');
  return runProductionSmoke({
    publicOrigin: required(env, 'MIRAICHI_PUBLIC_ORIGIN'),
    edgeFunctionUrl,
    edgeGatewayToken: required(env, 'MIRAICHI_GATEWAY_TOKEN'),
    expectedRelease: expectedReleaseMetadata,
    expectedManifest: manifest,
    expectedRegion: target.edgeRegion,
    expectedSchedulerTarget: edgeFunctionUrl,
    schedulerProbe: async () => {
      const row = (await runQuery(`select
        miraichi_app.edge_scheduler_vault_secret('miraichi_edge_function_url') as target,
        array(select name from vault.secrets where name like 'miraichi_%' order by name) as vault_names,
        array(select jobname from cron.job where jobname like 'miraichi-%' and active order by jobname) as active_job_names`))[0];
      if (!row || typeof row.target !== 'string') fail('scheduler_probe_failed');
      return { target: row.target, vaultNames: textArray(row.vault_names), activeJobNames: textArray(row.active_job_names) };
    },
    schemaProbe: async () => {
      const expectedVersions = await migrationVersions(root);
      const remoteVersions = (await runQuery('select version from supabase_migrations.schema_migrations order by version'))
        .map((row) => String(row.version));
      if (JSON.stringify(remoteVersions) !== JSON.stringify(expectedVersions)) fail('schema_compatibility_mismatch');
      const row = (await runQuery(`select pg_get_constraintdef(oid) like '%miraichi.cloud-backup.v3%' as compatible
        from pg_constraint where conname='backup_export_log_schema_version_check'`))[0];
      if (row?.compatible !== true) fail('schema_compatibility_mismatch');
      return { migrationHash: manifest.migrationHash, compatibilityVersion: expectedReleaseMetadata.compatibilityVersion };
    }
  });
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void runProductionSmokeCli().then((report) => {
    console.log(JSON.stringify(report));
  }).catch((error) => {
    console.error(JSON.stringify({
      status: 'failed',
      code: error instanceof ProductionSmokeError ? error.code : 'production_smoke_failed'
    }));
    process.exitCode = 1;
  });
}
