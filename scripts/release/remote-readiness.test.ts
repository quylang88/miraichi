import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  checkRemoteReadiness,
  type RemoteReadinessInput
} from './remote-readiness.js';

function validInput(): RemoteReadinessInput {
  return {
    supabaseFreeProjectSlots: 0,
    staging: {
      githubEnvironment: 'staging',
      supabaseProjectRef: 'a'.repeat(20),
      supabaseRegion: 'eu-central-1',
      cloudflareWorkerName: 'miraichi-owner-staging',
      publicOrigin: 'https://miraichi-owner-staging.workers.dev',
      edgeFunctionUrl: `https://${'a'.repeat(20)}.supabase.co/functions/v1/miraichi-api`
    },
    production: {
      githubEnvironment: 'production',
      supabaseProjectRef: 'b'.repeat(20),
      supabaseRegion: 'ap-southeast-1',
      cloudflareWorkerName: 'miraichi-owner-production',
      publicOrigin: 'https://miraichi-owner-production.workers.dev',
      edgeFunctionUrl: `https://${'b'.repeat(20)}.supabase.co/functions/v1/miraichi-api`
    },
    backup: {
      r2BucketName: 'miraichi-owner-production-backup',
      r2Endpoint: 'https://account.r2.cloudflarestorage.com',
      bucketPrivate: true,
      offlineKeyConfirmed: true
    },
    github: {
      stagingEnvironmentExists: true,
      productionEnvironmentExists: true,
      stagingRules: {
        pullRequestsRequired: true,
        conversationsResolved: true,
        forcePushBlocked: true,
        deletionBlocked: true,
        requiredChecks: ['quality-gate']
      },
      mainRules: {
        pullRequestsRequired: true,
        conversationsResolved: true,
        forcePushBlocked: true,
        deletionBlocked: true,
        requiredChecks: ['quality-gate', 'release-candidate']
      }
    }
  };
}

