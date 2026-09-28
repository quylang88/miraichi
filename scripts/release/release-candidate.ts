import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  verifyDeploymentEvidence,
  type DeploymentEvidence
} from './deployment-evidence.js';
import {
  canonicalReleaseManifest,
  createReleaseManifest,
  type ReleaseManifest
} from './release-manifest.js';

export interface ReleaseCandidateInput {
  readonly pullRequest: {
    readonly baseRef: string;
    readonly headRef: string;
    readonly baseRepository: string;
    readonly headRepository: string;
    readonly headSha: string;
    readonly headIsTag: boolean;
  };
  readonly mainIsAncestor: boolean;
  readonly candidateTreeId: string;
  readonly proposedMergeTreeId: string;
  readonly releaseOnlyChangedPaths: readonly string[];
  readonly deployment: {
    readonly environment: string;
    readonly state: string;
    readonly sha: string;
    readonly id: number;
  };
  readonly artifact: {
    readonly name: string;
    readonly digest: string;
    readonly expired: boolean;
    readonly createdAt: string;
    readonly expiresAt: string;
    readonly workflowHeadBranch: string;
    readonly workflowHeadSha: string;
  };
  readonly manifest: ReleaseManifest;
  readonly deploymentEvidence: DeploymentEvidence;
  readonly now: string;
}

export interface CandidateVerification {
  readonly status: 'verified';
  readonly sourceSha: string;
  readonly treeId: string;
  readonly artifactName: string;
  readonly artifactDigest: string;
  readonly manifestSha256: string;
  readonly deploymentId: number;
}

export interface ProductionPromotionInput {
  readonly push: {
    readonly ref: string;
    readonly beforeSha: string;
    readonly afterSha: string;
    readonly repository: string;
  };
  readonly checkedOutSha: string;
  readonly pullRequestMerged: boolean;
  readonly mergeCommitSha: string;
  readonly candidate: ReleaseCandidateInput;
}

const GIT_ID = /^[a-f0-9]{40}$/u;
const ZERO_GIT_ID = /^0{40}$/u;
const ARTIFACT_DIGEST = /^sha256:[a-f0-9]{64}$/u;

function reject(code: string): never {
  throw new Error(code);
}

function sameManifestIdentity(evidence: DeploymentEvidence, manifest: ReleaseManifest, manifestSha256: string): boolean {
  return evidence.release.sourceSha === manifest.sourceSha
    && evidence.release.treeId === manifest.treeId
    && evidence.release.manifestSha256 === manifestSha256
    && evidence.release.migrationHash === manifest.migrationHash
    && evidence.release.webHash === manifest.webHash
    && evidence.release.edgeHash === manifest.edgeHash
    && evidence.release.workerHash === manifest.workerHash;
}

export async function verifyReleaseCandidate(input: ReleaseCandidateInput): Promise<CandidateVerification> {
  const { pullRequest } = input;
  if (pullRequest.baseRef !== 'main') reject('candidate_wrong_base');
  if (pullRequest.headRef !== 'staging') reject('candidate_wrong_head');
  if (pullRequest.baseRepository !== pullRequest.headRepository) reject('candidate_fork_forbidden');
  if (pullRequest.headIsTag) reject('candidate_tag_forbidden');
  if (!GIT_ID.test(pullRequest.headSha)) reject('candidate_head_sha_invalid');
  if (!input.mainIsAncestor) reject('candidate_main_not_ancestor');
  if (!GIT_ID.test(input.candidateTreeId) || !GIT_ID.test(input.proposedMergeTreeId)) {
    reject('candidate_tree_invalid');
  }
  if (input.proposedMergeTreeId !== input.candidateTreeId) reject('candidate_merge_tree_mismatch');
  if (input.releaseOnlyChangedPaths.length > 0) reject('candidate_release_only_edit');

  let validatedManifest: ReleaseManifest;
  try {
    if (input.manifest.schemaVersion !== 'miraichi.release.v1'
      || input.manifest.sourceSha !== pullRequest.headSha
      || input.manifest.treeId !== input.candidateTreeId) reject('candidate_manifest_invalid');
    validatedManifest = createReleaseManifest({
      sourceSha: input.manifest.sourceSha,
      treeId: input.manifest.treeId,
      migrationHash: input.manifest.migrationHash,
      webHash: input.manifest.webHash,
      edgeHash: input.manifest.edgeHash,
      workerHash: input.manifest.workerHash,
      toolchain: { ...input.manifest.toolchain },
      builtAt: input.manifest.builtAt
    });
  } catch {
    reject('candidate_manifest_invalid');
  }
  const manifestSha256 = createHash('sha256')
    .update(canonicalReleaseManifest(validatedManifest), 'utf8')
    .digest('hex');

  if (input.deployment.environment !== 'staging' || input.deployment.state !== 'success') {
    reject('candidate_deployment_not_successful');
  }
  if (input.deployment.sha !== pullRequest.headSha) reject('candidate_deployment_sha_mismatch');
  if (!Number.isSafeInteger(input.deployment.id) || input.deployment.id < 1) {
    reject('candidate_deployment_invalid');
  }

  const expectedArtifactName = `miraichi-release-${pullRequest.headSha}`;
  if (input.artifact.name !== expectedArtifactName) reject('candidate_artifact_name_mismatch');
  if (input.artifact.workflowHeadSha !== pullRequest.headSha
    || input.artifact.workflowHeadBranch !== 'staging') reject('candidate_artifact_sha_mismatch');
  if (!ARTIFACT_DIGEST.test(input.artifact.digest)) reject('candidate_artifact_digest_invalid');
  const createdAt = Date.parse(input.artifact.createdAt);
  const expiresAt = Date.parse(input.artifact.expiresAt);
  const now = Date.parse(input.now);
  if (![createdAt, expiresAt, now].every(Number.isFinite) || createdAt > expiresAt || createdAt > now) {
    reject('candidate_artifact_timestamp_invalid');
  }
  if (input.artifact.expired || expiresAt <= now) reject('candidate_artifact_expired');

  if (!await verifyDeploymentEvidence(input.deploymentEvidence)
    || input.deploymentEvidence.status !== 'succeeded'
    || input.deploymentEvidence.environment !== 'staging'
    || input.deploymentEvidence.release.deploymentSha !== pullRequest.headSha
    || input.deploymentEvidence.release.artifactVersion !== expectedArtifactName
    || !sameManifestIdentity(input.deploymentEvidence, validatedManifest, manifestSha256)
    || input.deploymentEvidence.smoke.releaseSha !== pullRequest.headSha
    || input.deploymentEvidence.smoke.edgeRegion !== 'eu-central-1') {
    reject('candidate_deployment_evidence_invalid');
  }

  return {
    status: 'verified',
    sourceSha: pullRequest.headSha,
    treeId: input.candidateTreeId,
    artifactName: expectedArtifactName,
    artifactDigest: input.artifact.digest,
    manifestSha256,
    deploymentId: input.deployment.id
  };
}

