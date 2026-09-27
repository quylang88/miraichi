import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ReleaseEnvironment, ReleaseEdgeRegion } from '../../packages/config/src/release-targets.js';
import type { CloudBackupRecordCounts } from '../../packages/shared/src/contracts/index.js';
import { canonicalReleaseManifest, type ReleaseManifest } from './release-manifest.js';

export type DeploymentStage =
  | 'validate' | 'backup' | 'migration_dry_run' | 'migration_apply'
  | 'edge_deploy' | 'worker_deploy' | 'scheduler_configure' | 'smoke' | 'evidence_record';

export interface RuntimeVersions {
  readonly edgeVersionId: string;
  readonly workerVersionId: string;
}

export interface RecordedBackupEvidence {
  readonly receiptId: string;
  readonly ciphertextSha256: string;
  readonly storedBytes: number;
  readonly recordCounts: CloudBackupRecordCounts;
}

export interface RecordedSchedulerEvidence {
  readonly targetSha256: string;
  readonly vaultNames: number;
  readonly activeJobs: number;
}

export interface RecordedSmokeEvidence {
  readonly status: 'passed';
  readonly checks: number;
  readonly edgeRegion: ReleaseEdgeRegion;
  readonly releaseSha: string;
  readonly schedulerTargetSha256: string;
}

interface ReleaseEvidenceIdentity {
  readonly deploymentSha: string;
  readonly sourceSha: string;
  readonly treeId: string;
  readonly artifactVersion: string;
  readonly manifestSha256: string;
  readonly migrationHash: string;
  readonly webHash: string;
  readonly edgeHash: string;
  readonly workerHash: string;
  readonly builtAt: string;
  readonly toolchain: ReleaseManifest['toolchain'];
}

interface DeploymentEvidenceBase {
  readonly schemaVersion: 'miraichi.deployment-evidence.v1';
  readonly environment: ReleaseEnvironment;
  readonly release: ReleaseEvidenceIdentity;
  readonly startedAt: string;
  readonly completedAt: string;
  readonly evidenceSha256: string;
}

export interface SuccessfulDeploymentEvidence extends DeploymentEvidenceBase {
  readonly status: 'succeeded';
  readonly priorRuntime: RuntimeVersions;
  readonly runtime: RuntimeVersions & { readonly edgeRegion: ReleaseEdgeRegion };
  readonly backup: RecordedBackupEvidence | null;
  readonly scheduler: RecordedSchedulerEvidence;
  readonly smoke: RecordedSmokeEvidence;
}

export interface FailedDeploymentEvidence extends DeploymentEvidenceBase {
  readonly status: 'failed';
  readonly failedStage: DeploymentStage;
  readonly primaryErrorCode: string;
  readonly rollbackErrorCodes: readonly string[];
  readonly completedStages: readonly DeploymentStage[];
}

export type DeploymentEvidence = SuccessfulDeploymentEvidence | FailedDeploymentEvidence;

const HASH = /^[a-f0-9]{64}$/u;
const GIT_ID = /^[a-f0-9]{40}$/u;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const SAFE_CODE = /^[a-z][a-z0-9_]{2,63}$/u;

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Deployment evidence contains non-JSON data');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([name, nested]) => `${JSON.stringify(name)}:${canonicalJson(nested)}`).join(',')}}`;
  }
  throw new Error('Deployment evidence contains unsupported data');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function releaseIdentity(
  manifest: ReleaseManifest,
  artifactVersion: string,
  deploymentSha: string
): ReleaseEvidenceIdentity {
  assertImmutableId(artifactVersion, 'Artifact version');
  if (!GIT_ID.test(deploymentSha)) throw new Error('Deployment SHA must be an immutable Git SHA');
  return {
    deploymentSha,
    sourceSha: manifest.sourceSha,
    treeId: manifest.treeId,
    artifactVersion,
    manifestSha256: sha256(canonicalReleaseManifest(manifest)),
    migrationHash: manifest.migrationHash,
    webHash: manifest.webHash,
    edgeHash: manifest.edgeHash,
    workerHash: manifest.workerHash,
    builtAt: manifest.builtAt,
    toolchain: { ...manifest.toolchain }
  };
}

function withEvidenceHash<T extends Omit<DeploymentEvidence, 'evidenceSha256'>>(value: T): T & { evidenceSha256: string } {
  return { ...value, evidenceSha256: sha256(canonicalJson(value)) };
}

export function assertImmutableId(value: string, label: string): void {
  if (!SAFE_ID.test(value) || value.toLowerCase() === 'latest') {
    throw new Error(`${label} must be an immutable explicit identifier`);
  }
}

function assertDates(startedAt: string, completedAt: string): void {
  const start = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(start) || !Number.isFinite(completed) || completed < start) {
    throw new Error('Deployment evidence timestamps are invalid');
  }
}

