# Phase 8.5 Owner-Only Experimental Report Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local owner-only experimental report surface that makes Phase 8 model evidence inspectable without exposing public predictions, production model state, betting advice, or club competition support.

**Architecture:** Phase 8.5 stays inside `apps/local-ai`, `scripts`, and `docs/data`. It reads the generated Phase 8.4 candidate bake-off report, converts it into an owner-only report surface view model, and writes JSON/Markdown evidence artifacts. No web route, API route, runtime prediction path, model artifact, or product recommendation surface is created.

**Tech Stack:** TypeScript, Vitest, existing Phase 8.4 JSON report, `tsx` phase script, local Markdown/JSON artifacts.

---

## Scope Boundary

### Allowed

- Add a local-only report surface module under `apps/local-ai/src/reports`.
- Read the Phase 8.4 candidate bake-off JSON report.
- Produce owner-readable JSON and Markdown evidence surfaces.
- Display dataset/version metadata, candidate metrics, calibration-bin summaries, warnings, known weaknesses, and explicit non-authorizations.
- Add `pnpm run phase8:experimental-report-surface`.

### Blocked

- No public prediction route.
- No web app diagnostics view in this implementation plan.
- No `engineMode: production`.
- No selected model.
- No "best bet", "recommended pick", "recommended bet", or similar recommendation label.
- No stake sizing, Kelly, bankroll, ROI, CLV, or profit advice.
- No model artifacts such as `.onnx`, `.pkl`, `.bin`, `.joblib`, or generated weights.
- No club competition expansion, including Premier League.

## Gate Inputs

Phase 8.5 may start only after these files exist:

- `apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json`
- `docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md`

The Phase 8.4 report must keep:

- `selectedCandidateId: null`
- `selectionAuthority: "blocked_until_phase_8_6_model_selection_adr"`
- warnings for high variance and missing bookmaker baseline

## File Map

- Create: `apps/local-ai/src/reports/experimental-report-surface.ts` - owner-only report surface builder and Markdown generator.
- Create: `apps/local-ai/src/reports/experimental-report-surface.test.ts` - guardrail and formatting tests.
- Create: `scripts/phase8-experimental-report-surface-verify.ts` - phase verifier and artifact generator.
- Create: `scripts/phase8-experimental-report-surface-verify.test.ts` - preflight and non-authorization tests.
- Modify: `package.json` - add `phase8:experimental-report-surface`.
- Create: `apps/local-ai/reports/phase-8-5-owner-only-experimental-report-surface.json` - generated JSON artifact.
- Create: `docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md` - generated Markdown artifact.
- Modify: `PROJECT_PLAN.md` - mark Phase 8.5 plan as created after this plan exists; mark Phase 8.5 complete only after implementation and verification pass.

---

### Task 1: Build Owner-Only Report Surface Model

**Files:**
- Create: `apps/local-ai/src/reports/experimental-report-surface.ts`
- Create: `apps/local-ai/src/reports/experimental-report-surface.test.ts`

- [ ] **Step 1: Write the failing report surface test**

