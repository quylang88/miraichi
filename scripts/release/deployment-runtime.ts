import { getReleaseTarget, type ReleaseTarget } from '../../packages/config/src/release-targets.js';
import type { CloudBackupRecordCounts } from '../../packages/shared/src/contracts/index.js';
import {
  assertImmutableId,
  createDeploymentEvidence,
  createDeploymentFailureEvidence,
  type DeploymentEvidence,
  type DeploymentStage,
  type FailedDeploymentEvidence,
  type RecordedBackupEvidence,
  type RecordedSchedulerEvidence,
  type RecordedSmokeEvidence,
  type RuntimeVersions,
  type SuccessfulDeploymentEvidence
} from './deployment-evidence.js';
import type { ReleaseManifest } from './release-manifest.js';

export interface DeploymentPlan {
  readonly target: ReleaseTarget;
  readonly manifest: ReleaseManifest;
  readonly artifactVersion: string;
  readonly deploymentSha: string;
  readonly priorVersions: RuntimeVersions;
}

export interface DeploymentBackupReceipt {
  readonly receiptId: string;
  readonly ciphertextSha256: string;
  readonly storedBytes: number;
  readonly recordCounts: CloudBackupRecordCounts;
}

export interface RuntimeDeploymentReceipt {
  readonly versionId: string;
}

export interface ReleaseOperations {
  validate(plan?: DeploymentPlan): Promise<void>;
  backup(plan?: DeploymentPlan): Promise<DeploymentBackupReceipt>;
  migrationDryRun(plan?: DeploymentPlan): Promise<void>;
  applyMigrations(plan?: DeploymentPlan): Promise<void>;
  deployEdge(plan?: DeploymentPlan): Promise<RuntimeDeploymentReceipt>;
  rollbackEdge(versionId: string): Promise<void>;
  deployWorker(plan?: DeploymentPlan): Promise<RuntimeDeploymentReceipt>;
  rollbackWorker(versionId: string): Promise<void>;
  configureScheduler(plan?: DeploymentPlan): Promise<RecordedSchedulerEvidence>;
  pauseScheduler(plan?: DeploymentPlan): Promise<void>;
  smoke(plan?: DeploymentPlan): Promise<RecordedSmokeEvidence>;
  recordEvidence(evidence: DeploymentEvidence): Promise<void>;
}

export class DeploymentFailure extends Error {
  constructor(readonly evidence: FailedDeploymentEvidence) {
    super('Release deployment failed');
    this.name = 'DeploymentFailure';
  }
}

const STAGE_ERROR: Readonly<Record<DeploymentStage, string>> = {
  validate: 'release_validation_failed',
  backup: 'owner_backup_failed',
  migration_dry_run: 'migration_dry_run_failed',
  migration_apply: 'migration_apply_failed',
  edge_deploy: 'edge_deploy_failed',
  worker_deploy: 'worker_deploy_failed',
  scheduler_configure: 'scheduler_configure_failed',
  smoke: 'smoke_failed',
  evidence_record: 'evidence_record_failed'
};
const SAFE_CODE = /^[a-z][a-z0-9_]{2,63}$/u;

function safeErrorCode(error: unknown, fallback: string): string {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === 'string' && SAFE_CODE.test(code)) return code;
  }
  return fallback;
}

function assertPlan(plan: DeploymentPlan): void {
  const approved = getReleaseTarget(plan.target.environment);
  if (JSON.stringify(plan.target) !== JSON.stringify(approved)) {
    throw new Error('Deployment target must match the approved immutable target');
  }
  assertImmutableId(plan.artifactVersion, 'Artifact version');
  if (!/^[a-f0-9]{40}$/u.test(plan.deploymentSha)) throw new Error('Deployment SHA must be immutable');
  assertImmutableId(plan.priorVersions.edgeVersionId, 'Prior Edge version');
  assertImmutableId(plan.priorVersions.workerVersionId, 'Prior Worker version');
}