export async function verifyProductionPromotion(
  input: ProductionPromotionInput
): Promise<CandidateVerification> {
  if (input.push.ref !== 'refs/heads/main') reject('promotion_wrong_ref');
  if (!GIT_ID.test(input.push.beforeSha) || ZERO_GIT_ID.test(input.push.beforeSha)
    || !GIT_ID.test(input.push.afterSha) || ZERO_GIT_ID.test(input.push.afterSha)) {
    reject('promotion_push_sha_invalid');
  }
  if (input.push.repository !== input.candidate.pullRequest.baseRepository
    || input.push.repository !== input.candidate.pullRequest.headRepository) {
    reject('promotion_repository_mismatch');
  }
  if (!input.pullRequestMerged) reject('promotion_pr_not_merged');
  if (input.mergeCommitSha !== input.push.afterSha) reject('promotion_merge_commit_mismatch');
  if (input.checkedOutSha !== input.push.afterSha) reject('promotion_checkout_mismatch');
  return verifyReleaseCandidate(input.candidate);
}

interface GithubEvidenceFile {
  readonly deployment: ReleaseCandidateInput['deployment'];
  readonly artifact: ReleaseCandidateInput['artifact'];
  readonly now: string;
}

interface PullRequestEvent {
  readonly repository?: { readonly full_name?: string };
  readonly pull_request?: {
    readonly base?: { readonly ref?: string; readonly sha?: string; readonly repo?: { readonly full_name?: string } };
    readonly head?: { readonly ref?: string; readonly sha?: string; readonly repo?: { readonly full_name?: string } };
  };
}

interface PushEvent {
  readonly ref?: string;
  readonly before?: string;
  readonly after?: string;
  readonly repository?: { readonly full_name?: string };
}

interface GithubProductionEvidenceFile extends GithubEvidenceFile {
  readonly pullRequest: {
    readonly baseRef: string;
    readonly headRef: string;
    readonly baseRepository: string;
    readonly headRepository: string;
    readonly headSha: string;
    readonly headIsTag: boolean;
    readonly merged: boolean;
    readonly mergeCommitSha: string;
  };
}

