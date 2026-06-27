import { describe, expect, it } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { collectTypeSafetyViolations } from './type-safety-audit.js';

async function writeFixture(rootDir: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(rootDir, relativePath);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

describe('type safety audit', () => {
  it('flags tracked JavaScript source, explicit any, and TypeScript suppression comments', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-type-audit-'));

    try {
      await writeFixture(rootDir, 'apps/api/src/legacy.js', 'export const legacy = true;');
      await writeFixture(rootDir, 'apps/api/src/bad.ts', [
        'const payload: any = {};',
        '// @ts-ignore',
        'export const value = payload;'
      ].join('\n'));

      const violations = await collectTypeSafetyViolations(rootDir);

      expect(violations).toEqual([
        {
          type: 'tracked-js-source',
          file: 'apps/api/src/legacy.js',
          line: 1,
          message: 'Tracked JavaScript source is forbidden under apps/, packages/, and scripts/.'
        },
        {
          type: 'explicit-any',
          file: 'apps/api/src/bad.ts',
          line: 1,
          message: 'Explicit any is forbidden. Use unknown plus a type guard or a concrete contract type.'
        },
        {
          type: 'ts-suppression',
          file: 'apps/api/src/bad.ts',
          line: 2,
          message: 'TypeScript suppression comments are forbidden in source.'
        }
      ]);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });

  it('ignores generated output and does not flag expect.any test matchers', async () => {
    const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'miraichi-type-audit-'));

    try {
      await writeFixture(rootDir, 'apps/web/dist/generated.js', 'export const generated = true;');
      await writeFixture(rootDir, 'apps/web/src/sample.test.ts', [
        "import { expect } from 'vitest';",
        'expect.any(String);'
      ].join('\n'));

      await expect(collectTypeSafetyViolations(rootDir)).resolves.toEqual([]);
    } finally {
      await fs.rm(rootDir, { recursive: true, force: true });
    }
  });
});
