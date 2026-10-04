import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { sha256FileTree } from '../../../scripts/release/release-manifest.js';

describe('static PWA startup artifact', () => {
  it('bundles all startup dependencies including authenticated dynamic code into cached entries', async () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'apps/web/scripts/build-static.ts'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30000,
      env: {
        ...process.env,
        MIRAICHI_RELEASE_ENVIRONMENT: 'staging',
        MIRAICHI_RELEASE_SHA: 'a'.repeat(40),
        MIRAICHI_RELEASE_ARTIFACT: 'candidate-a1',
        MIRAICHI_SCHEMA_COMPAT_VERSION: 'owner-v1'
      }
    });
    expect(result.status, result.stderr).toBe(0);
    for (const entry of ['auth-bootstrap', 'pwa/register-service-worker']) {
      const source = readFileSync(path.resolve(`apps/web/dist/apps/web/src/${entry}.js`), 'utf8');
      const ast = ts.createSourceFile('entry.js', source, ts.ScriptTarget.ESNext, true);
      const dependencies: string[] = [];
      const visit = (node: ts.Node) => {
        if (ts.isImportDeclaration(node) || (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword)) {
          dependencies.push(node.getText(ast));
        }
        ts.forEachChild(node, visit);
      };
      visit(ast);
      expect(dependencies, `${entry} must not start a network module waterfall`).toEqual([]);
    }
    const html = readFileSync('apps/web/dist/index.html', 'utf8');
    expect(html).toContain('data-owner-session="pending"');
    expect(JSON.parse(readFileSync('apps/web/dist/release.json', 'utf8'))).toEqual({
      environment: 'staging', gitSha: 'a'.repeat(40),
      artifactVersion: 'candidate-a1', compatibilityVersion: 'owner-v1'
    });
    const builtServiceWorker = readFileSync('apps/web/dist/service-worker.js', 'utf8');
    const webHash = builtServiceWorker.match(/miraichi-shell-([a-f0-9]{64})/u)?.[1];
    expect(webHash).toBeDefined();
    expect(builtServiceWorker).not.toContain('__MIRAICHI_WEB_HASH__');
    const unhashedArtifact = mkdtempSync(path.join(os.tmpdir(), 'miraichi-web-hash-'));
    try {
      cpSync('apps/web/dist', unhashedArtifact, { recursive: true });
      writeFileSync(
        path.join(unhashedArtifact, 'service-worker.js'),
        builtServiceWorker.replace(webHash!, '__MIRAICHI_WEB_HASH__')
      );
      expect(await sha256FileTree(unhashedArtifact, { exclude: ['release.json'] })).toBe(webHash);
    } finally {
      rmSync(unhashedArtifact, { recursive: true, force: true });
    }
  }, 40000);
});
