import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createDeploymentEvidence, createDeploymentFailureEvidence } from './deployment-evidence.js';
import { canonicalReleaseManifest, createReleaseManifest } from './release-manifest.js';
import { verifyReleaseCandidate, type ReleaseCandidateInput } from './release-candidate.js';

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');
const sourceSha = 'a'.repeat(40);
const treeId = 'b'.repeat(40);
const manifest = createReleaseManifest({
  sourceSha,
  treeId,
  migrationHash: sha256('migrations'),
  webHash: sha256('web'),
  edgeHash: sha256('edge'),
  workerHash: sha256('worker'),
  toolchain: { node: '22.20.0', pnpm: '10.18.3', supabase: '2.109.0', wrangler: '4.128.0' },
  builtAt: '2026-09-28T00:00:00.000Z'
});
const manifestSha256 = sha256(canonicalReleaseManifest(manifest));

async function validInput(): Promise<ReleaseCandidateInput> {
  const deploymentEvidence = await createDeploymentEvidence({
    environment: 'staging',
    manifest,
    artifactVersion: `miraichi-release-${sourceSha}`,
    deploymentSha: sourceSha,
    priorVersions: { edgeVersionId: 'edge-old', workerVersionId: 'worker-old' },
    deployedVersions: { edgeVersionId: 'edge-new', workerVersionId: 'worker-new' },
    edgeRegion: 'eu-central-1',
    backup: null,
    scheduler: { targetSha256: sha256('target'), vaultNames: 4, activeJobs: 3 },
    smoke: {
      status: 'passed', checks: 10, edgeRegion: 'eu-central-1', releaseSha: sourceSha,
      schedulerTargetSha256: sha256('target')
    },
    startedAt: '2026-09-28T00:01:00.000Z',
    completedAt: '2026-09-28T00:02:00.000Z'
  });
  return {
    pullRequest: {
      baseRef: 'main', headRef: 'staging', baseRepository: 'owner/miraichi',
      headRepository: 'owner/miraichi', headSha: sourceSha, headIsTag: false
    },
    mainIsAncestor: true,
    candidateTreeId: treeId,
    proposedMergeTreeId: treeId,
    releaseOnlyChangedPaths: [],
    deployment: { environment: 'staging', state: 'success', sha: sourceSha, id: 41 },
    artifact: {
      name: `miraichi-release-${sourceSha}`,
      digest: `sha256:${sha256('archive')}`,
      expired: false,
      createdAt: '2026-09-28T00:02:01.000Z',
      expiresAt: '2026-10-05T00:02:01.000Z',
      workflowHeadBranch: 'staging',
      workflowHeadSha: sourceSha
    },
    manifest,
    deploymentEvidence,
    now: '2026-09-29T00:00:00.000Z'
  };
}

async function expectReject(
  mutate: (input: ReleaseCandidateInput) => ReleaseCandidateInput,
  code: string
): Promise<void> {
  await expect(verifyReleaseCandidate(mutate(await validInput()))).rejects.toThrow(code);
}

