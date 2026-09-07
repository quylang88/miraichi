import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  inspectCloudflareStaticArtifact,
  readCloudflareAssetsConfig,
  verifyCloudflareOwnerHosting
} from './cloudflare-owner-hosting-verify.js';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

function fixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'miraichi-cloudflare-artifact-'));
  roots.push(root);
  mkdirSync(path.join(root, 'apps/web/dist/assets'), { recursive: true });
  mkdirSync(path.join(root, 'apps/cloudflare-gateway'), { recursive: true });
  writeFileSync(path.join(root, 'apps/web/dist/index.html'), 'window.MIRAICHI_ENV={API_URL:""}');
  writeFileSync(path.join(root, 'apps/web/dist/assets/app.js'), 'fetch("/api/v1/health")');
  writeFileSync(path.join(root, 'apps/cloudflare-gateway/wrangler.jsonc'), JSON.stringify({
    env: { staging: {} },
    assets: {
      directory: '../web/dist', binding: 'ASSETS',
      not_found_handling: 'single-page-application', run_worker_first: ['/api', '/api/*']
    }
  }));
  return root;
}

describe('Cloudflare owner-hosting artifact verification', () => {
  it('inventories bounded same-origin assets and exact Worker-first routing', () => {
    const root = fixture();
    expect(inspectCloudflareStaticArtifact({
      distDir: path.join(root, 'apps/web/dist'), expectedFileCount: 2
    })).toMatchObject({ fileCount: 2, largestFileBytes: expect.any(Number) });
    expect(readCloudflareAssetsConfig(path.join(root, 'apps/cloudflare-gateway/wrangler.jsonc')))
      .toEqual({
        deploymentEnvironments: ['staging'],
        directory: '../web/dist', binding: 'ASSETS',
        notFoundHandling: 'single-page-application', runWorkerFirst: ['/api', '/api/*']
      });
  });

  it('rejects excess files, oversized files, and an external API URL', () => {
    const root = fixture();
    const distDir = path.join(root, 'apps/web/dist');
    expect(() => inspectCloudflareStaticArtifact({ distDir, expectedFileCount: 3 }))
      .toThrow('expected 3 files');
    expect(() => inspectCloudflareStaticArtifact({ distDir, expectedFileCount: 2, maxFileBytes: 4 }))
      .toThrow('25 MiB-compatible file limit');
    writeFileSync(path.join(distDir, 'index.html'), 'window.MIRAICHI_ENV={API_URL:"https://api.example.com"}');
    expect(() => inspectCloudflareStaticArtifact({ distDir, expectedFileCount: 2 }))
      .toThrow('same-origin API');
  });

  it('runs a Wrangler dry-run to an isolated output directory without deploying', () => {
    const root = fixture();
    const runCommand = vi.fn((_command: string, _args: readonly string[], _cwd: string) => (
      { status: 0, stdout: 'dry-run ok', stderr: '' }
    ));
    const result = verifyCloudflareOwnerHosting({
      rootDir: root, expectedFileCount: 2, runCommand
    });
    expect(result.fileCount).toBe(2);
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand.mock.calls[0]![0]).toBe('pnpm');
    expect(runCommand.mock.calls[0]![1]).toEqual(expect.arrayContaining([
      '--filter', '@miraichi/cloudflare-gateway', 'exec', 'wrangler', 'deploy', '--dry-run', '--outdir'
    ]));
    expect(runCommand.mock.calls[0]![1]).not.toContain('--env');
  });
});
