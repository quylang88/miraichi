# Phase 8.3 Evaluation Harness and Baselines Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an owner-only Phase 8.3 evaluation harness that scores 1X2 probability baselines with Brier Score, ECE, log loss, class accuracy, sample counts, and explicit low-sample warnings before any candidate model bake-off.

**Architecture:** Phase 8.3 stays inside `apps/local-ai` and `scripts/`, reads the existing World Cup/national-team-first processed JSONL snapshot, evaluates simple non-model baselines, and writes a reproducible report. The harness must not train a model, expose real runtime prediction, make betting recommendations, or block on adding more national-team competitions before the harness exists; it must plainly report that World Cup-only samples are audit/plumbing evidence, not reliable calibration evidence.

**Tech Stack:** TypeScript, Vitest, Node.js `fs`/`path`, existing `tsx` script execution, existing Phase 8.1/8.2 processed dataset and feature audit artifacts. No external metrics library is allowed for Brier Score, ECE, or log loss.

---

## Scope Boundary

### Allowed

- Pure TypeScript evaluation metrics in `apps/local-ai`.
- JSONL dataset loading from `apps/local-ai/data/processed/comp-int-world-cup`.
- Simple deterministic baselines: uniform 1X2, smoothed train-split outcome frequency, and bookmaker baseline only when pre-match market probabilities exist.
- Owner-only JSON/Markdown reports under `apps/local-ai/reports/` and `docs/data/`.
- Non-blocking readiness indicators for ADR-0040 gates.

### Blocked

- No model training, LightGBM, CatBoost, XGBoost, logistic regression, Elo calculation, Poisson model, ONNX, or candidate model bake-off.
- No `/ai/v1/predict` real inference and no public prediction surface.
- No betting ROI, CLV, Kelly, stake sizing, bankroll, recommendation ranking, or "best bet" labels.
- No club/Premier League dataset expansion.
- No paid provider integration, secrets, staging deploy, or production promotion.

## File Map

- Modify: `apps/local-ai/src/evaluation/evaluation-metrics.ts` - pure metric primitives.
- Modify: `apps/local-ai/src/evaluation/evaluation-metrics.test.ts` - metric tests.
- Create: `apps/local-ai/src/evaluation/evaluation-dataset.ts` - processed JSONL loader and score-to-outcome mapping.
- Create: `apps/local-ai/src/evaluation/evaluation-dataset.test.ts` - loader and outcome tests.
- Create: `apps/local-ai/src/evaluation/evaluation-baselines.ts` - uniform, train-frequency, and market-baseline availability functions.
- Create: `apps/local-ai/src/evaluation/evaluation-baselines.test.ts` - baseline tests.
- Create: `apps/local-ai/src/evaluation/evaluation-report.ts` - report builder and readiness warnings.
- Create: `apps/local-ai/src/evaluation/evaluation-report.test.ts` - report tests.
- Create: `scripts/phase8-evaluation-harness-verify.ts` - report generation script.
- Modify: `package.json` - add `phase8:evaluation-harness`.
- Create: `apps/local-ai/reports/phase-8-3-evaluation-harness-baselines.json` - generated owner-only report.
- Create: `docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md` - human-readable report.
- Modify: `PROJECT_PLAN.md` - mark implementation plan created and keep Phase 8.3 completion open until the report exists.

---

### Task 1: Complete Pure TypeScript Metric Primitives

**Files:**
- Modify: `apps/local-ai/src/evaluation/evaluation-metrics.test.ts`
- Modify: `apps/local-ai/src/evaluation/evaluation-metrics.ts`

- [ ] **Step 1: Write the failing class-accuracy test**

Add this test to `apps/local-ai/src/evaluation/evaluation-metrics.test.ts`:

```typescript
import { classAccuracy } from './evaluation-metrics.js';

it('calculates class accuracy from argmax probability predictions', () => {
  expect(classAccuracy(samples)).toBeCloseTo(1, 10);
  expect(
    classAccuracy([
      {
        actualOutcome: 'home',
        probabilities: { home: 0.2, draw: 0.7, away: 0.1 }
      },
      {
        actualOutcome: 'away',
        probabilities: { home: 0.1, draw: 0.2, away: 0.7 }
      }
    ])
  ).toBeCloseTo(0.5, 10);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-metrics.test.ts
```