Create `apps/local-ai/src/reports/experimental-report-surface.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import {
  buildExperimentalReportSurface,
  generateExperimentalReportSurfaceMarkdown,
  type CandidateBakeoffReportForSurface
} from './experimental-report-surface.js';

function bakeoffReport(): CandidateBakeoffReportForSurface {
  return {
    reportId: 'phase-8-4-candidate-model-bakeoff',
    phase: '8.4',
    status: 'pass',
    datasetId: 'dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro',
    competitionIds: ['comp-int-world-cup', 'comp-int-euro'],
    featureSpecVersion: 'feature-spec-v0.1.0',
    sampleCount: 107,
    bookmakerBaselineAvailable: false,
    rankedCandidateIds: ['elo_rating_v0', 'multinomial_logistic_competition_v0'],
    selectedCandidateId: null,
    selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr',
    warnings: [
      'Test sample count is 107; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.',
      'Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.'
    ],
    forbiddenScope: [
      'model_selection',
      'runtime_prediction',
      'betting_recommendation',
      'stake_sizing',
      'club_competition_expansion'
    ],
    candidateResults: [
      {
        candidateId: 'elo_rating_v0',
        candidateFamily: 'elo_rating',
        trainedOnSplitNames: ['train', 'validation'],
        evaluatedOnSplitName: 'test',
        evaluatedSampleCount: 107,
        metrics: {
          brierScore: 0.628985,
          logLoss: 1.048001,
          classAccuracy: 0.514019,
          expectedCalibrationError: {
            ece: 0.044913,
            sampleCount: 107,
            binCount: 10,
            bins: []
          }
        }
      }
    ]
  };
}

describe('Phase 8.5 experimental report surface', () => {
  it('builds an owner-only experimental surface without selecting a model', () => {
    const surface = buildExperimentalReportSurface(bakeoffReport());

    expect(surface.reportId).toBe('phase-8-5-owner-only-experimental-report-surface');
    expect(surface.phase).toBe('8.5');
    expect(surface.audience).toBe('owner_only');
    expect(surface.experimentLabel).toBe('experimental_not_production_ready');
    expect(surface.selectedCandidateId).toBeNull();
    expect(surface.nextAllowedPhase).toBe('phase:plan Phase 8.6 Model Selection ADR');
    expect(surface.candidateEvidence).toHaveLength(1);
    expect(surface.candidateEvidence[0]?.candidateId).toBe('elo_rating_v0');
    expect(surface.nonAuthorizations).toContain('No public prediction surface.');
    expect(surface.nonAuthorizations).toContain('No betting recommendation.');
    expect(surface.knownWeaknesses).toContain('Test sample count is 107; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.');
  });

  it('generates Markdown that cannot be confused with production or betting advice', () => {
    const markdown = generateExperimentalReportSurfaceMarkdown(
      buildExperimentalReportSurface(bakeoffReport())
    );

    expect(markdown).toContain('Owner-Only Experimental Report Surface');
    expect(markdown).toContain('Experimental, not production ready.');
    expect(markdown).toContain('No public prediction surface.');
    expect(markdown).toContain('No `engineMode: production`.');
    expect(markdown).toContain('No betting recommendation.');
    expect(markdown).toContain('No stake sizing, Kelly, bankroll, ROI, or CLV.');
    expect(markdown).toContain('No club competition expansion.');
    expect(markdown).not.toMatch(/best bet|recommended pick|recommended bet/i);
  });

  it('rejects a bake-off report that already selected a model', () => {
    const report = {
      ...bakeoffReport(),
      selectedCandidateId: 'elo_rating_v0'
    } as unknown as CandidateBakeoffReportForSurface;

    expect(() => buildExperimentalReportSurface(report)).toThrow(
      'Phase 8.5 cannot surface a selected model before Phase 8.6 Model Selection ADR.'
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/reports/experimental-report-surface.test.ts
```

Expected: FAIL because `experimental-report-surface.ts` does not exist.

- [ ] **Step 3: Implement the report surface builder**

Create `apps/local-ai/src/reports/experimental-report-surface.ts`:

