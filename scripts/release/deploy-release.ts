import { releaseDatabaseConnection, remoteQueryCommand } from './supabase-query.js';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  assertReleaseTargetBindings,
  getReleaseTarget,
  type ReleaseTarget
} from '../../packages/config/src/release-targets.js';
import { readReleaseMetadata, type ReleaseMetadata } from '../../packages/shared/src/contracts/index.js';
import { createCommandRunner, type CommandRunner } from './command-runner.js';
import { assertImmutableId, type DeploymentEvidence, type RuntimeVersions } from './deployment-evidence.js';
import {
  DeploymentFailure,
  runDeployment,
  type DeploymentBackupReceipt,
  type DeploymentPlan,
  type ReleaseOperations
} from './deployment-runtime.js';
import { runProductionSmoke, type ProductionSmokeReport } from './production-smoke.js';
import { createReleaseManifest, type ReleaseManifest } from './release-manifest.js';

export interface CliReleaseConfig {
  readonly root: string;
  readonly target: ReleaseTarget;
  readonly branch: string;
  readonly checkedOutSha: string;
  readonly candidateSha: string;
  readonly manifest: ReleaseManifest;
  readonly artifactVersion: string;
  readonly projectRef: string;
  readonly databaseUrl?: string;
  readonly publicOrigin: string;
  readonly edgeFunctionUrl: string;
  readonly edgeGatewayToken: string;
  readonly priorEdgeArtifactRoot: string;
  readonly priorRelease: ReleaseMetadata;
  readonly priorVersions: RuntimeVersions;
  readonly compatibilityVersion?: string;
  readonly evidencePath?: string;
}

export interface CliReleaseDependencies {
  readonly runner?: CommandRunner;
  readonly backup?: () => Promise<DeploymentBackupReceipt>;
  readonly smoke?: () => Promise<ProductionSmokeReport>;
  readonly recordEvidence?: (evidence: DeploymentEvidence) => Promise<void>;
  readonly env?: NodeJS.ProcessEnv;
}

const PROJECT_REF = /^[a-z]{20}$/u;
const WORKER_VERSION = /(?:Current\s+Version\s+ID|Version\s+ID)\s*:\s*([A-Za-z0-9][A-Za-z0-9._:-]{0,127})/iu;

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function supabaseCli(root: string): string {
  return path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
}

function tsxCli(root: string): string {
  return path.join(root, 'node_modules', 'tsx', 'dist', 'cli.mjs');
}

function pnpmCommand(): string {
  return process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
}

function assertConfig(config: CliReleaseConfig): void {
  assertReleaseTargetBindings(config.target, {
    branch: config.branch,
    edgeRegion: config.target.edgeRegion,
    cloudflareEnvironment: config.target.cloudflareEnvironment,
    publicOrigin: config.publicOrigin,
    edgeFunctionUrl: config.edgeFunctionUrl
  });
  if (config.candidateSha !== config.manifest.sourceSha) {
    throw new Error('Candidate SHA does not match the release manifest');
  }
  if (!/^[a-f0-9]{40}$/u.test(config.checkedOutSha)
    || (config.target.environment === 'staging' && config.checkedOutSha !== config.candidateSha)) {
    throw new Error('Checked-out SHA does not match the approved deployment identity');
  }
  if (!PROJECT_REF.test(config.projectRef)) throw new Error('Supabase project ref is invalid');
  if (!path.isAbsolute(config.root) || !path.isAbsolute(config.priorEdgeArtifactRoot)) {
    throw new Error('Release artifact roots must be absolute');
  }
  if (config.edgeGatewayToken.length < 32) throw new Error('Edge gateway token is invalid');
  const priorRelease = readReleaseMetadata({
    MIRAICHI_RELEASE_ENVIRONMENT: config.priorRelease.environment,
    MIRAICHI_RELEASE_SHA: config.priorRelease.gitSha,
    MIRAICHI_RELEASE_ARTIFACT: config.priorRelease.artifactVersion,
    MIRAICHI_SCHEMA_COMPAT_VERSION: config.priorRelease.compatibilityVersion
  });
  if (priorRelease.environment !== config.target.environment) {
    throw new Error('Prior release environment does not match the approved target');
  }
  assertImmutableId(config.artifactVersion, 'Artifact version');
  assertImmutableId(config.priorVersions.edgeVersionId, 'Prior Edge version');
  assertImmutableId(config.priorVersions.workerVersionId, 'Prior Worker version');
}