function git(args: readonly string[]): string {
  return execFileSync('git', [...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

function isAncestor(baseSha: string, headSha: string): boolean {
  const result = spawnSync('git', ['merge-base', '--is-ancestor', baseSha, headSha], {
    encoding: 'utf8', stdio: ['ignore', 'ignore', 'ignore'], shell: false
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  reject('candidate_git_ancestry_failed');
}

async function loadJson(file: string): Promise<unknown> {
  return JSON.parse(await readFile(file, 'utf8')) as unknown;
}

async function verifyGithubCandidate(metadataFile: string, artifactDirectory: string): Promise<CandidateVerification> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) reject('candidate_event_path_missing');
  const event = await loadJson(path.resolve(eventPath)) as PullRequestEvent;
  const metadata = await loadJson(path.resolve(metadataFile)) as GithubEvidenceFile;
  const manifest = await loadJson(path.resolve(artifactDirectory, 'release-manifest.json')) as ReleaseManifest;
  const deploymentEvidence = await loadJson(
    path.resolve(artifactDirectory, 'deployment-evidence.json')
  ) as DeploymentEvidence;
  const baseSha = event.pull_request?.base?.sha ?? '';
  const headSha = event.pull_request?.head?.sha ?? '';
  if (!GIT_ID.test(baseSha) || !GIT_ID.test(headSha)) reject('candidate_event_invalid');
  const changedPaths = git(['diff', '--name-only', '--no-renames', headSha, 'HEAD'])
    .split(/\r?\n/u)
    .filter(Boolean);

  return verifyReleaseCandidate({
    pullRequest: {
      baseRef: event.pull_request?.base?.ref ?? '',
      headRef: event.pull_request?.head?.ref ?? '',
      baseRepository: event.pull_request?.base?.repo?.full_name ?? event.repository?.full_name ?? '',
      headRepository: event.pull_request?.head?.repo?.full_name ?? '',
      headSha,
      headIsTag: false
    },
    mainIsAncestor: isAncestor(baseSha, headSha),
    candidateTreeId: git(['rev-parse', `${headSha}^{tree}`]),
    proposedMergeTreeId: git(['rev-parse', 'HEAD^{tree}']),
    releaseOnlyChangedPaths: changedPaths,
    deployment: metadata.deployment,
    artifact: metadata.artifact,
    manifest,
    deploymentEvidence,
    now: metadata.now
  });
}

async function verifyGithubProductionCandidate(
  metadataFile: string,
  artifactDirectory: string
): Promise<CandidateVerification> {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) reject('candidate_event_path_missing');
  const event = await loadJson(path.resolve(eventPath)) as PushEvent;
  const metadata = await loadJson(path.resolve(metadataFile)) as GithubProductionEvidenceFile;
  const manifest = await loadJson(path.resolve(artifactDirectory, 'release-manifest.json')) as ReleaseManifest;
  const deploymentEvidence = await loadJson(
    path.resolve(artifactDirectory, 'deployment-evidence.json')
  ) as DeploymentEvidence;
  const headSha = metadata.pullRequest.headSha;
  const beforeSha = event.before ?? '';
  const afterSha = event.after ?? '';
  if (!GIT_ID.test(headSha) || !GIT_ID.test(beforeSha) || !GIT_ID.test(afterSha)) {
    reject('candidate_event_invalid');
  }
  const changedPaths = git(['diff', '--name-only', '--no-renames', headSha, 'HEAD'])
    .split(/\r?\n/u)
    .filter(Boolean);
  const candidate: ReleaseCandidateInput = {
    pullRequest: {
      baseRef: metadata.pullRequest.baseRef,
      headRef: metadata.pullRequest.headRef,
      baseRepository: metadata.pullRequest.baseRepository,
      headRepository: metadata.pullRequest.headRepository,
      headSha,
      headIsTag: metadata.pullRequest.headIsTag
    },
    mainIsAncestor: isAncestor(beforeSha, headSha),
    candidateTreeId: git(['rev-parse', `${headSha}^{tree}`]),
    proposedMergeTreeId: git(['rev-parse', 'HEAD^{tree}']),
    releaseOnlyChangedPaths: changedPaths,
    deployment: metadata.deployment,
    artifact: metadata.artifact,
    manifest,
    deploymentEvidence,
    now: metadata.now
  };
  return verifyProductionPromotion({
    push: {
      ref: event.ref ?? '',
      beforeSha,
      afterSha,
      repository: event.repository?.full_name ?? ''
    },
    checkedOutSha: git(['rev-parse', 'HEAD']),
    pullRequestMerged: metadata.pullRequest.merged,
    mergeCommitSha: metadata.pullRequest.mergeCommitSha,
    candidate
  });
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void (async () => {
    const mode = process.argv[2];
    if (!['--github', '--github-production'].includes(mode ?? '')
      || !process.argv[3] || !process.argv[4] || process.argv.length !== 5) {
      reject('candidate_cli_arguments_invalid');
    }
    const result = mode === '--github-production'
      ? await verifyGithubProductionCandidate(process.argv[3], process.argv[4])
      : await verifyGithubCandidate(process.argv[3], process.argv[4]);
    console.log(JSON.stringify(result));
  })().catch((error) => {
    const code = error instanceof Error && /^(?:candidate|promotion)_[a-z0-9_]+$/u.test(error.message)
      ? error.message
      : 'candidate_verification_failed';
    console.error(JSON.stringify({ status: 'failed', code }));
    process.exitCode = 1;
  });
}
