import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createReleaseManifest } from './release-manifest.js';
import { materializeProductionReleaseMetadata } from './materialize-release-metadata.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));
const hash = (value: string) => value.repeat(64).slice(0, 64);

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'miraichi-production-metadata-'));
  roots.push(root);
  await mkdir(path.join(root, 'apps/web/dist'), { recursive: true });
  const manifest = createReleaseManifest({
    sourceSha: 'a'.repeat(40), treeId: 'b'.repeat(40), migrationHash: hash('1'),
    webHash: hash('2'), edgeHash: hash('3'), workerHash: hash('4'),
    toolchain: { node: '22', pnpm: '10', supabase: '2', wrangler: '4' },
    builtAt: '2026-09-28T00:00:00.000Z'
  });
  const manifestPath = path.join(root, 'release-manifest.json');
  const releasePath = path.join(root, 'apps/web/dist/release.json');
  await writeFile(manifestPath, JSON.stringify(manifest));
  await writeFile(path.join(root, 'apps/web/dist/service-worker.js'), `const cache='miraichi-shell-${manifest.webHash}';`);
  await writeFile(releasePath, JSON.stringify({
    environment: 'staging', gitSha: manifest.sourceSha,
    artifactVersion: `miraichi-release-${manifest.sourceSha}`, compatibilityVersion: 'owner-v3'
  }));
  return { root, manifest, manifestPath, releasePath };
}

describe('production release metadata materialization', () => {
  it('changes only the environment-specific release file after validating candidate identity', async () => {
    const input = await fixture();
    const serviceWorker = await readFile(path.join(input.root, 'apps/web/dist/service-worker.js'), 'utf8');
    await expect(materializeProductionReleaseMetadata({
      root: input.root,
      manifestPath: input.manifestPath,
      artifactVersion: `miraichi-release-${input.manifest.sourceSha}`,
      compatibilityVersion: 'owner-v3'
    })).resolves.toEqual({
      environment: 'production', gitSha: input.manifest.sourceSha,
      artifactVersion: `miraichi-release-${input.manifest.sourceSha}`, compatibilityVersion: 'owner-v3'
    });
    expect(JSON.parse(await readFile(input.releasePath, 'utf8'))).toMatchObject({ environment: 'production' });
    expect(await readFile(path.join(input.root, 'apps/web/dist/service-worker.js'), 'utf8')).toBe(serviceWorker);
  });

  it('rejects candidate metadata or service-worker identity drift before overwriting', async () => {
    const input = await fixture();
    await writeFile(input.releasePath, JSON.stringify({
      environment: 'staging', gitSha: 'c'.repeat(40),
      artifactVersion: `miraichi-release-${input.manifest.sourceSha}`, compatibilityVersion: 'owner-v3'
    }));
    await expect(materializeProductionReleaseMetadata({
      root: input.root, manifestPath: input.manifestPath,
      artifactVersion: `miraichi-release-${input.manifest.sourceSha}`, compatibilityVersion: 'owner-v3'
    })).rejects.toThrow('candidate release identity');
    expect(JSON.parse(await readFile(input.releasePath, 'utf8'))).toMatchObject({ environment: 'staging' });
  });
});
