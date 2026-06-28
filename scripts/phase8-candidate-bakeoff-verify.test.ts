import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPhase84Preflight } from './phase8-candidate-bakeoff-verify.js';

const tempRoots: string[] = [];

function makeTempRoot(): string {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase8-4-'));
  tempRoots.push(rootDir);
  fs.mkdirSync(path.join(rootDir, 'apps/local-ai/reports'), { recursive: true });
  return rootDir;
}

afterEach(() => {
  for (const rootDir of tempRoots.splice(0)) {
    fs.rmSync(rootDir, { recursive: true, force: true });
  }
});

describe('verifyPhase84Preflight', () => {
  it('throws when Phase 8.3A did not mark phase84DataReady=true', () => {
    const rootDir = makeTempRoot();

    fs.writeFileSync(
      path.join(rootDir, 'apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json'),
      `${JSON.stringify({ phase84DataReady: false }, null, 2)}\n`,
      'utf8'
    );

    expect(() => verifyPhase84Preflight(rootDir)).toThrow(
      'Phase 8.4 requires phase84DataReady=true from Phase 8.3A.'
    );
  });
});
