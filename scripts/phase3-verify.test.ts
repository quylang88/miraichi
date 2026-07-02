import { describe, expect, it } from 'vitest';
import { spawnSync } from 'child_process';
import path from 'path';

describe('phase3 verifier closeout behavior', () => {
  it('does not reject Phase 9 local national-team contract tests as Phase 3 hardcoded tournament violations', () => {
    const tsxCli = path.resolve('node_modules/tsx/dist/cli.mjs');
    const result = spawnSync(process.execPath, [tsxCli, 'scripts/phase3-verify.ts'], {
      cwd: process.cwd(),
      encoding: 'utf-8'
    });

    expect(result.status).toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain('local-match-contracts.test.ts');
  }, 15000);
});