```typescript
import type { CandidateEvaluationResult } from '../candidates/candidate-types.js';

export type CandidateBakeoffReportForSurface = {
  reportId: 'phase-8-4-candidate-model-bakeoff';
  phase: '8.4';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionIds: readonly string[];
  featureSpecVersion: string;
  sampleCount: number;
  bookmakerBaselineAvailable: boolean;
  candidateResults: readonly CandidateEvaluationResult[];
  rankedCandidateIds: readonly string[];
  selectedCandidateId: string | null;
  selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr';
  warnings: readonly string[];
  forbiddenScope: readonly string[];
};

export type ExperimentalCandidateEvidence = {
  candidateId: string;
  candidateFamily: string;
  rank: number | null;
  trainedOnSplitNames: readonly string[];
  evaluatedOnSplitName: string;
  evaluatedSampleCount: number;
  metrics: {
    brierScore: number;
    logLoss: number;
    classAccuracy: number;
    expectedCalibrationError: number;
    calibrationBinCount: number;
  };
};

export type ExperimentalReportSurface = {
  reportId: 'phase-8-5-owner-only-experimental-report-surface';
  phase: '8.5';
  sourceReportId: string;
  audience: 'owner_only';
  experimentLabel: 'experimental_not_production_ready';
  datasetId: string;
  competitionIds: readonly string[];
  featureSpecVersion: string;
  sampleCount: number;
  bookmakerBaselineAvailable: boolean;
  selectedCandidateId: null;
  selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr';
  nextAllowedPhase: 'phase:plan Phase 8.6 Model Selection ADR';
  candidateEvidence: ExperimentalCandidateEvidence[];
  knownWeaknesses: string[];
  nonAuthorizations: string[];
};

const NON_AUTHORIZATIONS = [
  'No public prediction surface.',
  'No `engineMode: production`.',
  'No model selected.',
  'No betting recommendation.',
  'No stake sizing, Kelly, bankroll, ROI, or CLV.',
  'No club competition expansion.'
] as const;

function rankForCandidate(report: CandidateBakeoffReportForSurface, candidateId: string): number | null {
  const index = report.rankedCandidateIds.indexOf(candidateId);
  return index < 0 ? null : index + 1;
}

function evidenceForCandidate(
  report: CandidateBakeoffReportForSurface,
  candidate: CandidateEvaluationResult
): ExperimentalCandidateEvidence {
  return {
    candidateId: candidate.candidateId,
    candidateFamily: candidate.candidateFamily,
    rank: rankForCandidate(report, candidate.candidateId),
    trainedOnSplitNames: candidate.trainedOnSplitNames,
    evaluatedOnSplitName: candidate.evaluatedOnSplitName,
    evaluatedSampleCount: candidate.evaluatedSampleCount,
    metrics: {
      brierScore: candidate.metrics.brierScore,
      logLoss: candidate.metrics.logLoss,
      classAccuracy: candidate.metrics.classAccuracy,
      expectedCalibrationError: candidate.metrics.expectedCalibrationError.ece,
      calibrationBinCount: candidate.metrics.expectedCalibrationError.binCount
    }
  };
}

export function buildExperimentalReportSurface(
  report: CandidateBakeoffReportForSurface
): ExperimentalReportSurface {
  if (report.selectedCandidateId !== null) {
    throw new Error('Phase 8.5 cannot surface a selected model before Phase 8.6 Model Selection ADR.');
  }

  return {
    reportId: 'phase-8-5-owner-only-experimental-report-surface',
    phase: '8.5',
    sourceReportId: report.reportId,
    audience: 'owner_only',
    experimentLabel: 'experimental_not_production_ready',
    datasetId: report.datasetId,
    competitionIds: [...report.competitionIds],
    featureSpecVersion: report.featureSpecVersion,
    sampleCount: report.sampleCount,
    bookmakerBaselineAvailable: report.bookmakerBaselineAvailable,
    selectedCandidateId: null,
    selectionAuthority: report.selectionAuthority,
    nextAllowedPhase: 'phase:plan Phase 8.6 Model Selection ADR',
    candidateEvidence: report.candidateResults.map((candidate) => evidenceForCandidate(report, candidate)),
    knownWeaknesses: [...report.warnings],
    nonAuthorizations: [...NON_AUTHORIZATIONS]
  };
}

function formatList(values: readonly string[]): string {
  if (values.length === 0) return '- None.';
  return values.map((value) => `- ${value}`).join('\n');
}

function formatCandidateEvidence(candidates: readonly ExperimentalCandidateEvidence[]): string {
  if (candidates.length === 0) return '- No candidate evidence available.';

  return candidates
    .map((candidate) =>
      `- Rank ${candidate.rank ?? 'unranked'}: \`${candidate.candidateId}\` (${candidate.candidateFamily}) - ` +
      `LogLoss=${candidate.metrics.logLoss.toFixed(6)}, ` +
      `Brier=${candidate.metrics.brierScore.toFixed(6)}, ` +
      `Accuracy=${candidate.metrics.classAccuracy.toFixed(6)}, ` +
      `ECE=${candidate.metrics.expectedCalibrationError.toFixed(6)}, ` +
      `N=${candidate.evaluatedSampleCount}`
    )
    .join('\n');
}

