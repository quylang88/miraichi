import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { canonicalReleaseManifest, createReleaseManifest, sha256FileTree } from './release-manifest.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

const hash = (value: string) => value.repeat(64).slice(0, 64);

describe('release manifest', () => {
  it('canonicalizes every reviewed artifact identity without filesystem-order dependence', async () => {
    const first = await mkdtemp(path.join(os.tmpdir(), 'miraichi-release-a-'));
    const second = await mkdtemp(path.join(os.tmpdir(), 'miraichi-release-b-'));
    roots.push(first, second);
    await mkdir(path.join(first, 'nested'));
    await mkdir(path.join(second, 'nested'));
    await writeFile(path.join(first, 'z.txt'), 'last');
    await writeFile(path.join(first, 'nested/a.txt'), 'first');
    await writeFile(path.join(second, 'nested/a.txt'), 'first');
    await writeFile(path.join(second, 'z.txt'), 'last');
    expect(await sha256FileTree(first)).toBe(await sha256FileTree(second));

    const manifest = createReleaseManifest({
      sourceSha: 'a'.repeat(40), treeId: 'b'.repeat(40), migrationHash: hash('1'),
      webHash: hash('2'), edgeHash: hash('3'), workerHash: hash('4'),
      toolchain: { node: '22.20.0', pnpm: '10.18.3', supabase: '2.109.0', wrangler: '4.128.0' },
      builtAt: '2026-09-27T12:00:00.000Z'
    });
    expect(JSON.parse(canonicalReleaseManifest(manifest))).toEqual(manifest);
    expect(manifest.schemaVersion).toBe('miraichi.release.v1');
  });

  it('rejects moving refs and malformed artifact hashes', () => {
    expect(() => createReleaseManifest({
      sourceSha: 'main', treeId: 'b'.repeat(40), migrationHash: hash('1'),
      webHash: hash('2'), edgeHash: hash('3'), workerHash: 'latest',
      toolchain: { node: '22', pnpm: '10', supabase: '2', wrangler: '4' },
      builtAt: '2026-09-27T12:00:00.000Z'
    })).toThrow('source SHA');
  });
});