describe('release candidate verification', () => {
  it('accepts only exact staging SHA evidence and returns sanitized immutable provenance', async () => {
    await expect(verifyReleaseCandidate(await validInput())).resolves.toEqual({
      status: 'verified',
      sourceSha,
      treeId,
      artifactName: `miraichi-release-${sourceSha}`,
      artifactDigest: `sha256:${sha256('archive')}`,
      manifestSha256,
      deploymentId: 41
    });
  });

  it.each([
    ['wrong base', (input: ReleaseCandidateInput) => ({ ...input, pullRequest: { ...input.pullRequest, baseRef: 'develop' } }), 'candidate_wrong_base'],
    ['wrong head', (input: ReleaseCandidateInput) => ({ ...input, pullRequest: { ...input.pullRequest, headRef: 'feature' } }), 'candidate_wrong_head'],
    ['fork', (input: ReleaseCandidateInput) => ({ ...input, pullRequest: { ...input.pullRequest, headRepository: 'attacker/miraichi' } }), 'candidate_fork_forbidden'],
    ['tag', (input: ReleaseCandidateInput) => ({ ...input, pullRequest: { ...input.pullRequest, headIsTag: true } }), 'candidate_tag_forbidden'],
    ['non-ancestor main', (input: ReleaseCandidateInput) => ({ ...input, mainIsAncestor: false }), 'candidate_main_not_ancestor'],
    ['merge tree drift', (input: ReleaseCandidateInput) => ({ ...input, proposedMergeTreeId: 'c'.repeat(40) }), 'candidate_merge_tree_mismatch'],
    ['release-only edit', (input: ReleaseCandidateInput) => ({ ...input, releaseOnlyChangedPaths: ['.github/workflows/release-candidate.yml'] }), 'candidate_release_only_edit']
  ])('rejects %s', async (_label, mutate, code) => expectReject(mutate, code));

  it.each([
    ['failed deployment', (input: ReleaseCandidateInput) => ({ ...input, deployment: { ...input.deployment, state: 'failure' as const } }), 'candidate_deployment_not_successful'],
    ['wrong deployment SHA', (input: ReleaseCandidateInput) => ({ ...input, deployment: { ...input.deployment, sha: 'c'.repeat(40) } }), 'candidate_deployment_sha_mismatch'],
    ['expired artifact flag', (input: ReleaseCandidateInput) => ({ ...input, artifact: { ...input.artifact, expired: true } }), 'candidate_artifact_expired'],
    ['expired artifact time', (input: ReleaseCandidateInput) => ({ ...input, artifact: { ...input.artifact, expiresAt: input.now } }), 'candidate_artifact_expired'],
    ['wrong artifact name', (input: ReleaseCandidateInput) => ({ ...input, artifact: { ...input.artifact, name: 'miraichi-release-latest' } }), 'candidate_artifact_name_mismatch'],
    ['wrong workflow SHA', (input: ReleaseCandidateInput) => ({ ...input, artifact: { ...input.artifact, workflowHeadSha: 'c'.repeat(40) } }), 'candidate_artifact_sha_mismatch']
  ])('rejects %s', async (_label, mutate, code) => expectReject(mutate, code));

  it.each([
    ['manifest source', (input: ReleaseCandidateInput) => ({ ...input, manifest: { ...input.manifest, sourceSha: 'c'.repeat(40) } }), 'candidate_manifest_invalid'],
    ['manifest tree', (input: ReleaseCandidateInput) => ({ ...input, manifest: { ...input.manifest, treeId: 'c'.repeat(40) } }), 'candidate_manifest_invalid'],
    ['manifest artifact hash', (input: ReleaseCandidateInput) => ({ ...input, manifest: { ...input.manifest, webHash: sha256('changed-web') } }), 'candidate_deployment_evidence_invalid'],
    ['hosted evidence hash', (input: ReleaseCandidateInput) => ({ ...input, deploymentEvidence: { ...input.deploymentEvidence, evidenceSha256: sha256('tampered') } }), 'candidate_deployment_evidence_invalid']
  ])('rejects mismatched %s', async (_label, mutate, code) => expectReject(mutate, code));

  it('rejects a valid but failed hosted deployment receipt', async () => {
    const input = await validInput();
    const failure = await createDeploymentFailureEvidence({
      environment: 'staging', manifest, artifactVersion: `miraichi-release-${sourceSha}`,
      deploymentSha: sourceSha, failedStage: 'smoke', primaryErrorCode: 'smoke_probe_failed',
      rollbackErrorCodes: [], completedStages: ['validate'],
      startedAt: '2026-09-28T00:01:00.000Z', completedAt: '2026-09-28T00:02:00.000Z'
    });
    await expect(verifyReleaseCandidate({ ...input, deploymentEvidence: failure }))
      .rejects.toThrow('candidate_deployment_evidence_invalid');
  });
});