Expected: FAIL because `classAccuracy` is not exported.

- [ ] **Step 3: Implement `classAccuracy`**

Add this function to `apps/local-ai/src/evaluation/evaluation-metrics.ts`:

```typescript
export function classAccuracy(samples: readonly EvaluationSample[]): number {
  assertValidSamples(samples);

  const correctCount = samples.reduce((count, sample) => {
    return count + (predictedOutcome(sample.probabilities) === sample.actualOutcome ? 1 : 0);
  }, 0);

  return correctCount / samples.length;
}
```

- [ ] **Step 4: Run the metric tests**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-metrics.test.ts
```

Expected: PASS.

- [ ] **Step 5: Confirm there is no metrics dependency**

Run:

```bash
rg -n "brier|calibration|ece|log-loss|logloss|metrics" package.json apps/local-ai/package.json
```

Expected: no external metrics package added to dependencies.

---

### Task 2: Load Processed Evaluation Fixtures

**Files:**
- Create: `apps/local-ai/src/evaluation/evaluation-dataset.test.ts`
- Create: `apps/local-ai/src/evaluation/evaluation-dataset.ts`

- [ ] **Step 1: Write the failing dataset loader tests**

Create `apps/local-ai/src/evaluation/evaluation-dataset.test.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  actualOutcomeFromScores,
  loadEvaluationDataset,
  type ProcessedMatchRecord
} from './evaluation-dataset.js';