describe('remote production readiness', () => {
  it('accepts only the fully isolated Frankfurt staging and Singapore production fixture', () => {
    expect(checkRemoteReadiness(validInput())).toEqual({ status: 'ready', missing: [] });
  });

  it('blocks a missing production project when no free Supabase slot exists', () => {
    const input = validInput();
    input.production.supabaseProjectRef = '';
    expect(checkRemoteReadiness(input)).toEqual({
      status: 'blocked',
      missing: ['production.supabase_project_ref', 'supabase.free_project_slot']
    });
  });

  it('blocks wrong regions, public or missing R2, missing offline key proof, and localhost production URLs', () => {
    const input = validInput();
    input.staging.supabaseRegion = 'ap-northeast-1';
    input.production.supabaseRegion = 'ap-northeast-1';
    input.production.publicOrigin = 'http://localhost:8787';
    input.production.edgeFunctionUrl = 'http://127.0.0.1:54321/functions/v1/miraichi-api';
    input.backup.r2BucketName = '';
    input.backup.bucketPrivate = false;
    input.backup.offlineKeyConfirmed = false;
    expect(checkRemoteReadiness(input).missing).toEqual([
      'backup.offline_key_confirmation',
      'backup.r2_bucket_name',
      'backup.r2_bucket_private',
      'production.edge_function_url',
      'production.public_origin',
      'production.supabase_region',
      'staging.supabase_region'
    ]);
  });

  it('blocks missing GitHub environments and every incomplete branch rule', () => {
    const input = validInput();
    input.github.stagingEnvironmentExists = false;
    input.github.productionEnvironmentExists = false;
    input.github.stagingRules.pullRequestsRequired = false;
    input.github.stagingRules.conversationsResolved = false;
    input.github.stagingRules.forcePushBlocked = false;
    input.github.stagingRules.deletionBlocked = false;
    input.github.stagingRules.requiredChecks = [];
    input.github.mainRules.requiredChecks = ['quality-gate'];
    expect(checkRemoteReadiness(input).missing).toEqual([
      'github.environment.production',
      'github.environment.staging',
      'github.rules.main.release_candidate',
      'github.rules.staging.conversations_resolved',
      'github.rules.staging.deletion_blocked',
      'github.rules.staging.force_push_blocked',
      'github.rules.staging.pull_requests_required',
      'github.rules.staging.quality_gate'
    ]);
  });

  it.each([
    'githubEnvironment', 'supabaseProjectRef', 'cloudflareWorkerName', 'publicOrigin', 'edgeFunctionUrl'
  ] as const)('blocks a shared staging/production %s without returning either value', (field) => {
    const input = validInput();
    input.production[field] = input.staging[field];
    const serialized = JSON.stringify(checkRemoteReadiness(input));
    expect(serialized).toContain(`isolation.${field.replace(/[A-Z]/gu, (letter) => `_${letter.toLowerCase()}`)}`);
    expect(serialized).not.toContain(input.staging[field]);
  });

  it('ships enforceable owner-only ruleset templates with exact required checks', () => {
    const staging = JSON.parse(readFileSync('docs/operations/github/staging-ruleset.json', 'utf8')) as {
      conditions: { ref_name: { include: string[] } };
      rules: Array<{ type: string; parameters?: { required_review_thread_resolution?: boolean; required_status_checks?: Array<{ context: string }> } }>;
    };
    const main = JSON.parse(readFileSync('docs/operations/github/main-ruleset.json', 'utf8')) as typeof staging;
    const assertRuleset = (value: typeof staging, branch: string, checks: string[]) => {
      expect(value.conditions.ref_name.include).toEqual([`refs/heads/${branch}`]);
      expect(value.rules.map((rule) => rule.type)).toEqual(expect.arrayContaining([
        'deletion', 'non_fast_forward', 'pull_request', 'required_status_checks'
      ]));
      expect(value.rules.find((rule) => rule.type === 'pull_request')?.parameters?.required_review_thread_resolution).toBe(true);
      expect(value.rules.find((rule) => rule.type === 'required_status_checks')?.parameters?.required_status_checks)
        .toEqual(checks.map((context) => ({ context })));
    };
    assertRuleset(staging, 'staging', ['quality-gate']);
    assertRuleset(main, 'main', ['quality-gate', 'release-candidate']);
  });

  it('documents the approved delivery, recovery, cost, and clean-production boundaries', () => {
    const delivery = readFileSync('docs/operations/PRODUCTION-DELIVERY.md', 'utf8');
    const recovery = readFileSync('docs/operations/OWNER-DATA-RECOVERY.md', 'utf8');
    const operationsIndex = readFileSync('docs/operations/README.md', 'utf8');
    const runbook = readFileSync('docs/operations/RUNBOOK.md', 'utf8');
    const environments = readFileSync('docs/operations/DEPLOYMENT-AND-ENVIRONMENTS.md', 'utf8');
    const architecture = readFileSync('ARCHITECTURE.md', 'utf8');
    const releaseWorkflow = readFileSync('docs/workflows/release-workflow.md', 'utf8');
    const historicalHosting = readFileSync('docs/operations/SUPABASE-EDGE-CLOUDFLARE-OWNER-HOSTING.md', 'utf8');
    const envTemplate = readFileSync('.env.example', 'utf8');

    for (const marker of [
      'ap-southeast-1', 'main -> staging -> main', 'zero production owner rows',
      'synthetic owner rows', 'quality-gate', 'release-candidate', 'usage-billed',
      'no point-in-time recovery', 'no uptime SLA'
    ]) expect(delivery).toContain(marker);
    for (const marker of [
      'approximately 24 hours', 'forward-only', 'OWNER_BACKUP_KEY_BASE64',
      'offline', 'backup:owner:restore-local', 'supabase db reset --linked'
    ]) expect(recovery).toContain(marker);
    for (const marker of ['PRODUCTION-DELIVERY.md', 'OWNER-DATA-RECOVERY.md']) {
      expect(operationsIndex).toContain(marker);
      expect(runbook).toContain(marker);
    }
    expect(environments).toContain('eu-central-1');
    expect(environments).toContain('ap-southeast-1');
    expect(architecture).toContain('Singapore `ap-southeast-1`');
    expect(releaseWorkflow).toContain('protected `staging`');
    expect(releaseWorkflow).not.toContain('uses Cloudflare Pages project `miraichi-staging`');
    expect(historicalHosting).toContain('Superseded historical Frankfurt-to-Tokyo procedure');
    for (const name of [
      'MIRAICHI_STAGING_SUPABASE_PROJECT_REF', 'MIRAICHI_PRODUCTION_SUPABASE_PROJECT_REF',
      'MIRAICHI_PRODUCTION_R2_BUCKET', 'MIRAICHI_OFFLINE_BACKUP_KEY_CONFIRMED'
    ]) expect(envTemplate).toContain(name);
  });
});