function parseJsonRows(output: string): Record<string, unknown>[] {
  const offset = output.indexOf('{');
  if (offset < 0) throw Object.assign(new Error('Query response unavailable'), { code: 'remote_query_invalid' });
  const parsed = JSON.parse(output.slice(offset)) as { rows?: unknown };
  if (!Array.isArray(parsed.rows)) throw Object.assign(new Error('Query response unavailable'), { code: 'remote_query_invalid' });
  return parsed.rows as Record<string, unknown>[];
}

function textArray(value: unknown): string[] {
  if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return [...value];
  if (typeof value === 'string' && value.startsWith('{') && value.endsWith('}')) {
    return value.slice(1, -1).split(',').filter(Boolean).map((item) => item.replace(/^"|"$/gu, ''));
  }
  throw Object.assign(new Error('Query array response unavailable'), { code: 'remote_query_invalid' });
}

async function localMigrationVersions(root: string): Promise<string[]> {
  return (await readdir(path.join(root, 'supabase', 'migrations')))
    .map((file) => /^(\d{14})_[a-z0-9_]+\.sql$/u.exec(file)?.[1])
    .filter((value): value is string => Boolean(value))
    .sort();
}

function expectedRelease(config: CliReleaseConfig): ReleaseMetadata {
  return readReleaseMetadata({
    MIRAICHI_RELEASE_ENVIRONMENT: config.target.environment,
    MIRAICHI_RELEASE_SHA: config.manifest.sourceSha,
    MIRAICHI_RELEASE_ARTIFACT: config.artifactVersion,
    MIRAICHI_SCHEMA_COMPAT_VERSION: config.compatibilityVersion ?? 'owner-v3'
  });
}

function edgeReleaseSecretArgs(projectRef: string, release: ReleaseMetadata): string[] {
  return [
    'secrets', 'set', '--project-ref', projectRef,
    `MIRAICHI_RELEASE_ENVIRONMENT=${release.environment}`,
    `MIRAICHI_RELEASE_SHA=${release.gitSha}`,
    `MIRAICHI_RELEASE_ARTIFACT=${release.artifactVersion}`,
    `MIRAICHI_SCHEMA_COMPAT_VERSION=${release.compatibilityVersion}`
  ];
}

function workerPublicBindingArgs(config: CliReleaseConfig, release: ReleaseMetadata): string[] {
  return [
    '--var', `DEPLOYMENT_ENV:${config.target.environment}`,
    '--var', `MIRAICHI_EDGE_FUNCTION_URL:${config.edgeFunctionUrl}`,
    '--var', `MIRAICHI_PUBLIC_ORIGIN:${config.publicOrigin}`,
    '--var', `MIRAICHI_EDGE_REGION:${config.target.edgeRegion}`,
    '--var', `MIRAICHI_RELEASE_ENVIRONMENT:${release.environment}`,
    '--var', `MIRAICHI_RELEASE_SHA:${release.gitSha}`,
    '--var', `MIRAICHI_RELEASE_ARTIFACT:${release.artifactVersion}`,
    '--var', `MIRAICHI_SCHEMA_COMPAT_VERSION:${release.compatibilityVersion}`
  ];
}

