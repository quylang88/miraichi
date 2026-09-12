import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as ts from 'typescript';
import { describe, expect, it } from 'vitest';

describe('static PWA startup artifact', () => {
  it('bundles all startup dependencies including authenticated dynamic code into cached entries', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'apps/web/scripts/build-static.ts'], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 30000
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
  }, 40000);
});