export function generateExperimentalReportSurfaceMarkdown(surface: ExperimentalReportSurface): string {
  return `# Phase 8.5 Owner-Only Experimental Report Surface

## Status
- **Audience**: owner-only
- **Label**: Experimental, not production ready.
- **Source report**: \`${surface.sourceReportId}\`
- **Selected candidate**: null
- **Selection authority**: \`${surface.selectionAuthority}\`

## Dataset Evidence
- Dataset: \`${surface.datasetId}\`
- Competitions: ${surface.competitionIds.map((id) => `\`${id}\``).join(', ')}
- Feature spec version: \`${surface.featureSpecVersion}\`
- Test sample count: ${surface.sampleCount}
- Bookmaker baseline available: ${surface.bookmakerBaselineAvailable ? 'yes' : 'no'}

## Candidate Evidence
${formatCandidateEvidence(surface.candidateEvidence)}

## Known Weaknesses
${formatList(surface.knownWeaknesses)}

## Explicit Non-Authorizations
${formatList(surface.nonAuthorizations)}

## Next Allowed Phase
\`${surface.nextAllowedPhase}\`
`;
}
```

- [ ] **Step 4: Run the report surface test**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/reports/experimental-report-surface.test.ts
```

Expected: PASS.

---

### Task 2: Add Phase 8.5 Verification Script

**Files:**
- Create: `scripts/phase8-experimental-report-surface-verify.ts`
- Create: `scripts/phase8-experimental-report-surface-verify.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Write the failing script test**

Create `scripts/phase8-experimental-report-surface-verify.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run scripts/phase8-experimental-report-surface-verify.test.ts
```

Expected: FAIL because `phase8-experimental-report-surface-verify.ts` does not exist.

- [ ] **Step 3: Implement the verification script**

Create `scripts/phase8-experimental-report-surface-verify.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildExperimentalReportSurface,
  generateExperimentalReportSurfaceMarkdown,
  type CandidateBakeoffReportForSurface
} from '../apps/local-ai/src/reports/experimental-report-surface.js';

const BAKEOFF_REPORT_PATH = 'apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json';
const SURFACE_REPORT_PATH = 'apps/local-ai/reports/phase-8-5-owner-only-experimental-report-surface.json';
const SURFACE_MARKDOWN_PATH = 'docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md';

function bakeoffReportPath(rootDir: string): string {
  return path.join(rootDir, BAKEOFF_REPORT_PATH);
}

export function verifyPhase85Preflight(rootDir: string): void {
  const sourcePath = bakeoffReportPath(rootDir);
  if (!fs.existsSync(sourcePath)) {
    throw new Error('Phase 8.5 requires the Phase 8.4 candidate bake-off JSON report.');
  }

  const report = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as Partial<CandidateBakeoffReportForSurface>;
  if (report.selectedCandidateId !== null) {
    throw new Error('Phase 8.5 cannot run after a candidate has been selected.');
  }

  if (report.selectionAuthority !== 'blocked_until_phase_8_6_model_selection_adr') {
    throw new Error('Phase 8.5 requires model selection authority to remain blocked until Phase 8.6.');
  }
}

export function generatePhase85Report(rootDir: string) {
  verifyPhase85Preflight(rootDir);
  const sourcePath = bakeoffReportPath(rootDir);
  const bakeoffReport = JSON.parse(fs.readFileSync(sourcePath, 'utf8')) as CandidateBakeoffReportForSurface;
  return buildExperimentalReportSurface(bakeoffReport);
}

