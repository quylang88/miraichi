import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPhase85Preflight } from './phase8-experimental-report-surface-verify.js';

const roots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase85-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'apps/local-ai/reports'), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Phase 8.5 experimental report surface verifier', () => {
  it('blocks when the Phase 8.4 bake-off report is missing', () => {
    const root = makeRoot();

    expect(() => verifyPhase85Preflight(root)).toThrow(
      'Phase 8.5 requires the Phase 8.4 candidate bake-off JSON report.'
    );
  });

  it('blocks when Phase 8.4 already selected a model', () => {
    const root = makeRoot();
    fs.writeFileSync(
      path.join(root, 'apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json'),
      JSON.stringify({
        reportId: 'phase-8-4-candidate-model-bakeoff',
        selectedCandidateId: 'elo_rating_v0',
        selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr'
      }),
      'utf8'
    );

    expect(() => verifyPhase85Preflight(root)).toThrow(
      'Phase 8.5 cannot run after a candidate has been selected.'
    );
  });
});
