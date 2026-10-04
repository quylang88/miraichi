import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readReleaseMetadata, type ReleaseMetadata } from '../../packages/shared/src/contracts/index.js';
import { createReleaseManifest, type ReleaseManifest } from './release-manifest.js';

export interface MaterializeProductionReleaseMetadataInput {
  readonly root: string;
  readonly manifestPath: string;
  readonly artifactVersion: string;
  readonly compatibilityVersion: string;
}

async function readManifest(file: string): Promise<ReleaseManifest> {
  const value = JSON.parse(await readFile(file, 'utf8')) as ReleaseManifest;
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

export async function materializeProductionReleaseMetadata(
  input: MaterializeProductionReleaseMetadataInput
): Promise<ReleaseMetadata> {
  const root = path.resolve(input.root);
  const manifest = await readManifest(path.resolve(input.manifestPath));
  const releasePath = path.join(root, 'apps', 'web', 'dist', 'release.json');
  const candidateFile = JSON.parse(await readFile(releasePath, 'utf8')) as Partial<ReleaseMetadata>;
  const candidate = readReleaseMetadata({
    MIRAICHI_RELEASE_ENVIRONMENT: candidateFile.environment,
    MIRAICHI_RELEASE_SHA: candidateFile.gitSha,
    MIRAICHI_RELEASE_ARTIFACT: candidateFile.artifactVersion,
    MIRAICHI_SCHEMA_COMPAT_VERSION: candidateFile.compatibilityVersion
  });
  const expectedArtifact = `miraichi-release-${manifest.sourceSha}`;
  const serviceWorker = await readFile(path.join(root, 'apps', 'web', 'dist', 'service-worker.js'), 'utf8');
  if (candidate.environment !== 'staging'
    || candidate.gitSha !== manifest.sourceSha
    || candidate.artifactVersion !== expectedArtifact
    || candidate.artifactVersion !== input.artifactVersion
    || candidate.compatibilityVersion !== input.compatibilityVersion
    || !serviceWorker.includes(`miraichi-shell-${manifest.webHash}`)) {
    throw new Error('Staging candidate release identity does not match the immutable manifest');
  }
  const production = readReleaseMetadata({
    MIRAICHI_RELEASE_ENVIRONMENT: 'production',
    MIRAICHI_RELEASE_SHA: manifest.sourceSha,
    MIRAICHI_RELEASE_ARTIFACT: input.artifactVersion,
    MIRAICHI_SCHEMA_COMPAT_VERSION: input.compatibilityVersion
  });
  await writeFile(releasePath, `${JSON.stringify(production, null, 2)}\n`, 'utf8');
  return production;
}

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing release metadata configuration: ${name}`);
  return value;
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  void (async () => {
    if (process.argv.length !== 2) throw new Error('materialize-release-metadata does not accept arguments');
    if (required('MIRAICHI_RELEASE_ENVIRONMENT') !== 'production') {
      throw new Error('Production release environment is required');
    }
    const root = path.resolve(process.env.GITHUB_WORKSPACE?.trim() || process.cwd());
    const metadata = await materializeProductionReleaseMetadata({
      root,
      manifestPath: required('MIRAICHI_RELEASE_MANIFEST_PATH'),
      artifactVersion: required('MIRAICHI_RELEASE_ARTIFACT'),
      compatibilityVersion: required('MIRAICHI_SCHEMA_COMPAT_VERSION')
    });
    if (metadata.gitSha !== required('MIRAICHI_RELEASE_SHA')) {
      throw new Error('Production release SHA does not match the candidate manifest');
    }
    console.log(JSON.stringify({ status: 'materialized', release: metadata }));
  })().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'production_release_metadata_invalid' }));
    process.exitCode = 1;
  });
}
