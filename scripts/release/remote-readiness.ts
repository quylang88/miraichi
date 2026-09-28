import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface EnvironmentReadiness {
  githubEnvironment: string;
  supabaseProjectRef: string;
  supabaseRegion: string;
  cloudflareWorkerName: string;
  publicOrigin: string;
  edgeFunctionUrl: string;
}

export interface BranchRulesReadiness {
  pullRequestsRequired: boolean;
  conversationsResolved: boolean;
  forcePushBlocked: boolean;
  deletionBlocked: boolean;
  requiredChecks: string[];
}

export interface RemoteReadinessInput {
  supabaseFreeProjectSlots: number;
  staging: EnvironmentReadiness;
  production: EnvironmentReadiness;
  backup: {
    r2BucketName: string;
    r2Endpoint: string;
    bucketPrivate: boolean;
    offlineKeyConfirmed: boolean;
  };
  github: {
    stagingEnvironmentExists: boolean;
    productionEnvironmentExists: boolean;
    stagingRules: BranchRulesReadiness;
    mainRules: BranchRulesReadiness;
  };
}

export interface ReadinessReport {
  readonly status: 'ready' | 'blocked';
  readonly missing: readonly string[];
}

const PROJECT_REF = /^[a-z]{20}$/u;

function isRemoteHttps(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    return url.protocol === 'https:'
      && !['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(host)
      && !host.endsWith('.local');
  } catch {
    return false;
  }
}

function checkEnvironment(
  missing: Set<string>,
  name: 'staging' | 'production',
  value: EnvironmentReadiness
): void {
  if (value.githubEnvironment !== name) missing.add(`${name}.github_environment`);
  if (!PROJECT_REF.test(value.supabaseProjectRef)) missing.add(`${name}.supabase_project_ref`);
  const expectedRegion = name === 'staging' ? 'eu-central-1' : 'ap-southeast-1';
  if (value.supabaseRegion !== expectedRegion) missing.add(`${name}.supabase_region`);
  if (!value.cloudflareWorkerName.trim()) missing.add(`${name}.cloudflare_worker_name`);
  if (!isRemoteHttps(value.publicOrigin)) missing.add(`${name}.public_origin`);
  if (!isRemoteHttps(value.edgeFunctionUrl)) missing.add(`${name}.edge_function_url`);
}

function checkBranchRules(
  missing: Set<string>,
  branch: 'staging' | 'main',
  value: BranchRulesReadiness
): void {
  const prefix = `github.rules.${branch}`;
  if (!value.pullRequestsRequired) missing.add(`${prefix}.pull_requests_required`);
  if (!value.conversationsResolved) missing.add(`${prefix}.conversations_resolved`);
  if (!value.forcePushBlocked) missing.add(`${prefix}.force_push_blocked`);
  if (!value.deletionBlocked) missing.add(`${prefix}.deletion_blocked`);
  if (!value.requiredChecks.includes('quality-gate')) missing.add(`${prefix}.quality_gate`);
  if (branch === 'main' && !value.requiredChecks.includes('release-candidate')) {
    missing.add(`${prefix}.release_candidate`);
  }
}

export function checkRemoteReadiness(input: RemoteReadinessInput): ReadinessReport {
  const missing = new Set<string>();
  checkEnvironment(missing, 'staging', input.staging);
  checkEnvironment(missing, 'production', input.production);

  if (!PROJECT_REF.test(input.production.supabaseProjectRef)
    && (!Number.isSafeInteger(input.supabaseFreeProjectSlots) || input.supabaseFreeProjectSlots < 1)) {
    missing.add('supabase.free_project_slot');
  }

  const isolatedFields: Array<keyof EnvironmentReadiness> = [
    'githubEnvironment', 'supabaseProjectRef', 'cloudflareWorkerName', 'publicOrigin', 'edgeFunctionUrl'
  ];
  const isolationNames: Record<keyof EnvironmentReadiness, string> = {
    githubEnvironment: 'github_environment',
    supabaseProjectRef: 'supabase_project_ref',
    supabaseRegion: 'supabase_region',
    cloudflareWorkerName: 'cloudflare_worker_name',
    publicOrigin: 'public_origin',
    edgeFunctionUrl: 'edge_function_url'
  };
  for (const field of isolatedFields) {
    if (input.staging[field].trim() && input.staging[field] === input.production[field]) {
      missing.add(`isolation.${isolationNames[field]}`);
    }
  }

  if (!input.backup.r2BucketName.trim()) missing.add('backup.r2_bucket_name');
  if (!isRemoteHttps(input.backup.r2Endpoint)
    || !new URL(input.backup.r2Endpoint).hostname.endsWith('.r2.cloudflarestorage.com')) {
    missing.add('backup.r2_endpoint');
  }
  if (!input.backup.bucketPrivate) missing.add('backup.r2_bucket_private');
  if (!input.backup.offlineKeyConfirmed) missing.add('backup.offline_key_confirmation');

  if (!input.github.stagingEnvironmentExists) missing.add('github.environment.staging');
  if (!input.github.productionEnvironmentExists) missing.add('github.environment.production');
  checkBranchRules(missing, 'staging', input.github.stagingRules);
  checkBranchRules(missing, 'main', input.github.mainRules);

  const ordered = [...missing].sort();
  return { status: ordered.length === 0 ? 'ready' : 'blocked', missing: ordered };
}

function fixture(): RemoteReadinessInput {
  return {
    supabaseFreeProjectSlots: 0,
    staging: {
      githubEnvironment: 'staging', supabaseProjectRef: 'a'.repeat(20),
      supabaseRegion: 'eu-central-1', cloudflareWorkerName: 'miraichi-staging',
      publicOrigin: 'https://miraichi-staging.workers.dev',
      edgeFunctionUrl: `https://${'a'.repeat(20)}.supabase.co/functions/v1/miraichi-api`
    },
    production: {
      githubEnvironment: 'production', supabaseProjectRef: 'b'.repeat(20),
      supabaseRegion: 'ap-southeast-1', cloudflareWorkerName: 'miraichi-production',
      publicOrigin: 'https://miraichi-production.workers.dev',
      edgeFunctionUrl: `https://${'b'.repeat(20)}.supabase.co/functions/v1/miraichi-api`
    },
    backup: {
      r2BucketName: 'miraichi-production-backup',
      r2Endpoint: 'https://account.r2.cloudflarestorage.com',
      bucketPrivate: true,
      offlineKeyConfirmed: true
    },
    github: {
      stagingEnvironmentExists: true,
      productionEnvironmentExists: true,
      stagingRules: {
        pullRequestsRequired: true, conversationsResolved: true,
        forcePushBlocked: true, deletionBlocked: true, requiredChecks: ['quality-gate']
      },
      mainRules: {
        pullRequestsRequired: true, conversationsResolved: true,
        forcePushBlocked: true, deletionBlocked: true,
        requiredChecks: ['quality-gate', 'release-candidate']
      }
    }
  };
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void (async () => {
    const argument = process.argv[2];
    if (!argument || process.argv.length !== 3) throw new Error('readiness_input_required');
    const input = argument === '--fixture'
      ? fixture()
      : JSON.parse(await readFile(path.resolve(argument), 'utf8')) as RemoteReadinessInput;
    const report = checkRemoteReadiness(input);
    console.log(JSON.stringify(report));
    if (report.status !== 'ready') process.exitCode = 1;
  })().catch(() => {
    console.error(JSON.stringify({ status: 'blocked', missing: ['readiness.input'] }));
    process.exitCode = 1;
  });
}
