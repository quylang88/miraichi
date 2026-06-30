import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('audit rules scan policy', () => {
  it('excludes generated artifact directories from source guardrail scans', () => {
    const source = fs.readFileSync(path.resolve('scripts/audit-rules.ts'), 'utf8');

    expect(source).toContain('IGNORED_DIRECTORIES');
    expect(source).toContain("'dist'");
    expect(source).toContain("'build'");
    expect(source).toContain("'coverage'");
  });
});
