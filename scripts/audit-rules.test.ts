import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

describe('repository guardrail audit', () => {
  it('allows only the ADR-0043 database adapter and validation fixtures', () => {
    const output = execFileSync(
      process.execPath,
      ['node_modules/tsx/dist/cli.mjs', 'scripts/audit-rules.ts'],
      { cwd: process.cwd(), encoding: 'utf8' }
    );

    expect(output).toContain('Scan PASSED');
  });
});
