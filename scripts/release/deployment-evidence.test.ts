import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createReleaseManifest } from './release-manifest.js';
import {
  createDeploymentEvidence,
  createDeploymentFailureEvidence,
  verifyDeploymentEvidence
} from './deployment-evidence.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const manifest = createReleaseManifest({
  sourceSha: 'a'.repeat(40), treeId: 'b'.repeat(40), migrationHash: hash('migrations'),
  webHash: hash('web'), edgeHash: hash('edge'), workerHash: hash('worker'),
  toolchain: { node: '22.20.0', pnpm: '10.18.3', supabase: '2.109.0', wrangler: '4.128.0' },
  builtAt: '2026-09-28T00:00:00.000Z'
});

describe('deployment evidence', () => {
  it('records only immutable release identifiers and sanitized backup/smoke facts', async () => {
    const evidence = await createDeploymentEvidence({
      environment: 'production', manifest, artifactVersion: 'candidate-a',
      deploymentSha: 'c'.repeat(40),
      priorVersions: { edgeVersionId: 'edge-old', workerVersionId: 'worker-old' },
      deployedVersions: { edgeVersionId: 'edge-new', workerVersionId: 'worker-new' },
      edgeRegion: 'ap-southeast-1',
      backup: {
        receiptId: 'receipt-1', ciphertextSha256: hash('cipher'), storedBytes: 512,
        recordCounts: { ownerProfiles: 1, betDrafts: 1, bets: 1, bankrollAccounts: 1, bankrollLedgerEntries: 1, disciplineConfigs: 1, settlementEvents: 0 }
      },
      scheduler: { targetSha256: hash('target'), vaultNames: 4, activeJobs: 3 },
      smoke: { status: 'passed', checks: 10, edgeRegion: 'ap-southeast-1', releaseSha: manifest.sourceSha, schedulerTargetSha256: hash('target') },
      startedAt: '2026-09-28T00:01:00.000Z', completedAt: '2026-09-28T00:02:00.000Z'
    });
    expect(evidence).toMatchObject({
      schemaVersion: 'miraichi.deployment-evidence.v1', status: 'succeeded',
      release: { deploymentSha: 'c'.repeat(40), sourceSha: manifest.sourceSha, migrationHash: manifest.migrationHash },
      runtime: { edgeVersionId: 'edge-new', workerVersionId: 'worker-new', edgeRegion: 'ap-southeast-1' }
    });
    expect(JSON.stringify(evidence)).not.toContain('objectKey');
    expect(await verifyDeploymentEvidence(evidence)).toBe(true);
    expect(await verifyDeploymentEvidence({ ...evidence, runtime: { ...evidence.runtime, workerVersionId: 'changed' } })).toBe(false);
  });

  it('preserves only safe primary and rollback error codes for failed transactions', async () => {
    const evidence = await createDeploymentFailureEvidence({
      environment: 'production', manifest, artifactVersion: 'candidate-a',
      deploymentSha: 'c'.repeat(40),
      failedStage: 'smoke', primaryErrorCode: 'smoke_probe_failed',
      rollbackErrorCodes: ['scheduler_pause_failed', 'worker_rollback_failed'],
      completedStages: ['validate', 'backup', 'migration_dry_run', 'migration_apply', 'edge_deploy', 'worker_deploy', 'scheduler_configure'],
      startedAt: '2026-09-28T00:01:00.000Z', completedAt: '2026-09-28T00:02:00.000Z'
    });
    expect(evidence).toMatchObject({ status: 'failed', failedStage: 'smoke', primaryErrorCode: 'smoke_probe_failed' });
    expect(JSON.stringify(evidence)).not.toContain('message');
    expect(await verifyDeploymentEvidence(evidence)).toBe(true);
  });
});