describe('Phase 8.3 evaluation dataset loader', () => {
  it('maps completed match scores to 1X2 outcomes', () => {
    expect(actualOutcomeFromScores({ homeScore: 2, awayScore: 0 })).toBe('home');
    expect(actualOutcomeFromScores({ homeScore: 1, awayScore: 1 })).toBe('draw');
    expect(actualOutcomeFromScores({ homeScore: 0, awayScore: 3 })).toBe('away');
  });

  it('loads the existing World Cup processed dataset with chronological split labels', () => {
    const dataset = loadEvaluationDataset(
      path.resolve(process.cwd(), 'data/processed/comp-int-world-cup')
    );

    expect(dataset.competitionId).toBe('comp-int-world-cup');
    expect(dataset.train).toHaveLength(1);
    expect(dataset.validation).toHaveLength(1);
    expect(dataset.test).toHaveLength(1);
    expect(dataset.test[0]).toEqual(
      expect.objectContaining({
        matchId: 'match-wc-2022-sample-1',
        split: 'test',
        actualOutcome: 'home'
      })
    );
    expect(dataset.skippedRecordCount).toBe(0);
  });

  it('skips records without completed scores instead of inventing labels', () => {
    const tmpDir = fs.mkdtempSync(path.join(process.cwd(), 'tmp-evaluation-dataset-'));
    const record: ProcessedMatchRecord = {
      id: 'match-scheduled',
      competitionId: 'comp-int-world-cup',
      seasonId: 'season-2026',
      homeTeamId: 'team-home-national',
      awayTeamId: 'team-away-national',
      status: 'scheduled',
      kickoffTime: '2026-06-28T12:00:00Z',
      scores: null
    };

    fs.writeFileSync(path.join(tmpDir, 'train.jsonl'), `${JSON.stringify(record)}\n`, 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'val.jsonl'), '', 'utf8');
    fs.writeFileSync(path.join(tmpDir, 'test.jsonl'), '', 'utf8');
    fs.writeFileSync(
      path.join(tmpDir, 'metadata.json'),
      JSON.stringify({
        datasetId: 'dataset-test',
        competitionId: 'comp-int-world-cup',
        schemaVersion: '1.0.0',
        featureSpecVersion: 'feature-spec-v0.1.0',
        sourceProviderId: 'test',
        sourceSnapshotHash: 'hash',
        builtAt: '2026-06-28T00:00:00Z',
        trainCount: 1,
        valCount: 0,
        testCount: 0
      }),
      'utf8'
    );

    const dataset = loadEvaluationDataset(tmpDir);

    expect(dataset.train).toEqual([]);
    expect(dataset.skippedRecordCount).toBe(1);

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-dataset.test.ts
```

Expected: FAIL because `evaluation-dataset.ts` does not exist.

- [ ] **Step 3: Implement the dataset loader**

Create `apps/local-ai/src/evaluation/evaluation-dataset.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import type { OutcomeClass, OutcomeProbabilities } from './evaluation-metrics.js';

export type EvaluationSplitName = 'train' | 'validation' | 'test';

export type ProcessedMatchScores = {
  homeScore: number;
  awayScore: number;
};

export type ProcessedMatchRecord = {
  id: string;
  competitionId: string;
  seasonId: string;
  homeTeamId: string;
  awayTeamId: string;
  status: string;
  kickoffTime: string;
  scores?: ProcessedMatchScores | null;
  marketHomeImpliedProbabilityPreMatch?: number | null;
  marketDrawImpliedProbabilityPreMatch?: number | null;
  marketAwayImpliedProbabilityPreMatch?: number | null;
};

export type EvaluationFixture = {
  matchId: string;
  split: EvaluationSplitName;
  competitionId: string;
  kickoffTime: string;
  actualOutcome: OutcomeClass;
  marketProbabilities?: OutcomeProbabilities;
};

export type EvaluationDatasetMetadata = {
  datasetId: string;
  competitionId: string;
  schemaVersion: string;
  featureSpecVersion: string;
  sourceProviderId: string;
  sourceSnapshotHash: string;
  builtAt: string;
  trainCount: number;
  valCount: number;
  testCount: number;
};

export type EvaluationDataset = {
  metadata: EvaluationDatasetMetadata;
  competitionId: string;
  train: EvaluationFixture[];
  validation: EvaluationFixture[];
  test: EvaluationFixture[];
  skippedRecordCount: number;
};

export function actualOutcomeFromScores(scores: ProcessedMatchScores): OutcomeClass {
  if (scores.homeScore > scores.awayScore) return 'home';
  if (scores.homeScore < scores.awayScore) return 'away';
  return 'draw';
}

function readJsonl(filePath: string): ProcessedMatchRecord[] {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing evaluation split file: ${filePath}`);
  }

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as ProcessedMatchRecord);
}

function marketProbabilitiesFromRecord(record: ProcessedMatchRecord): OutcomeProbabilities | undefined {
  const probabilities = {
    home: record.marketHomeImpliedProbabilityPreMatch,
    draw: record.marketDrawImpliedProbabilityPreMatch,
    away: record.marketAwayImpliedProbabilityPreMatch
  };

  if (
    probabilities.home === undefined ||
    probabilities.home === null ||
    probabilities.draw === undefined ||
    probabilities.draw === null ||
    probabilities.away === undefined ||
    probabilities.away === null
  ) {
    return undefined;
  }

  return {
    home: probabilities.home,
    draw: probabilities.draw,
    away: probabilities.away
  };
}

function toEvaluationFixtures(
  records: readonly ProcessedMatchRecord[],
  split: EvaluationSplitName
): { fixtures: EvaluationFixture[]; skippedRecordCount: number } {
  const fixtures: EvaluationFixture[] = [];
  let skippedRecordCount = 0;

  for (const record of records) {
    if (!record.scores) {
      skippedRecordCount += 1;
      continue;
    }

    fixtures.push({
      matchId: record.id,
      split,
      competitionId: record.competitionId,
      kickoffTime: record.kickoffTime,
      actualOutcome: actualOutcomeFromScores(record.scores),
      marketProbabilities: marketProbabilitiesFromRecord(record)
    });
  }

  return { fixtures, skippedRecordCount };
}

export function loadEvaluationDataset(processedDir: string): EvaluationDataset {
  const metadataPath = path.join(processedDir, 'metadata.json');
  if (!fs.existsSync(metadataPath)) {
    throw new Error(`Missing evaluation metadata file: ${metadataPath}`);
  }

  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8')) as EvaluationDatasetMetadata;
  const train = toEvaluationFixtures(readJsonl(path.join(processedDir, 'train.jsonl')), 'train');
  const validation = toEvaluationFixtures(readJsonl(path.join(processedDir, 'val.jsonl')), 'validation');
  const test = toEvaluationFixtures(readJsonl(path.join(processedDir, 'test.jsonl')), 'test');

  return {
    metadata,
    competitionId: metadata.competitionId,
    train: train.fixtures,
    validation: validation.fixtures,
    test: test.fixtures,
    skippedRecordCount:
      train.skippedRecordCount + validation.skippedRecordCount + test.skippedRecordCount
  };
}
```

- [ ] **Step 4: Run the dataset loader tests**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-dataset.test.ts
```

Expected: PASS.

---

### Task 3: Build Simple Baseline Probability Generators

**Files:**
- Create: `apps/local-ai/src/evaluation/evaluation-baselines.test.ts`
- Create: `apps/local-ai/src/evaluation/evaluation-baselines.ts`

- [ ] **Step 1: Write the failing baseline tests**

Create `apps/local-ai/src/evaluation/evaluation-baselines.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { EvaluationFixture } from './evaluation-dataset.js';
import {
  bookmakerBaselineForFixture,
  smoothedOutcomeFrequencyBaseline,
  uniformBaseline
} from './evaluation-baselines.js';

const trainFixtures: EvaluationFixture[] = [
  {
    matchId: 'match-1',
    split: 'train',
    competitionId: 'comp-int-world-cup',
    kickoffTime: '2014-06-16T13:00:00Z',
    actualOutcome: 'home'
  },
  {
    matchId: 'match-2',
    split: 'train',
    competitionId: 'comp-int-world-cup',
    kickoffTime: '2018-07-15T18:00:00Z',
    actualOutcome: 'draw'
  }
];

describe('Phase 8.3 evaluation baselines', () => {
  it('builds a uniform 1X2 baseline', () => {
    expect(uniformBaseline().probabilities).toEqual({
      home: 1 / 3,
      draw: 1 / 3,
      away: 1 / 3
    });
  });

  it('builds a smoothed train-split outcome frequency baseline', () => {
    const baseline = smoothedOutcomeFrequencyBaseline(trainFixtures);

    expect(baseline.id).toBe('train_outcome_frequency_smoothed');
    expect(baseline.probabilities).toEqual({
      home: 0.4,
      draw: 0.4,
      away: 0.2
    });
  });

  it('returns bookmaker probabilities only when all pre-match market probabilities exist', () => {
    expect(
      bookmakerBaselineForFixture({
        matchId: 'match-market',
        split: 'test',
        competitionId: 'comp-int-world-cup',
        kickoffTime: '2022-11-26T22:00:00Z',
        actualOutcome: 'home',
        marketProbabilities: { home: 0.5, draw: 0.25, away: 0.25 }
      })
    ).toEqual({
      id: 'bookmaker_implied_pre_match',
      probabilities: { home: 0.5, draw: 0.25, away: 0.25 }
    });

    expect(
      bookmakerBaselineForFixture({
        matchId: 'match-no-market',
        split: 'test',
        competitionId: 'comp-int-world-cup',
        kickoffTime: '2022-11-26T22:00:00Z',
        actualOutcome: 'home'
      })
    ).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-baselines.test.ts
```

Expected: FAIL because `evaluation-baselines.ts` does not exist.

- [ ] **Step 3: Implement simple baselines**

Create `apps/local-ai/src/evaluation/evaluation-baselines.ts`:

```typescript
import type { EvaluationFixture } from './evaluation-dataset.js';
import type { OutcomeClass, OutcomeProbabilities } from './evaluation-metrics.js';

export type BaselinePrediction = {
  id: 'uniform_1x2' | 'train_outcome_frequency_smoothed' | 'bookmaker_implied_pre_match';
  probabilities: OutcomeProbabilities;
};

const OUTCOMES: readonly OutcomeClass[] = ['home', 'draw', 'away'];
const LAPLACE_ALPHA = 1;

export function uniformBaseline(): BaselinePrediction {
  return {
    id: 'uniform_1x2',
    probabilities: {
      home: 1 / 3,
      draw: 1 / 3,
      away: 1 / 3
    }
  };
}

export function smoothedOutcomeFrequencyBaseline(
  trainFixtures: readonly EvaluationFixture[]
): BaselinePrediction {
  const counts: Record<OutcomeClass, number> = {
    home: LAPLACE_ALPHA,
    draw: LAPLACE_ALPHA,
    away: LAPLACE_ALPHA
  };

  for (const fixture of trainFixtures) {
    counts[fixture.actualOutcome] += 1;
  }

  const total = OUTCOMES.reduce((sum, outcome) => sum + counts[outcome], 0);

  return {
    id: 'train_outcome_frequency_smoothed',
    probabilities: {
      home: counts.home / total,
      draw: counts.draw / total,
      away: counts.away / total
    }
  };
}

export function bookmakerBaselineForFixture(
  fixture: EvaluationFixture
): BaselinePrediction | null {
  if (!fixture.marketProbabilities) return null;

  return {
    id: 'bookmaker_implied_pre_match',
    probabilities: fixture.marketProbabilities
  };
}
```

- [ ] **Step 4: Run the baseline tests**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-baselines.test.ts
```

Expected: PASS.

---

### Task 4: Build Evaluation Report Aggregation

**Files:**
- Create: `apps/local-ai/src/evaluation/evaluation-report.test.ts`
- Create: `apps/local-ai/src/evaluation/evaluation-report.ts`

- [ ] **Step 1: Write the failing report tests**

Create `apps/local-ai/src/evaluation/evaluation-report.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { EvaluationDataset } from './evaluation-dataset.js';
import { buildEvaluationReport } from './evaluation-report.js';

const dataset: EvaluationDataset = {
  metadata: {
    datasetId: 'dataset-comp-int-world-cup-2026-06-28',
    competitionId: 'comp-int-world-cup',
    schemaVersion: '1.0.0',
    featureSpecVersion: 'feature-spec-v0.1.0',
    sourceProviderId: 'soccerdata-fbref',
    sourceSnapshotHash: 'hash',
    builtAt: '2026-06-28T00:00:00Z',
    trainCount: 1,
    valCount: 1,
    testCount: 1
  },
  competitionId: 'comp-int-world-cup',
  train: [
    {
      matchId: 'match-train',
      split: 'train',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2014-06-16T13:00:00Z',
      actualOutcome: 'home'
    }
  ],
  validation: [
    {
      matchId: 'match-val',
      split: 'validation',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2018-07-15T18:00:00Z',
      actualOutcome: 'home'
    }
  ],
  test: [
    {
      matchId: 'match-test',
      split: 'test',
      competitionId: 'comp-int-world-cup',
      kickoffTime: '2022-11-26T22:00:00Z',
      actualOutcome: 'away'
    }
  ],
  skippedRecordCount: 0
};

describe('Phase 8.3 evaluation report', () => {
  it('evaluates simple baselines and reports low sample warnings without model training', () => {
    const report = buildEvaluationReport(dataset, { eceBinCount: 5 });

    expect(report.phase).toBe('8.3');
    expect(report.status).toBe('pass');
    expect(report.datasetId).toBe(dataset.metadata.datasetId);
    expect(report.evaluationSplit).toBe('test');
    expect(report.sampleCount).toBe(1);
    expect(report.baselines.map((baseline) => baseline.id)).toEqual([
      'uniform_1x2',
      'train_outcome_frequency_smoothed'
    ]);
    expect(report.missingBookmakerBaselineCount).toBe(1);
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.',
        'World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.'
      ])
    );
    expect(report.nonBlockingGates.sampleCountAtLeast100).toBe(false);
    expect(report.ownerDecisions.metricsImplementation).toBe('pure_typescript_no_external_metrics_library');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-report.test.ts
```

Expected: FAIL because `evaluation-report.ts` does not exist.

- [ ] **Step 3: Implement report aggregation**

Create `apps/local-ai/src/evaluation/evaluation-report.ts`:

```typescript
import {
  bookmakerBaselineForFixture,
  smoothedOutcomeFrequencyBaseline,
  uniformBaseline,
  type BaselinePrediction
} from './evaluation-baselines.js';
import type { EvaluationDataset, EvaluationFixture } from './evaluation-dataset.js';
import {
  brierScore,
  classAccuracy,
  expectedCalibrationError,
  logLoss,
  type EvaluationSample,
  type ExpectedCalibrationErrorResult
} from './evaluation-metrics.js';

export type EvaluatedBaseline = {
  id: BaselinePrediction['id'];
  evaluatedSampleCount: number;
  metrics: {
    brierScore: number;
    logLoss: number;
    classAccuracy: number;
    expectedCalibrationError: ExpectedCalibrationErrorResult;
  };
};

export type EvaluationReport = {
  reportId: string;
  phase: '8.3';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionId: string;
  featureSpecVersion: string;
  evaluationSplit: 'test';
  sampleCount: number;
  trainSampleCount: number;
  validationSampleCount: number;
  skippedRecordCount: number;
  missingBookmakerBaselineCount: number;
  baselines: EvaluatedBaseline[];
  warnings: string[];
  nonBlockingGates: {
    sampleCountAtLeast100: boolean;
    bookmakerBaselineAvailable: boolean;
  };
  ownerDecisions: {
    harnessBlocksOnAdditionalCompetitions: false;
    nationalTeamExpansionRequiredBeforeCandidateBakeOff: true;
    metricsImplementation: 'pure_typescript_no_external_metrics_library';
  };
};

export type EvaluationReportOptions = {
  eceBinCount?: number;
};

function samplesForConstantBaseline(
  fixtures: readonly EvaluationFixture[],
  baseline: BaselinePrediction
): EvaluationSample[] {
  return fixtures.map((fixture) => ({
    actualOutcome: fixture.actualOutcome,
    probabilities: baseline.probabilities
  }));
}

function evaluateBaseline(
  fixtures: readonly EvaluationFixture[],
  baseline: BaselinePrediction,
  eceBinCount: number
): EvaluatedBaseline {
  const samples = samplesForConstantBaseline(fixtures, baseline);

  return {
    id: baseline.id,
    evaluatedSampleCount: samples.length,
    metrics: {
      brierScore: brierScore(samples),
      logLoss: logLoss(samples),
      classAccuracy: classAccuracy(samples),
      expectedCalibrationError: expectedCalibrationError(samples, eceBinCount)
    }
  };
}

function evaluateBookmakerBaseline(
  fixtures: readonly EvaluationFixture[],
  eceBinCount: number
): { baseline: EvaluatedBaseline | null; missingCount: number } {
  const samples: EvaluationSample[] = [];
  let missingCount = 0;

  for (const fixture of fixtures) {
    const baseline = bookmakerBaselineForFixture(fixture);
    if (!baseline) {
      missingCount += 1;
      continue;
    }

    samples.push({
      actualOutcome: fixture.actualOutcome,
      probabilities: baseline.probabilities
    });
  }

  if (samples.length === 0) {
    return { baseline: null, missingCount };
  }

  return {
    baseline: {
      id: 'bookmaker_implied_pre_match',
      evaluatedSampleCount: samples.length,
      metrics: {
        brierScore: brierScore(samples),
        logLoss: logLoss(samples),
        classAccuracy: classAccuracy(samples),
        expectedCalibrationError: expectedCalibrationError(samples, eceBinCount)
      }
    },
    missingCount
  };
}

export function buildEvaluationReport(
  dataset: EvaluationDataset,
  options: EvaluationReportOptions = {}
): EvaluationReport {
  const eceBinCount = options.eceBinCount ?? 10;
  const evaluationFixtures = dataset.test;
  const warnings: string[] = [];

  if (evaluationFixtures.length === 0) {
    throw new Error('Phase 8.3 evaluation requires at least one scored test fixture.');
  }

  if (evaluationFixtures.length < 100) {
    warnings.push(
      'Evaluation sample count is below 100 fixtures; this is harness/plumbing evidence only, not reliable calibration evidence.'
    );
  }

  warnings.push(
    'World Cup-only evaluation must not be treated as statistically strong until related national-team competitions are added.'
  );

  const uniform = evaluateBaseline(evaluationFixtures, uniformBaseline(), eceBinCount);
  const frequency = evaluateBaseline(
    evaluationFixtures,
    smoothedOutcomeFrequencyBaseline(dataset.train),
    eceBinCount
  );
  const bookmaker = evaluateBookmakerBaseline(evaluationFixtures, eceBinCount);
  const baselines = bookmaker.baseline
    ? [uniform, frequency, bookmaker.baseline]
    : [uniform, frequency];

  return {
    reportId: `phase-8-3-evaluation-harness-${dataset.competitionId}`,
    phase: '8.3',
    status: 'pass',
    datasetId: dataset.metadata.datasetId,
    competitionId: dataset.competitionId,
    featureSpecVersion: dataset.metadata.featureSpecVersion,
    evaluationSplit: 'test',
    sampleCount: evaluationFixtures.length,
    trainSampleCount: dataset.train.length,
    validationSampleCount: dataset.validation.length,
    skippedRecordCount: dataset.skippedRecordCount,
    missingBookmakerBaselineCount: bookmaker.missingCount,
    baselines,
    warnings,
    nonBlockingGates: {
      sampleCountAtLeast100: evaluationFixtures.length >= 100,
      bookmakerBaselineAvailable: bookmaker.baseline !== null
    },
    ownerDecisions: {
      harnessBlocksOnAdditionalCompetitions: false,
      nationalTeamExpansionRequiredBeforeCandidateBakeOff: true,
      metricsImplementation: 'pure_typescript_no_external_metrics_library'
    }
  };
}
```

- [ ] **Step 4: Run the report tests**

Run:

```bash
pnpm --filter local-ai exec vitest run src/evaluation/evaluation-report.test.ts
```

Expected: PASS.

---

### Task 5: Add Phase 8.3 Verification Script and Generated Report

**Files:**
- Create: `scripts/phase8-evaluation-harness-verify.ts`
- Modify: `package.json`
- Create: `apps/local-ai/reports/phase-8-3-evaluation-harness-baselines.json`
- Create: `docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md`
- Modify: `PROJECT_PLAN.md`

- [ ] **Step 1: Write the failing script smoke test by running the missing script**

Run:

```bash
pnpm exec tsx scripts/phase8-evaluation-harness-verify.ts
```

Expected: FAIL because the script does not exist.

- [ ] **Step 2: Implement the script**

Create `scripts/phase8-evaluation-harness-verify.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { buildEvaluationReport } from '../apps/local-ai/src/evaluation/evaluation-report.js';
import { loadEvaluationDataset } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';

const rootDir = process.cwd();
const processedDir = path.join(rootDir, 'apps/local-ai/data/processed/comp-int-world-cup');
const reportDir = path.join(rootDir, 'apps/local-ai/reports');
const reportPath = path.join(reportDir, 'phase-8-3-evaluation-harness-baselines.json');
const docsPath = path.join(rootDir, 'docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md');

const dataset = loadEvaluationDataset(processedDir);
const report = buildEvaluationReport(dataset);

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

const markdown = `# Phase 8.3 Evaluation Harness and Baselines Report

## Status
- **Status**: ${report.status === 'pass' ? 'Completed' : 'Failed'}
- **Date**: 2026-06-28
- **Scope**: Owner-only World Cup/national-team-first evaluation harness and baseline report.

## Direct Conclusion
Phase 8.3 can generate baseline metrics, but the current World Cup-only snapshot is too small for model-readiness or calibration confidence.

## Evidence
- Dataset: \`${report.datasetId}\`
- Competition: \`${report.competitionId}\`
- Feature spec version: \`${report.featureSpecVersion}\`
- Evaluation split: \`${report.evaluationSplit}\`
- Test sample count: ${report.sampleCount}
- Missing bookmaker baseline count: ${report.missingBookmakerBaselineCount}
- Metrics implementation: pure TypeScript in \`apps/local-ai\`

## Baselines
${report.baselines
  .map(
    (baseline) =>
      `- \`${baseline.id}\`: Brier=${baseline.metrics.brierScore.toFixed(6)}, LogLoss=${baseline.metrics.logLoss.toFixed(6)}, Accuracy=${baseline.metrics.classAccuracy.toFixed(6)}, ECE=${baseline.metrics.expectedCalibrationError.ece.toFixed(6)}, N=${baseline.evaluatedSampleCount}`
  )
  .join('\n')}

## Warnings
${report.warnings.map((warning) => `- ${warning}`).join('\n')}

## Explicit Non-Authorizations
- No model training.
- No candidate model selection.
- No runtime prediction route.
- No betting recommendation, stake sizing, Kelly, bankroll, ROI, or CLV logic.
- No club competition expansion.

## Recommendation
Do not start Phase 8.4 candidate model bake-off until related national-team competitions are added or the owner accepts that Phase 8.4 will run as a high-variance experiment only.
`;

fs.writeFileSync(docsPath, markdown, 'utf8');

if (report.status !== 'pass') {
  console.error(`[Phase 8.3 Evaluation Harness] FAILED. Report: ${reportPath}`);
  process.exit(1);
}

console.log(`[Phase 8.3 Evaluation Harness] PASSED. Report: ${reportPath}`);
console.log(`[Phase 8.3 Evaluation Harness] Test samples: ${report.sampleCount}`);
console.log(`[Phase 8.3 Evaluation Harness] Warnings: ${report.warnings.length}`);
```

- [ ] **Step 3: Add the package script**

Modify root `package.json` scripts:

```json
"phase8:evaluation-harness": "tsx scripts/phase8-evaluation-harness-verify.ts"
```

- [ ] **Step 4: Run the Phase 8.3 script**

Run:

```bash
pnpm run phase8:evaluation-harness
```

Expected: PASS and creates:

- `apps/local-ai/reports/phase-8-3-evaluation-harness-baselines.json`
- `docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md`

- [ ] **Step 5: Update project plan status**

Modify `PROJECT_PLAN.md` so Phase 8.3 planning and implementation are separate:

```markdown
- [x] Create `phase:implementation-plan Phase 8.3 Evaluation Harness and Baselines`.
- [ ] Complete Phase 8.3 Evaluation Harness and Baselines, using pure TypeScript metric functions in `apps/local-ai` for Brier, Calibration/ECE, and log loss, reporting sample count and bookmaker/simple baseline comparison without blocking harness construction on additional national-team competitions.
```

- [ ] **Step 6: Run package and repo verification**

Run:

```bash
pnpm --filter local-ai test
pnpm run phase8:evaluation-harness
pnpm run verify:local
```

Expected: all commands pass. `phase8:evaluation-harness` may print warnings about low sample count; that warning is required and must not fail the command.

---

### Task 6: Phase 8.3 Integration Gate

**Files:**
- Verify only. No source file changes unless a verification command exposes a real defect.

- [ ] **Step 1: Run the integration gate after Task 5 passes**

Run:

```bash
pnpm run test:integration
```

Expected: PASS.

- [ ] **Step 2: Record closeout evidence**

Update `docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md` with the exact verification commands and results:

```markdown
## Verification
- `pnpm --filter local-ai test`: PASS
- `pnpm run phase8:evaluation-harness`: PASS
- `pnpm run verify:local`: PASS
- `pnpm run test:integration`: PASS
```

- [ ] **Step 3: Keep Phase 8.4 blocked unless owner accepts the data risk**

Leave `PROJECT_PLAN.md` Phase 8.4 unchecked. Phase 8.4 requires either related national-team competition expansion or explicit owner acceptance that candidate model comparison is a high-variance experiment.

## Self-Review Checklist

- Spec coverage: covered metric functions, JSONL loading, simple baselines, bookmaker availability, sample counts, ECE bins, log loss, class accuracy, report warnings, and non-blocking gates.
- Placeholder scan: no banned placeholder markers or vague "add tests" instructions.
- Type consistency: `OutcomeClass`, `OutcomeProbabilities`, `EvaluationFixture`, `EvaluationDataset`, and `EvaluationReport` names are consistent across tasks.
- Guardrails: no training, no runtime prediction, no betting logic, no club competition expansion, no external metrics library.
