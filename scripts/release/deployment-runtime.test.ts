import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { getReleaseTarget } from '../../packages/config/src/release-targets.js';
import { createReleaseManifest } from './release-manifest.js';
import {
  DeploymentFailure,
  runDeployment,
  type DeploymentPlan,
  type ReleaseOperations
} from './deployment-runtime.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const manifest = createReleaseManifest({
  sourceSha: 'a'.repeat(40), treeId: 'b'.repeat(40), migrationHash: hash('migrations'),
  webHash: hash('web'), edgeHash: hash('edge'), workerHash: hash('worker'),
  toolchain: { node: '22.20.0', pnpm: '10.18.3', supabase: '2.109.0', wrangler: '4.128.0' },
  builtAt: '2026-09-28T00:00:00.000Z'
});
const productionPlan: DeploymentPlan = {
  target: getReleaseTarget('production'), manifest, artifactVersion: 'candidate-a',
  deploymentSha: 'c'.repeat(40),
  priorVersions: { edgeVersionId: 'edge-old', workerVersionId: 'worker-old' }
};

function coded(code: string): Error & { code: string } {
  return Object.assign(new Error('sensitive provider detail'), { code });
}

function fixture(failAt?: string, rollbackFailures: readonly string[] = []) {
  const calls: string[] = [];
  const step = async (name: string) => {
    calls.push(name);
    if (failAt === name || rollbackFailures.includes(name)) throw coded(`${name.replace(/[:]/gu, '_')}_failed`);
  };
  const operations: ReleaseOperations = {
    validate: async () => step('validate'),
    backup: async () => {
      await step('backup');
      return { receiptId: 'receipt-1', ciphertextSha256: hash('cipher'), storedBytes: 512, recordCounts: { ownerProfiles: 1, betDrafts: 1, bets: 1, bankrollAccounts: 1, bankrollLedgerEntries: 1, disciplineConfigs: 1, settlementEvents: 0 } };
    },
    migrationDryRun: async () => step('migrationDryRun'),
    applyMigrations: async () => step('applyMigrations'),
    deployEdge: async () => { await step('deployEdge'); return { versionId: 'edge-new' }; },
    rollbackEdge: async (version) => step(`rollbackEdge:${version}`),
    deployWorker: async () => { await step('deployWorker'); return { versionId: 'worker-new' }; },
    rollbackWorker: async (version) => step(`rollbackWorker:${version}`),
    configureScheduler: async () => { await step('configureScheduler'); return { targetSha256: hash('target'), vaultNames: 4, activeJobs: 3 }; },
    pauseScheduler: async () => step('pauseScheduler'),
    smoke: async (plan) => {
      await step('smoke');
      return { status: 'passed', checks: 10, edgeRegion: plan?.target.edgeRegion ?? 'ap-southeast-1', releaseSha: manifest.sourceSha, schedulerTargetSha256: hash('target') };
    },
    recordEvidence: async () => step('recordEvidence')
  };
  return { calls, operations };
}

describe('deployment transaction', () => {
  it('runs the approved production order and records immutable evidence', async () => {
    const ctx = fixture();
    const evidence = await runDeployment(productionPlan, ctx.operations, {
      now: (() => { let tick = 0; return () => new Date(1_790_553_600_000 + tick++ * 1_000); })()
    });
    expect(ctx.calls).toEqual([
      'validate', 'backup', 'migrationDryRun', 'applyMigrations', 'deployEdge',
      'deployWorker', 'configureScheduler', 'smoke', 'recordEvidence'
    ]);
    expect(evidence).toMatchObject({ status: 'succeeded', runtime: { edgeVersionId: 'edge-new', workerVersionId: 'worker-new' } });
  });

  it('uses the same path for staging but skips the production-only backup', async () => {
    const ctx = fixture();
    await runDeployment({ ...productionPlan, target: getReleaseTarget('staging') }, ctx.operations);
    expect(ctx.calls).not.toContain('backup');
    expect(ctx.calls).toEqual([
      'validate', 'migrationDryRun', 'applyMigrations', 'deployEdge',
      'deployWorker', 'configureScheduler', 'smoke', 'recordEvidence'
    ]);
  });

  it.each([
    ['validate', ['validate', 'recordEvidence']],
    ['backup', ['validate', 'backup', 'recordEvidence']],
    ['migrationDryRun', ['validate', 'backup', 'migrationDryRun', 'recordEvidence']],
    ['applyMigrations', ['validate', 'backup', 'migrationDryRun', 'applyMigrations', 'recordEvidence']],
    ['deployEdge', ['validate', 'backup', 'migrationDryRun', 'applyMigrations', 'deployEdge', 'rollbackEdge:edge-old', 'recordEvidence']],
    ['deployWorker', ['validate', 'backup', 'migrationDryRun', 'applyMigrations', 'deployEdge', 'deployWorker', 'rollbackWorker:worker-old', 'rollbackEdge:edge-old', 'recordEvidence']],
    ['configureScheduler', ['validate', 'backup', 'migrationDryRun', 'applyMigrations', 'deployEdge', 'deployWorker', 'configureScheduler', 'pauseScheduler', 'rollbackWorker:worker-old', 'rollbackEdge:edge-old', 'recordEvidence']],
    ['smoke', ['validate', 'backup', 'migrationDryRun', 'applyMigrations', 'deployEdge', 'deployWorker', 'configureScheduler', 'smoke', 'pauseScheduler', 'rollbackWorker:worker-old', 'rollbackEdge:edge-old', 'recordEvidence']],
    ['recordEvidence', ['validate', 'backup', 'migrationDryRun', 'applyMigrations', 'deployEdge', 'deployWorker', 'configureScheduler', 'smoke', 'recordEvidence', 'pauseScheduler', 'rollbackWorker:worker-old', 'rollbackEdge:edge-old', 'recordEvidence']]
  ])('stops and compensates safely when %s fails', async (stage, expectedCalls) => {
    const ctx = fixture(stage);
    await expect(runDeployment(productionPlan, ctx.operations)).rejects.toBeInstanceOf(DeploymentFailure);
    expect(ctx.calls).toEqual(expectedCalls);
  });

  it('preserves the primary and every rollback error code without attempting schema rollback', async () => {
    const ctx = fixture('smoke', ['pauseScheduler', 'rollbackWorker:worker-old', 'rollbackEdge:edge-old']);
    let failure: DeploymentFailure | undefined;
    try { await runDeployment(productionPlan, ctx.operations); } catch (error) { failure = error as DeploymentFailure; }
    expect(failure?.evidence).toMatchObject({
      failedStage: 'smoke', primaryErrorCode: 'smoke_failed',
      rollbackErrorCodes: ['scheduler_pause_failed', 'worker_rollback_failed', 'edge_rollback_failed']
    });
    expect(ctx.calls.some((call) => /migration.*rollback/iu.test(call))).toBe(false);
  });

  it('rejects unqualified latest rollback identities before any operation', async () => {
    const ctx = fixture();
    await expect(runDeployment({
      ...productionPlan, priorVersions: { ...productionPlan.priorVersions, workerVersionId: 'latest' }
    }, ctx.operations)).rejects.toThrow('immutable');
    expect(ctx.calls).toEqual([]);
  });
});