export function createCliReleaseOperations(
  config: CliReleaseConfig,
  dependencies: CliReleaseDependencies = {}
): ReleaseOperations {
  assertConfig(config);
  const runner = dependencies.runner ?? createCommandRunner();
  const env = dependencies.env ?? process.env;
  const database = releaseDatabaseConnection(config, env);
  const migrationTarget = database ? ['--db-url', database.url] : ['--linked'];
  const migrationEnv = database ? { ...env, PGPASSWORD: database.password } : env;
  const runSupabase = (args: readonly string[], commandEnv = env) => runner.run(process.execPath, [supabaseCli(config.root), ...args], {
    cwd: config.root, env: commandEnv, timeoutMs: 10 * 60_000
  });
  const uploadEdgeDatabaseSecret = async () => {
    if (!database) return;
    const url = new URL(database.url);
    url.port = '6543';
    url.password = encodeURIComponent(database.password);
    const directory = await mkdtemp(path.join(os.tmpdir(), 'miraichi-edge-database-'));
    try {
      const envFile = path.join(directory, 'edge.env');
      await writeFile(envFile, `MIRAICHI_DATABASE_URL=${url.toString()}\n`, { mode: 0o600, flag: 'wx' });
      await runSupabase(['secrets', 'set', '--project-ref', config.projectRef, '--env-file', envFile]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  };
  const runWrangler = (args: readonly string[]) => runner.run(pnpmCommand(), [
    '--filter', '@miraichi/cloudflare-gateway', 'exec', 'wrangler', ...args
  ], { cwd: config.root, env, timeoutMs: 10 * 60_000 });
  const queryCommand = remoteQueryCommand(config, env);
  const queryDatabase = async (sql: string): Promise<Record<string, unknown>[]> => {
    const result = await runSupabase([...queryCommand.args, sql], queryCommand.env);
    return parseJsonRows(result.stdout);
  };

  const backup = dependencies.backup ?? (async () => {
    const result = await runner.run(process.execPath, [
      tsxCli(config.root), path.join(config.root, 'scripts', 'release', 'owner-backup-cli.ts'), 'create'
    ], { cwd: config.root, env, timeoutMs: 10 * 60_000 });
    const parsed = JSON.parse(result.stdout) as DeploymentBackupReceipt & { status?: string };
    if (parsed.status !== 'ok') throw Object.assign(new Error('Backup command failed'), { code: 'owner_backup_failed' });
    return {
      receiptId: parsed.receiptId,
      ciphertextSha256: parsed.ciphertextSha256,
      storedBytes: parsed.storedBytes,
      recordCounts: parsed.recordCounts
    };
  });

  const smoke = dependencies.smoke ?? (async () => runProductionSmoke({
    publicOrigin: config.publicOrigin,
    edgeFunctionUrl: config.edgeFunctionUrl,
    edgeGatewayToken: config.edgeGatewayToken,
    expectedRelease: expectedRelease(config),
    expectedManifest: config.manifest,
    expectedRegion: config.target.edgeRegion,
    expectedSchedulerTarget: config.edgeFunctionUrl,
    schedulerProbe: async () => {
      const row = (await queryDatabase(`select
        miraichi_app.edge_scheduler_vault_secret('miraichi_edge_function_url') as target,
        array(select name from vault.secrets where name like 'miraichi_%' order by name) as vault_names,
        array(select jobname from cron.job where jobname like 'miraichi-%' and active order by jobname) as active_job_names`))[0];
      if (!row || typeof row.target !== 'string') throw Object.assign(new Error('Scheduler state unavailable'), { code: 'scheduler_probe_failed' });
      return { target: row.target, vaultNames: textArray(row.vault_names), activeJobNames: textArray(row.active_job_names) };
    },
    schemaProbe: async () => {
      const rows = await queryDatabase('select version from supabase_migrations.schema_migrations order by version');
      const remoteVersions = rows.map((row) => String(row.version));
      const expectedVersions = await localMigrationVersions(config.root);
      if (JSON.stringify(remoteVersions) !== JSON.stringify(expectedVersions)) {
        throw Object.assign(new Error('Migration history mismatch'), { code: 'schema_compatibility_mismatch' });
      }
      const compatibility = (await queryDatabase(`select pg_get_constraintdef(oid) like '%miraichi.cloud-backup.v3%' as compatible
        from pg_constraint where conname='backup_export_log_schema_version_check'`))[0];
      if (compatibility?.compatible !== true) {
        throw Object.assign(new Error('Schema compatibility unavailable'), { code: 'schema_compatibility_mismatch' });
      }
      return { migrationHash: config.manifest.migrationHash, compatibilityVersion: expectedRelease(config).compatibilityVersion };
    }
  }));

  const recordEvidence = dependencies.recordEvidence ?? (async (evidence) => {
    if (!config.evidencePath) throw Object.assign(new Error('Evidence output path is missing'), { code: 'evidence_path_missing' });
    await writeFile(path.resolve(config.evidencePath), `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  });

  return {
    validate: async () => {
      assertConfig(config);
      const gitIdentity = await runner.run('git', ['rev-parse', 'HEAD', 'HEAD^{tree}'], {
        cwd: config.root, env, timeoutMs: 30_000
      });
      const [headSha, treeId] = gitIdentity.stdout.trim().split(/\r?\n/u);
      if (headSha !== config.checkedOutSha || treeId !== config.manifest.treeId) {
        throw Object.assign(new Error('Checked-out Git identity mismatch'), { code: 'release_git_identity_mismatch' });
      }
      await runSupabase(['functions', 'list', '--project-ref', config.projectRef, '--output-format', 'json']);
    },
    backup,
    migrationDryRun: async () => {
      await runSupabase(['db', 'push', ...migrationTarget, '--dry-run', '--include-all', '--yes'], migrationEnv);
    },
    applyMigrations: async () => {
      await runSupabase(['db', 'push', ...migrationTarget, '--include-all', '--yes'], migrationEnv);
    },
    deployEdge: async () => {
      await uploadEdgeDatabaseSecret();
      await runSupabase(edgeReleaseSecretArgs(config.projectRef, expectedRelease(config)));
      await runSupabase(['functions', 'deploy', 'miraichi-api', '--project-ref', config.projectRef, '--use-api', '--workdir', config.root]);
      return { versionId: config.manifest.edgeHash };
    },
    rollbackEdge: async (versionId) => {
      if (versionId !== config.priorVersions.edgeVersionId) throw Object.assign(new Error('Edge rollback version mismatch'), { code: 'edge_rollback_version_mismatch' });
      await runSupabase(edgeReleaseSecretArgs(config.projectRef, config.priorRelease));
      await runSupabase(['functions', 'deploy', 'miraichi-api', '--project-ref', config.projectRef, '--use-api', '--workdir', config.priorEdgeArtifactRoot]);
    },
    deployWorker: async () => {
      const release = expectedRelease(config);
      const result = await runWrangler([
        'deploy', '--env', config.target.cloudflareEnvironment, '--keep-vars', '--strict',
        ...workerPublicBindingArgs(config, release),
        '--message', `release:${config.manifest.sourceSha}`
      ]);
      const versionId = WORKER_VERSION.exec(result.stdout)?.[1];
      if (!versionId) throw Object.assign(new Error('Worker version ID unavailable'), { code: 'worker_version_missing' });
      assertImmutableId(versionId, 'Deployed Worker version');
      return { versionId };
    },
    rollbackWorker: async (versionId) => {
      if (versionId !== config.priorVersions.workerVersionId) throw Object.assign(new Error('Worker rollback version mismatch'), { code: 'worker_rollback_version_mismatch' });
      await runWrangler(['rollback', versionId, '--env', config.target.cloudflareEnvironment, '--yes']);
    },
    configureScheduler: async () => {
      await queryDatabase(`select miraichi_app.configure_hosted_refresh('${config.target.edgeRegion}');`);
      return { targetSha256: sha256(config.edgeFunctionUrl), vaultNames: 4, activeJobs: 3 };
    },
    pauseScheduler: async () => {
      await queryDatabase('select miraichi_app.unschedule_hosted_refresh();');
    },
    smoke,
    recordEvidence
  };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing release configuration: ${name}`);
  return value;
}

async function manifestFromFile(file: string): Promise<ReleaseManifest> {
  const value = JSON.parse(await readFile(path.resolve(file), 'utf8')) as ReleaseManifest;
  return createReleaseManifest({
    sourceSha: value.sourceSha,
    treeId: value.treeId,
    migrationHash: value.migrationHash,
    webHash: value.webHash,
    edgeHash: value.edgeHash,
    workerHash: value.workerHash,
    toolchain: value.toolchain,
    builtAt: value.builtAt
  });
}

export async function runDeployRelease(env: NodeJS.ProcessEnv = process.env): Promise<DeploymentEvidence> {
  const target = getReleaseTarget(required(env, 'MIRAICHI_RELEASE_ENVIRONMENT'));
  const manifest = await manifestFromFile(required(env, 'MIRAICHI_RELEASE_MANIFEST_PATH'));
  const config: CliReleaseConfig = {
    root: path.resolve(env.GITHUB_WORKSPACE?.trim() || process.cwd()),
    target,
    branch: required(env, 'GITHUB_REF_NAME'),
    checkedOutSha: required(env, 'GITHUB_SHA'),
    candidateSha: required(env, 'MIRAICHI_CANDIDATE_SHA'),
    manifest,
    artifactVersion: required(env, 'MIRAICHI_RELEASE_ARTIFACT'),
    projectRef: required(env, 'SUPABASE_PROJECT_REF'),
    ...(env.SUPABASE_DATABASE_URL?.trim() ? { databaseUrl: env.SUPABASE_DATABASE_URL.trim() } : {}),
    publicOrigin: required(env, 'MIRAICHI_PUBLIC_ORIGIN'),
    edgeFunctionUrl: required(env, 'MIRAICHI_EDGE_FUNCTION_URL'),
    edgeGatewayToken: required(env, 'MIRAICHI_GATEWAY_TOKEN'),
    priorEdgeArtifactRoot: path.resolve(required(env, 'MIRAICHI_PRIOR_EDGE_ARTIFACT_ROOT')),
    priorRelease: {
      environment: target.environment,
      gitSha: required(env, 'MIRAICHI_PRIOR_RELEASE_SHA'),
      artifactVersion: required(env, 'MIRAICHI_PRIOR_RELEASE_ARTIFACT'),
      compatibilityVersion: required(env, 'MIRAICHI_PRIOR_SCHEMA_COMPAT_VERSION')
    },
    priorVersions: {
      edgeVersionId: required(env, 'MIRAICHI_PRIOR_EDGE_VERSION_ID'),
      workerVersionId: required(env, 'MIRAICHI_PRIOR_WORKER_VERSION_ID')
    },
    compatibilityVersion: required(env, 'MIRAICHI_SCHEMA_COMPAT_VERSION'),
    evidencePath: path.resolve(required(env, 'MIRAICHI_DEPLOYMENT_EVIDENCE_PATH'))
  };
  const plan: DeploymentPlan = {
    target, manifest, artifactVersion: config.artifactVersion,
    deploymentSha: config.checkedOutSha,
    priorVersions: config.priorVersions
  };
  return runDeployment(plan, createCliReleaseOperations(config, { env }));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void runDeployRelease().then((evidence) => {
    console.log(JSON.stringify({ status: 'passed', evidenceSha256: evidence.evidenceSha256 }));
  }).catch((error) => {
    if (error instanceof DeploymentFailure) console.error(JSON.stringify(error.evidence));
    else console.error(JSON.stringify({ status: 'failed', code: 'release_deploy_failed' }));
    process.exitCode = 1;
  });
}