export async function runDeployment(
  plan: DeploymentPlan,
  operations: ReleaseOperations,
  options: { readonly now?: () => Date } = {}
): Promise<SuccessfulDeploymentEvidence> {
  assertPlan(plan);
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();
  const completedStages: DeploymentStage[] = [];
  let activeStage: DeploymentStage = 'validate';
  let backup: RecordedBackupEvidence | null = null;
  let edge: RuntimeDeploymentReceipt | undefined;
  let worker: RuntimeDeploymentReceipt | undefined;
  let scheduler: RecordedSchedulerEvidence | undefined;
  let schedulerAttempted = false;

  const complete = <T>(stage: DeploymentStage, value: T): T => {
    completedStages.push(stage);
    return value;
  };

  try {
    activeStage = 'validate';
    await operations.validate(plan);
    complete(activeStage, undefined);

    if (plan.target.requiresOwnerBackup) {
      activeStage = 'backup';
      backup = complete(activeStage, await operations.backup(plan));
    }

    activeStage = 'migration_dry_run';
    await operations.migrationDryRun(plan);
    complete(activeStage, undefined);

    activeStage = 'migration_apply';
    await operations.applyMigrations(plan);
    complete(activeStage, undefined);

    activeStage = 'edge_deploy';
    edge = complete(activeStage, await operations.deployEdge(plan));
    assertImmutableId(edge.versionId, 'Deployed Edge version');

    activeStage = 'worker_deploy';
    worker = complete(activeStage, await operations.deployWorker(plan));
    assertImmutableId(worker.versionId, 'Deployed Worker version');

    activeStage = 'scheduler_configure';
    schedulerAttempted = true;
    scheduler = complete(activeStage, await operations.configureScheduler(plan));

    activeStage = 'smoke';
    const smoke = complete(activeStage, await operations.smoke(plan));

    activeStage = 'evidence_record';
    const evidence = await createDeploymentEvidence({
      environment: plan.target.environment,
      manifest: plan.manifest,
      artifactVersion: plan.artifactVersion,
      deploymentSha: plan.deploymentSha,
      priorVersions: plan.priorVersions,
      deployedVersions: { edgeVersionId: edge.versionId, workerVersionId: worker.versionId },
      edgeRegion: plan.target.edgeRegion,
      backup,
      scheduler,
      smoke,
      startedAt,
      completedAt: now().toISOString()
    });
    await operations.recordEvidence(evidence);
    complete(activeStage, undefined);
    return evidence;
  } catch (error) {
    const rollbackErrorCodes: string[] = [];
    const compensate = async (operation: () => Promise<void>, fallback: string): Promise<void> => {
      try { await operation(); } catch (rollbackError) {
        rollbackErrorCodes.push(safeErrorCode(rollbackError, fallback));
      }
    };

    if (schedulerAttempted || ['smoke', 'evidence_record'].includes(activeStage)) {
      await compensate(() => operations.pauseScheduler(plan), 'scheduler_pause_failed');
    }
    if (worker || ['worker_deploy', 'scheduler_configure', 'smoke', 'evidence_record'].includes(activeStage)) {
      await compensate(() => operations.rollbackWorker(plan.priorVersions.workerVersionId), 'worker_rollback_failed');
    }
    if (edge || ['edge_deploy', 'worker_deploy', 'scheduler_configure', 'smoke', 'evidence_record'].includes(activeStage)) {
      await compensate(() => operations.rollbackEdge(plan.priorVersions.edgeVersionId), 'edge_rollback_failed');
    }

    const evidence = await createDeploymentFailureEvidence({
      environment: plan.target.environment,
      manifest: plan.manifest,
      artifactVersion: plan.artifactVersion,
      deploymentSha: plan.deploymentSha,
      failedStage: activeStage,
      primaryErrorCode: safeErrorCode(error, STAGE_ERROR[activeStage]),
      rollbackErrorCodes,
      completedStages,
      startedAt,
      completedAt: now().toISOString()
    });
    throw new DeploymentFailure(evidence);
  }
}