export async function createDeploymentEvidence(input: {
  readonly environment: ReleaseEnvironment;
  readonly manifest: ReleaseManifest;
  readonly artifactVersion: string;
  readonly deploymentSha: string;
  readonly priorVersions: RuntimeVersions;
  readonly deployedVersions: RuntimeVersions;
  readonly edgeRegion: ReleaseEdgeRegion;
  readonly backup: RecordedBackupEvidence | null;
  readonly scheduler: RecordedSchedulerEvidence;
  readonly smoke: RecordedSmokeEvidence;
  readonly startedAt: string;
  readonly completedAt: string;
}): Promise<SuccessfulDeploymentEvidence> {
  assertDates(input.startedAt, input.completedAt);
  for (const [label, version] of Object.entries({ ...input.priorVersions, ...input.deployedVersions })) {
    assertImmutableId(version, label);
  }
  if (input.smoke.status !== 'passed' || input.smoke.releaseSha !== input.manifest.sourceSha
    || input.smoke.edgeRegion !== input.edgeRegion
    || input.smoke.schedulerTargetSha256 !== input.scheduler.targetSha256) {
    throw new Error('Deployment evidence receipts are inconsistent');
  }
  return withEvidenceHash({
    schemaVersion: 'miraichi.deployment-evidence.v1',
    status: 'succeeded',
    environment: input.environment,
    release: releaseIdentity(input.manifest, input.artifactVersion, input.deploymentSha),
    priorRuntime: { ...input.priorVersions },
    runtime: { ...input.deployedVersions, edgeRegion: input.edgeRegion },
    backup: input.backup ? structuredClone(input.backup) : null,
    scheduler: { ...input.scheduler },
    smoke: { ...input.smoke },
    startedAt: input.startedAt,
    completedAt: input.completedAt
  });
}

export async function createDeploymentFailureEvidence(input: {
  readonly environment: ReleaseEnvironment;
  readonly manifest: ReleaseManifest;
  readonly artifactVersion: string;
  readonly deploymentSha: string;
  readonly failedStage: DeploymentStage;
  readonly primaryErrorCode: string;
  readonly rollbackErrorCodes: readonly string[];
  readonly completedStages: readonly DeploymentStage[];
  readonly startedAt: string;
  readonly completedAt: string;
}): Promise<FailedDeploymentEvidence> {
  assertDates(input.startedAt, input.completedAt);
  if (!SAFE_CODE.test(input.primaryErrorCode) || input.rollbackErrorCodes.some((code) => !SAFE_CODE.test(code))) {
    throw new Error('Deployment error code is invalid');
  }
  return withEvidenceHash({
    schemaVersion: 'miraichi.deployment-evidence.v1',
    status: 'failed',
    environment: input.environment,
    release: releaseIdentity(input.manifest, input.artifactVersion, input.deploymentSha),
    failedStage: input.failedStage,
    primaryErrorCode: input.primaryErrorCode,
    rollbackErrorCodes: [...input.rollbackErrorCodes],
    completedStages: [...input.completedStages],
    startedAt: input.startedAt,
    completedAt: input.completedAt
  });
}

export async function verifyDeploymentEvidence(value: unknown): Promise<boolean> {
  try {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
    const evidence = value as DeploymentEvidence;
    if (evidence.schemaVersion !== 'miraichi.deployment-evidence.v1'
      || !['staging', 'production'].includes(evidence.environment)
      || !['succeeded', 'failed'].includes(evidence.status)
      || !HASH.test(evidence.evidenceSha256)
      || !GIT_ID.test(evidence.release?.deploymentSha)
      || !GIT_ID.test(evidence.release?.sourceSha)
      || !GIT_ID.test(evidence.release?.treeId)
      || !HASH.test(evidence.release?.manifestSha256)
      || !HASH.test(evidence.release?.migrationHash)
      || !HASH.test(evidence.release?.webHash)
      || !HASH.test(evidence.release?.edgeHash)
      || !HASH.test(evidence.release?.workerHash)) return false;
    assertImmutableId(evidence.release.artifactVersion, 'Artifact version');
    assertDates(evidence.startedAt, evidence.completedAt);
    if (evidence.status === 'succeeded') {
      assertImmutableId(evidence.priorRuntime.edgeVersionId, 'Prior Edge version');
      assertImmutableId(evidence.priorRuntime.workerVersionId, 'Prior Worker version');
      assertImmutableId(evidence.runtime.edgeVersionId, 'Edge version');
      assertImmutableId(evidence.runtime.workerVersionId, 'Worker version');
      if (evidence.smoke.status !== 'passed'
        || evidence.smoke.releaseSha !== evidence.release.sourceSha
        || evidence.smoke.edgeRegion !== evidence.runtime.edgeRegion
        || evidence.smoke.schedulerTargetSha256 !== evidence.scheduler.targetSha256) return false;
    } else if (!SAFE_CODE.test(evidence.primaryErrorCode)
      || evidence.rollbackErrorCodes.some((code) => !SAFE_CODE.test(code))) return false;
    const { evidenceSha256, ...withoutHash } = evidence;
    return sha256(canonicalJson(withoutHash)) === evidenceSha256;
  } catch {
    return false;
  }
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void (async () => {
    const evidencePath = process.argv[2];
    if (!evidencePath || process.argv.length !== 3) throw new Error('Evidence path is required');
    const parsed = JSON.parse(await readFile(path.resolve(evidencePath), 'utf8')) as unknown;
    if (!await verifyDeploymentEvidence(parsed)) throw new Error('Deployment evidence is invalid');
    console.log(JSON.stringify({ status: 'passed', schemaVersion: 'miraichi.deployment-evidence.v1' }));
  })().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'deployment_evidence_invalid' }));
    process.exitCode = 1;
  });
}
