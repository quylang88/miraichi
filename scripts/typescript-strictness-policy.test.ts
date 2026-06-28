import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function readJson(relativePath: string) {
  return JSON.parse(fs.readFileSync(path.resolve(relativePath), 'utf8'));
}

describe('TypeScript strictness policy', () => {
  it('enables source-level compiler flags (strict subset)', () => {
    const tsconfig = readJson('tsconfig.base.json');

    expect(tsconfig.compilerOptions.strict).toBe(true);
    expect(tsconfig.compilerOptions.allowJs).toBe(false);
    expect(tsconfig.compilerOptions.noImplicitAny).toBe(true);
    expect(tsconfig.compilerOptions.useUnknownInCatchVariables).toBe(true);
    expect(tsconfig.compilerOptions.exactOptionalPropertyTypes).toBe(true);
    expect(tsconfig.compilerOptions.noPropertyAccessFromIndexSignature).toBe(false); // Documented exceptions allowed for index signatures
    expect(tsconfig.compilerOptions.noUncheckedIndexedAccess).toBe(false); // Documented exceptions allowed for index signatures
    expect(tsconfig.compilerOptions.skipLibCheck).toBe(true); // Documented exception due to stdlib lib.webworker.d.ts conflicts
  });

  it('wires type-safety audit into local verification', () => {
    const packageJson = readJson('package.json');

    expect(packageJson.scripts['audit:type-safety']).toBe('tsx scripts/type-safety-audit.ts');
    expect(packageJson.scripts['verify:local']).toContain('pnpm run audit:type-safety');
  });
});