export function main(): void {
  const rootDir = process.cwd();
  const surface = generatePhase85Report(rootDir);
  const reportPath = path.join(rootDir, SURFACE_REPORT_PATH);
  const markdownPath = path.join(rootDir, SURFACE_MARKDOWN_PATH);

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.mkdirSync(path.dirname(markdownPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(surface, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdownPath, generateExperimentalReportSurfaceMarkdown(surface), 'utf8');

  if (surface.selectedCandidateId !== null || surface.audience !== 'owner_only') {
    console.error(`[Phase 8.5 Experimental Report Surface] FAILED. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`[Phase 8.5 Experimental Report Surface] PASSED. Report: ${reportPath}`);
  console.log(`[Phase 8.5 Experimental Report Surface] Audience: ${surface.audience}`);
  console.log(`[Phase 8.5 Experimental Report Surface] Selected candidate: none`);
}

const currentModulePath = fileURLToPath(import.meta.url);
const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isMain = Boolean(invokedPath) && (
  invokedPath === path.resolve(currentModulePath) ||
  invokedPath.endsWith('phase8-experimental-report-surface-verify.ts') ||
  invokedPath.endsWith('phase8-experimental-report-surface-verify.js') ||
  invokedPath.endsWith('phase8-experimental-report-surface-verify')
);

if (isMain) {
  main();
}
```

- [ ] **Step 4: Add the package script**

Modify root `package.json` scripts:

```json
"phase8:experimental-report-surface": "tsx scripts/phase8-experimental-report-surface-verify.ts"
```

Place it after `phase8:candidate-bakeoff`.

- [ ] **Step 5: Run script tests**

Run:

```bash
pnpm exec vitest run scripts/phase8-experimental-report-surface-verify.test.ts
pnpm run typecheck
```

Expected: PASS.

---

### Task 3: Generate Phase 8.5 Owner-Only Artifacts

**Files:**
- Create: `apps/local-ai/reports/phase-8-5-owner-only-experimental-report-surface.json`
- Create: `docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md`

- [ ] **Step 1: Regenerate Phase 8.4 input report**

Run:

```bash
pnpm run phase8:candidate-bakeoff
```

Expected: PASS and prints `Selected candidate: none`.

- [ ] **Step 2: Generate Phase 8.5 surface artifacts**

Run:

```bash
pnpm run phase8:experimental-report-surface
```

Expected: PASS and writes:

- `apps/local-ai/reports/phase-8-5-owner-only-experimental-report-surface.json`
- `docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md`

- [ ] **Step 3: Inspect generated JSON**

Run:

```bash
node -e "const fs=require('fs'); const r=JSON.parse(fs.readFileSync('apps/local-ai/reports/phase-8-5-owner-only-experimental-report-surface.json','utf8')); console.log(JSON.stringify({audience:r.audience,label:r.experimentLabel,selectedCandidateId:r.selectedCandidateId,nextAllowedPhase:r.nextAllowedPhase}, null, 2));"
```

Expected output includes:

```json
{
  "audience": "owner_only",
  "label": "experimental_not_production_ready",
  "selectedCandidateId": null,
  "nextAllowedPhase": "phase:plan Phase 8.6 Model Selection ADR"
}
```

- [ ] **Step 4: Inspect generated Markdown for forbidden labels**

Run:

```bash
rg -n "best bet|recommended pick|recommended bet|engineMode: production|public prediction" docs/data/PHASE-8-5-OWNER-ONLY-EXPERIMENTAL-REPORT-SURFACE.md
```

Expected: only allowed non-authorization lines may appear for `engineMode: production` and `public prediction`; no positive recommendation labels appear.

---

### Task 4: Close Phase 8.5 Without Runtime Or Model Selection

**Files:**
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/reports scripts/phase8-experimental-report-surface-verify.test.ts
pnpm run phase8:experimental-report-surface
```

Expected: PASS.

- [ ] **Step 2: Run local verification**

Run:

```bash
pnpm run verify:local
```

Expected: PASS.

- [ ] **Step 3: Update Project Plan after verification passes**

Modify `PROJECT_PLAN.md`:

```markdown
- [x] Create `phase:implementation-plan Phase 8.5 Owner-Only Experimental Report Surface`.
- [x] Complete Phase 8.5 Owner-Only Experimental Report Surface before Phase 8.6 Model Selection ADR.
  - **Result**: Owner-only experimental JSON/Markdown report surface generated from Phase 8.4 evidence. No model selected and no runtime prediction surface created.
  - **Constraints**: The report surface remains owner-only and experimental. It does not expose public predictions, `engineMode: production`, recommendation labels, stake advice, bankroll advice, ROI, CLV, Kelly logic, or club competition expansion.
```

- [ ] **Step 4: Confirm next phase remains planning-only**

The next safe lifecycle command after Phase 8.5 closeout is:

```text
phase:plan Phase 8.6 Model Selection ADR
```

Expected: This is an ADR planning phase only. It may select `no model`. It must not create runtime routes or model artifacts.

## Self-Review Checklist

- Spec coverage: covers local JSON/Markdown report surface, owner-only labels, model/version/dataset/metric evidence, known weaknesses, and explicit non-authorizations.
- Placeholder scan: no `TBD`, no vague test instructions, no unqualified file paths.
- Type consistency: `CandidateBakeoffReportForSurface`, `ExperimentalReportSurface`, and script output paths match across tasks.
- Guardrails: no public prediction route, no production engine mode, no selected model, no betting/stake/Kelly/bankroll/ROI/CLV, no club expansion, no model artifacts.
