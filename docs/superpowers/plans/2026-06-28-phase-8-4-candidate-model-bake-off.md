# Phase 8.4 Candidate Model Bake-Off Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an owner-only offline candidate model bake-off that compares simple national-team candidates against the existing Phase 8.3 baselines on the same chronological aggregate dataset, without selecting or deploying a real model.

**Architecture:** Phase 8.4 stays inside `apps/local-ai` and `scripts`, uses the Phase 8.3A national-team aggregate dataset, and writes JSON/Markdown evidence only. Candidate predictions are generated offline by small deterministic TypeScript modules, then scored by the existing pure TypeScript metrics. The report may rank candidates for inspection, but model selection remains blocked until Phase 8.6 Model Selection ADR.

**Tech Stack:** TypeScript, Vitest, existing JSONL processed datasets, existing evaluation metrics, `tsx` phase script. No Python ML package, LightGBM, CatBoost, XGBoost, ONNX, PyTorch, TensorFlow, paid provider, secret, production endpoint, or betting dependency is authorized in this plan.

---

## Scope Boundary

### Allowed

- Add owner-only candidate model modules under `apps/local-ai/src/candidates`.
- Extend evaluation fixtures with pre-existing match identifiers needed for offline research: `homeTeamId` and `awayTeamId`.
- Train small offline candidates from train and validation splits only.
- Score candidates on the test split with Brier score, log loss, class accuracy, and ECE.
- Compare candidates against Phase 8.3 baselines in a generated report.
- Record high-variance warnings and missing bookmaker-baseline warnings.
- Add `pnpm run phase8:candidate-bakeoff`.

### Blocked

- No `/ai/v1/predict` real inference.
- No runtime prediction route, public prediction surface, or production engine mode.
- No model artifact promotion, `.onnx`, `.pkl`, `.bin`, `.joblib`, `.gguf`, or model weights.
- No model-selection ADR in Phase 8.4.
- No betting recommendation, stake sizing, Kelly, bankroll, ROI, CLV, or "best bet" label.
- No club competitions, including Premier League.
- No fake Copa America source.
- No external ML libraries in this phase.

## Gate Inputs

Phase 8.4 may start only because the current reports say:

- `docs/data/PHASE-8-3A-NATIONAL-TEAM-DATASET-EXPANSION-REPORT.md`: `Phase 8.4 data ready: yes`.
- `docs/data/PHASE-8-3-EVALUATION-HARNESS-BASELINES-REPORT.md`: aggregate national-team dataset with `comp-int-world-cup` and `comp-int-euro`.
- Current scored test sample count is 107, which is still weak. The report must say this is high-variance R&D evidence, not selection evidence.

## File Map

- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.ts` - carry `homeTeamId` and `awayTeamId` into evaluation fixtures.
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.test.ts` - prove team IDs load without score leakage.
- Create: `apps/local-ai/src/candidates/candidate-types.ts` - shared candidate prediction/result contracts.
- Create: `apps/local-ai/src/candidates/candidate-evaluator.ts` - score candidate predictions with existing metrics.
- Create: `apps/local-ai/src/candidates/candidate-evaluator.test.ts` - metric/evaluation tests.
- Create: `apps/local-ai/src/candidates/elo-rating-candidate.ts` - transparent Elo-style candidate trained from train and validation splits.
- Create: `apps/local-ai/src/candidates/elo-rating-candidate.test.ts` - Elo behavior tests.
- Create: `apps/local-ai/src/candidates/multinomial-logistic-candidate.ts` - pure TypeScript multinomial logistic regression candidate.
- Create: `apps/local-ai/src/candidates/multinomial-logistic-candidate.test.ts` - deterministic trainer tests.
- Create: `apps/local-ai/src/candidates/candidate-bakeoff-report.ts` - report builder and Markdown generator.
- Create: `apps/local-ai/src/candidates/candidate-bakeoff-report.test.ts` - report guardrail tests.
- Create: `scripts/phase8-candidate-bakeoff-verify.ts` - generated report script.
- Create: `scripts/phase8-candidate-bakeoff-verify.test.ts` - preflight/report script tests.
- Modify: `package.json` - add `phase8:candidate-bakeoff`.
- Create: `apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json` - generated JSON report.
- Create: `docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md` - generated owner-readable report.
- Modify: `PROJECT_PLAN.md` - mark Phase 8.4 implementation plan as created only after this plan exists.

---

### Task 1: Preserve Team IDs In Evaluation Fixtures

**Files:**
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.ts`
- Modify: `apps/local-ai/src/evaluation/evaluation-dataset.test.ts`

- [ ] **Step 1: Write the failing fixture identity test**

Append this test inside `describe('Phase 8.3 evaluation dataset loader', ...)` in `apps/local-ai/src/evaluation/evaluation-dataset.test.ts`:

```typescript
it('loads team identifiers for offline candidate research without exposing scores as features', () => {
  const dataset = loadEvaluationDataset(
    path.resolve(__dirname, '../../data/processed/comp-int-world-cup')
  );

  expect(dataset.train[0]).toHaveProperty('homeTeamId');
  expect(dataset.train[0]).toHaveProperty('awayTeamId');
  expect(dataset.train[0]).not.toHaveProperty('scores');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/evaluation/evaluation-dataset.test.ts
```

Expected: FAIL because `EvaluationFixture` does not expose `homeTeamId` or `awayTeamId`.

- [ ] **Step 3: Add team IDs to evaluation fixtures**

Modify `apps/local-ai/src/evaluation/evaluation-dataset.ts`:

```typescript
export type EvaluationFixture = {
  matchId: string;
  split: EvaluationSplitName;
  competitionId: string;
  kickoffTime: string;
  homeTeamId: string;
  awayTeamId: string;
  actualOutcome: OutcomeClass;
  marketProbabilities?: OutcomeProbabilities;
};
```

Modify the fixture creation in `toEvaluationFixtures`:

```typescript
const fixture: EvaluationFixture = {
  matchId: record.id,
  split,
  competitionId: record.competitionId,
  kickoffTime: record.kickoffTime,
  homeTeamId: record.homeTeamId,
  awayTeamId: record.awayTeamId,
  actualOutcome: actualOutcomeFromScores(record.scores)
};
```

- [ ] **Step 4: Run the fixture tests**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/evaluation/evaluation-dataset.test.ts
```

Expected: PASS.

---

### Task 2: Add Candidate Evaluation Contracts

**Files:**
- Create: `apps/local-ai/src/candidates/candidate-types.ts`
- Create: `apps/local-ai/src/candidates/candidate-evaluator.ts`
- Create: `apps/local-ai/src/candidates/candidate-evaluator.test.ts`

- [ ] **Step 1: Write the failing candidate evaluator test**

Create `apps/local-ai/src/candidates/candidate-evaluator.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { evaluateCandidateBatch } from './candidate-evaluator.js';
import type { CandidatePredictionBatch } from './candidate-types.js';

describe('Phase 8.4 candidate evaluator', () => {
  it('scores candidate predictions with the existing Phase 8 metrics', () => {
    const batch: CandidatePredictionBatch = {
      candidateId: 'candidate-test',
      candidateFamily: 'elo_rating',
      trainedOnSplitNames: ['train'],
      evaluatedOnSplitName: 'test',
      predictions: [
        {
          matchId: 'match-1',
          actualOutcome: 'home',
          probabilities: { home: 0.7, draw: 0.2, away: 0.1 }
        },
        {
          matchId: 'match-2',
          actualOutcome: 'away',
          probabilities: { home: 0.2, draw: 0.2, away: 0.6 }
        }
      ]
    };

    const result = evaluateCandidateBatch(batch, { eceBinCount: 5 });

    expect(result.candidateId).toBe('candidate-test');
    expect(result.evaluatedSampleCount).toBe(2);
    expect(result.metrics.logLoss).toBeCloseTo((-Math.log(0.7) - Math.log(0.6)) / 2, 10);
    expect(result.metrics.classAccuracy).toBe(1);
    expect(result.metrics.expectedCalibrationError.sampleCount).toBe(2);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/candidate-evaluator.test.ts
```

Expected: FAIL because `candidate-evaluator.ts` and `candidate-types.ts` do not exist.

- [ ] **Step 3: Create candidate shared types**

Create `apps/local-ai/src/candidates/candidate-types.ts`:

```typescript
import type { EvaluationSplitName } from '../evaluation/evaluation-dataset.js';
import type {
  ExpectedCalibrationErrorResult,
  OutcomeClass,
  OutcomeProbabilities
} from '../evaluation/evaluation-metrics.js';

export type CandidateFamily =
  | 'elo_rating'
  | 'multinomial_logistic_regression';

export type CandidatePrediction = {
  matchId: string;
  actualOutcome: OutcomeClass;
  probabilities: OutcomeProbabilities;
};

export type CandidatePredictionBatch = {
  candidateId: string;
  candidateFamily: CandidateFamily;
  trainedOnSplitNames: EvaluationSplitName[];
  evaluatedOnSplitName: EvaluationSplitName;
  predictions: CandidatePrediction[];
};

export type CandidateEvaluationResult = {
  candidateId: string;
  candidateFamily: CandidateFamily;
  trainedOnSplitNames: EvaluationSplitName[];
  evaluatedOnSplitName: EvaluationSplitName;
  evaluatedSampleCount: number;
  metrics: {
    brierScore: number;
    logLoss: number;
    classAccuracy: number;
    expectedCalibrationError: ExpectedCalibrationErrorResult;
  };
};
```

- [ ] **Step 4: Implement candidate evaluator**

Create `apps/local-ai/src/candidates/candidate-evaluator.ts`:

```typescript
import {
  brierScore,
  classAccuracy,
  expectedCalibrationError,
  logLoss,
  type EvaluationSample
} from '../evaluation/evaluation-metrics.js';
import type { CandidateEvaluationResult, CandidatePredictionBatch } from './candidate-types.js';

export type CandidateEvaluatorOptions = {
  eceBinCount?: number;
};

export function evaluateCandidateBatch(
  batch: CandidatePredictionBatch,
  options: CandidateEvaluatorOptions = {}
): CandidateEvaluationResult {
  if (batch.predictions.length === 0) {
    throw new Error(`Candidate ${batch.candidateId} produced no test predictions.`);
  }

  const samples: EvaluationSample[] = batch.predictions.map((prediction) => ({
    actualOutcome: prediction.actualOutcome,
    probabilities: prediction.probabilities
  }));

  return {
    candidateId: batch.candidateId,
    candidateFamily: batch.candidateFamily,
    trainedOnSplitNames: batch.trainedOnSplitNames,
    evaluatedOnSplitName: batch.evaluatedOnSplitName,
    evaluatedSampleCount: samples.length,
    metrics: {
      brierScore: brierScore(samples),
      logLoss: logLoss(samples),
      classAccuracy: classAccuracy(samples),
      expectedCalibrationError: expectedCalibrationError(samples, options.eceBinCount ?? 10)
    }
  };
}
```

- [ ] **Step 5: Run candidate evaluator tests**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/candidate-evaluator.test.ts
```

Expected: PASS.

---

### Task 3: Implement Elo Rating Candidate

**Files:**
- Create: `apps/local-ai/src/candidates/elo-rating-candidate.ts`
- Create: `apps/local-ai/src/candidates/elo-rating-candidate.test.ts`

- [ ] **Step 1: Write the failing Elo candidate test**

Create `apps/local-ai/src/candidates/elo-rating-candidate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import type { EvaluationFixture } from '../evaluation/evaluation-dataset.js';
import { predictWithEloRatingCandidate } from './elo-rating-candidate.js';

function fixture(id: string, home: string, away: string, actualOutcome: 'home' | 'draw' | 'away'): EvaluationFixture {
  return {
    matchId: id,
    split: 'train',
    competitionId: 'comp-test',
    kickoffTime: '2020-01-01T00:00:00Z',
    homeTeamId: home,
    awayTeamId: away,
    actualOutcome
  };
}

describe('Phase 8.4 Elo rating candidate', () => {
  it('learns team strength from train and validation fixtures only', () => {
    const train = [
      fixture('train-1', 'team-a', 'team-b', 'home'),
      fixture('train-2', 'team-a', 'team-c', 'home'),
      fixture('train-3', 'team-b', 'team-a', 'away')
    ];
    const validation = [fixture('val-1', 'team-a', 'team-b', 'home')];
    const test = [fixture('test-1', 'team-a', 'team-b', 'home')];

    const batch = predictWithEloRatingCandidate({ train, validation, test });

    expect(batch.candidateId).toBe('elo_rating_v0');
    expect(batch.trainedOnSplitNames).toEqual(['train', 'validation']);
    expect(batch.predictions).toHaveLength(1);
    expect(batch.predictions[0].probabilities.home).toBeGreaterThan(batch.predictions[0].probabilities.away);
    expect(batch.predictions[0].probabilities.draw).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/elo-rating-candidate.test.ts
```

Expected: FAIL because `elo-rating-candidate.ts` does not exist.

- [ ] **Step 3: Implement Elo candidate**

Create `apps/local-ai/src/candidates/elo-rating-candidate.ts`:

```typescript
import type { EvaluationDataset, EvaluationFixture } from '../evaluation/evaluation-dataset.js';
import type { OutcomeProbabilities } from '../evaluation/evaluation-metrics.js';
import type { CandidatePredictionBatch } from './candidate-types.js';

const INITIAL_RATING = 1500;
const K_FACTOR = 24;
const MIN_DRAW_PROBABILITY = 0.18;
const MAX_DRAW_PROBABILITY = 0.36;

type EloCandidateInput = Pick<EvaluationDataset, 'train' | 'validation' | 'test'>;

function outcomeScoreForHome(fixture: EvaluationFixture): number {
  if (fixture.actualOutcome === 'home') return 1;
  if (fixture.actualOutcome === 'draw') return 0.5;
  return 0;
}

function expectedHomeScore(homeRating: number, awayRating: number): number {
  return 1 / (1 + Math.pow(10, (awayRating - homeRating) / 400));
}

function ratingFor(ratings: Map<string, number>, teamId: string): number {
  return ratings.get(teamId) ?? INITIAL_RATING;
}

function updateRatings(ratings: Map<string, number>, fixture: EvaluationFixture): void {
  const homeRating = ratingFor(ratings, fixture.homeTeamId);
  const awayRating = ratingFor(ratings, fixture.awayTeamId);
  const expectedHome = expectedHomeScore(homeRating, awayRating);
  const actualHome = outcomeScoreForHome(fixture);
  const delta = K_FACTOR * (actualHome - expectedHome);

  ratings.set(fixture.homeTeamId, homeRating + delta);
  ratings.set(fixture.awayTeamId, awayRating - delta);
}

function drawProbability(trainingFixtures: readonly EvaluationFixture[]): number {
  if (trainingFixtures.length === 0) return 0.25;
  const drawRate = trainingFixtures.filter((fixture) => fixture.actualOutcome === 'draw').length / trainingFixtures.length;
  return Math.min(MAX_DRAW_PROBABILITY, Math.max(MIN_DRAW_PROBABILITY, drawRate));
}

function probabilitiesForFixture(
  ratings: Map<string, number>,
  fixture: EvaluationFixture,
  draw: number
): OutcomeProbabilities {
  const homeNoDraw = expectedHomeScore(
    ratingFor(ratings, fixture.homeTeamId),
    ratingFor(ratings, fixture.awayTeamId)
  );
  const nonDraw = 1 - draw;

  return {
    home: nonDraw * homeNoDraw,
    draw,
    away: nonDraw * (1 - homeNoDraw)
  };
}

export function predictWithEloRatingCandidate(input: EloCandidateInput): CandidatePredictionBatch {
  const trainingFixtures = [...input.train, ...input.validation].sort((a, b) =>
    a.kickoffTime.localeCompare(b.kickoffTime)
  );
  const ratings = new Map<string, number>();
  const draw = drawProbability(trainingFixtures);

  for (const fixture of trainingFixtures) {
    updateRatings(ratings, fixture);
  }

  return {
    candidateId: 'elo_rating_v0',
    candidateFamily: 'elo_rating',
    trainedOnSplitNames: ['train', 'validation'],
    evaluatedOnSplitName: 'test',
    predictions: input.test.map((fixture) => ({
      matchId: fixture.matchId,
      actualOutcome: fixture.actualOutcome,
      probabilities: probabilitiesForFixture(ratings, fixture, draw)
    }))
  };
}
```

- [ ] **Step 4: Run Elo candidate tests**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/elo-rating-candidate.test.ts
```

Expected: PASS.

---

### Task 4: Implement Pure TypeScript Multinomial Logistic Candidate

**Files:**
- Create: `apps/local-ai/src/candidates/multinomial-logistic-candidate.ts`
- Create: `apps/local-ai/src/candidates/multinomial-logistic-candidate.test.ts`

- [ ] **Step 1: Write the failing logistic candidate test**

Create `apps/local-ai/src/candidates/multinomial-logistic-candidate.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { trainMultinomialLogisticRegression } from './multinomial-logistic-candidate.js';

describe('Phase 8.4 multinomial logistic candidate', () => {
  it('learns a deterministic three-class probability model on separable numeric rows', () => {
    const model = trainMultinomialLogisticRegression(
      [
        { features: [1, 1, 0], actualOutcome: 'home' },
        { features: [1, 1, 0], actualOutcome: 'home' },
        { features: [1, 0, 1], actualOutcome: 'away' },
        { features: [1, 0, 1], actualOutcome: 'away' },
        { features: [1, 0, 0], actualOutcome: 'draw' },
        { features: [1, 0, 0], actualOutcome: 'draw' }
      ],
      { iterations: 300, learningRate: 0.2, l2Penalty: 0.001 }
    );

    const homeProbabilities = model.predict([1, 1, 0]);
    const awayProbabilities = model.predict([1, 0, 1]);
    const drawProbabilities = model.predict([1, 0, 0]);

    expect(homeProbabilities.home).toBeGreaterThan(homeProbabilities.away);
    expect(awayProbabilities.away).toBeGreaterThan(awayProbabilities.home);
    expect(drawProbabilities.draw).toBeGreaterThan(0.34);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/multinomial-logistic-candidate.test.ts
```

Expected: FAIL because `multinomial-logistic-candidate.ts` does not exist.

- [ ] **Step 3: Implement the deterministic trainer**

Create `apps/local-ai/src/candidates/multinomial-logistic-candidate.ts`:

```typescript
import type { EvaluationDataset, EvaluationFixture } from '../evaluation/evaluation-dataset.js';
import type { OutcomeClass, OutcomeProbabilities } from '../evaluation/evaluation-metrics.js';
import type { CandidatePredictionBatch } from './candidate-types.js';

const OUTCOMES: readonly OutcomeClass[] = ['home', 'draw', 'away'];

export type LogisticTrainingRow = {
  features: number[];
  actualOutcome: OutcomeClass;
};

export type LogisticTrainingOptions = {
  iterations: number;
  learningRate: number;
  l2Penalty: number;
};

export type MultinomialLogisticModel = {
  predict(features: readonly number[]): OutcomeProbabilities;
};

function softmax(scores: readonly number[]): number[] {
  const maxScore = Math.max(...scores);
  const exps = scores.map((score) => Math.exp(score - maxScore));
  const total = exps.reduce((sum, value) => sum + value, 0);
  return exps.map((value) => value / total);
}

function outcomeIndex(outcome: OutcomeClass): number {
  return OUTCOMES.indexOf(outcome);
}

export function trainMultinomialLogisticRegression(
  rows: readonly LogisticTrainingRow[],
  options: LogisticTrainingOptions
): MultinomialLogisticModel {
  if (rows.length === 0) {
    throw new Error('Logistic regression candidate requires at least one training row.');
  }

  const featureCount = rows[0].features.length;
  const weights = Array.from({ length: OUTCOMES.length }, () => Array(featureCount).fill(0));

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const gradients = Array.from({ length: OUTCOMES.length }, () => Array(featureCount).fill(0));

    for (const row of rows) {
      const probabilities = softmax(weights.map((classWeights) =>
        classWeights.reduce((sum, weight, index) => sum + weight * row.features[index], 0)
      ));
      const actual = outcomeIndex(row.actualOutcome);

      for (let classIndex = 0; classIndex < OUTCOMES.length; classIndex += 1) {
        const error = probabilities[classIndex] - (classIndex === actual ? 1 : 0);
        for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
          gradients[classIndex][featureIndex] += error * row.features[featureIndex];
        }
      }
    }

    for (let classIndex = 0; classIndex < OUTCOMES.length; classIndex += 1) {
      for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
        const penalty = options.l2Penalty * weights[classIndex][featureIndex];
        weights[classIndex][featureIndex] -= options.learningRate * ((gradients[classIndex][featureIndex] / rows.length) + penalty);
      }
    }
  }

  return {
    predict(features: readonly number[]): OutcomeProbabilities {
      const probabilities = softmax(weights.map((classWeights) =>
        classWeights.reduce((sum, weight, index) => sum + weight * features[index], 0)
      ));
      return {
        home: probabilities[0],
        draw: probabilities[1],
        away: probabilities[2]
      };
    }
  };
}

function competitionIds(fixtures: readonly EvaluationFixture[]): string[] {
  return [...new Set(fixtures.map((fixture) => fixture.competitionId))].sort();
}

function featuresForFixture(fixture: EvaluationFixture, ids: readonly string[]): number[] {
  return [1, ...ids.map((competitionId) => fixture.competitionId === competitionId ? 1 : 0)];
}

export function predictWithMultinomialLogisticCandidate(dataset: EvaluationDataset): CandidatePredictionBatch {
  const ids = competitionIds(dataset.train);
  const rows = dataset.train.map((fixture) => ({
    features: featuresForFixture(fixture, ids),
    actualOutcome: fixture.actualOutcome
  }));
  const model = trainMultinomialLogisticRegression(rows, {
    iterations: 250,
    learningRate: 0.15,
    l2Penalty: 0.001
  });

  return {
    candidateId: 'multinomial_logistic_competition_v0',
    candidateFamily: 'multinomial_logistic_regression',
    trainedOnSplitNames: ['train'],
    evaluatedOnSplitName: 'test',
    predictions: dataset.test.map((fixture) => ({
      matchId: fixture.matchId,
      actualOutcome: fixture.actualOutcome,
      probabilities: model.predict(featuresForFixture(fixture, ids))
    }))
  };
}
```

- [ ] **Step 4: Run logistic candidate tests**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/multinomial-logistic-candidate.test.ts
```

Expected: PASS.

---

### Task 5: Build Candidate Bake-Off Report

**Files:**
- Create: `apps/local-ai/src/candidates/candidate-bakeoff-report.ts`
- Create: `apps/local-ai/src/candidates/candidate-bakeoff-report.test.ts`

- [ ] **Step 1: Write the failing report guardrail test**

Create `apps/local-ai/src/candidates/candidate-bakeoff-report.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { buildCandidateBakeoffReport, generateCandidateBakeoffMarkdown } from './candidate-bakeoff-report.js';
import type { CandidateEvaluationResult } from './candidate-types.js';

function candidate(candidateId: string, logLoss: number): CandidateEvaluationResult {
  return {
    candidateId,
    candidateFamily: 'elo_rating',
    trainedOnSplitNames: ['train'],
    evaluatedOnSplitName: 'test',
    evaluatedSampleCount: 107,
    metrics: {
      brierScore: 0.65,
      logLoss,
      classAccuracy: 0.44,
      expectedCalibrationError: { ece: 0.1, sampleCount: 107, binCount: 10, bins: [] }
    }
  };
}

describe('Phase 8.4 candidate bake-off report', () => {
  it('ranks candidates but blocks model selection authority', () => {
    const report = buildCandidateBakeoffReport({
      datasetId: 'dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro',
      competitionIds: ['comp-int-world-cup', 'comp-int-euro'],
      featureSpecVersion: 'feature-spec-v0.1.0',
      sampleCount: 107,
      baselineLogLoss: 1.066,
      baselineBrierScore: 0.644,
      bookmakerBaselineAvailable: false,
      candidateResults: [
        candidate('candidate-worse', 1.2),
        candidate('candidate-better', 1.0)
      ]
    });

    expect(report.status).toBe('pass');
    expect(report.rankedCandidateIds).toEqual(['candidate-better', 'candidate-worse']);
    expect(report.selectedCandidateId).toBeNull();
    expect(report.selectionAuthority).toBe('blocked_until_phase_8_6_model_selection_adr');
    expect(report.warnings).toContain('Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.');
    expect(report.warnings).toContain('Test sample count is 107; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.');
  });

  it('generates Markdown with explicit non-authorizations', () => {
    const report = buildCandidateBakeoffReport({
      datasetId: 'dataset-national-team-aggregate-comp-int-world-cup__comp-int-euro',
      competitionIds: ['comp-int-world-cup', 'comp-int-euro'],
      featureSpecVersion: 'feature-spec-v0.1.0',
      sampleCount: 107,
      baselineLogLoss: 1.066,
      baselineBrierScore: 0.644,
      bookmakerBaselineAvailable: false,
      candidateResults: [candidate('candidate-a', 1.0)]
    });

    const markdown = generateCandidateBakeoffMarkdown(report);

    expect(markdown).toContain('No model is selected in Phase 8.4.');
    expect(markdown).toContain('No runtime prediction route.');
    expect(markdown).toContain('No betting recommendation.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/candidate-bakeoff-report.test.ts
```

Expected: FAIL because `candidate-bakeoff-report.ts` does not exist.

- [ ] **Step 3: Implement report builder**

Create `apps/local-ai/src/candidates/candidate-bakeoff-report.ts`:

```typescript
import type { CandidateEvaluationResult } from './candidate-types.js';

export type CandidateBakeoffReportInput = {
  datasetId: string;
  competitionIds: string[];
  featureSpecVersion: string;
  sampleCount: number;
  baselineLogLoss: number;
  baselineBrierScore: number;
  bookmakerBaselineAvailable: boolean;
  candidateResults: CandidateEvaluationResult[];
};

export type CandidateBakeoffReport = {
  reportId: 'phase-8-4-candidate-model-bakeoff';
  phase: '8.4';
  status: 'pass' | 'fail';
  datasetId: string;
  competitionIds: string[];
  featureSpecVersion: string;
  sampleCount: number;
  baselineLogLoss: number;
  baselineBrierScore: number;
  bookmakerBaselineAvailable: boolean;
  candidateResults: CandidateEvaluationResult[];
  rankedCandidateIds: string[];
  selectedCandidateId: null;
  selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr';
  warnings: string[];
  forbiddenScope: readonly string[];
};

export function buildCandidateBakeoffReport(input: CandidateBakeoffReportInput): CandidateBakeoffReport {
  const ranked = [...input.candidateResults].sort((a, b) => a.metrics.logLoss - b.metrics.logLoss);
  const warnings: string[] = [];

  if (input.sampleCount < 200) {
    warnings.push(`Test sample count is ${input.sampleCount}; treat Phase 8.4 as high-variance R&D evidence, not model-selection evidence.`);
  }

  if (!input.bookmakerBaselineAvailable) {
    warnings.push('Bookmaker baseline is unavailable for the current dataset; candidate results cannot be judged against market-implied probabilities.');
  }

  if (input.candidateResults.length === 0) {
    warnings.push('No candidate results were generated.');
  }

  return {
    reportId: 'phase-8-4-candidate-model-bakeoff',
    phase: '8.4',
    status: input.candidateResults.length > 0 ? 'pass' : 'fail',
    datasetId: input.datasetId,
    competitionIds: input.competitionIds,
    featureSpecVersion: input.featureSpecVersion,
    sampleCount: input.sampleCount,
    baselineLogLoss: input.baselineLogLoss,
    baselineBrierScore: input.baselineBrierScore,
    bookmakerBaselineAvailable: input.bookmakerBaselineAvailable,
    candidateResults: input.candidateResults,
    rankedCandidateIds: ranked.map((candidate) => candidate.candidateId),
    selectedCandidateId: null,
    selectionAuthority: 'blocked_until_phase_8_6_model_selection_adr',
    warnings,
    forbiddenScope: [
      'model_selection',
      'runtime_prediction',
      'betting_recommendation',
      'stake_sizing',
      'club_competition_expansion'
    ]
  };
}

export function generateCandidateBakeoffMarkdown(report: CandidateBakeoffReport): string {
  return `# Phase 8.4 Candidate Model Bake-Off Report

## Status
- **Status**: ${report.status}
- **Date**: 2026-06-28
- **Scope**: Owner-only offline candidate model comparison.

## Direct Conclusion
No model is selected in Phase 8.4. Candidate ranking is evidence for Phase 8.6 review only.

## Evidence
- Dataset: \`${report.datasetId}\`
- Competitions: ${report.competitionIds.map((id) => `\`${id}\``).join(', ')}
- Feature spec version: \`${report.featureSpecVersion}\`
- Test sample count: ${report.sampleCount}
- Best baseline log loss: ${report.baselineLogLoss.toFixed(6)}
- Best baseline Brier score: ${report.baselineBrierScore.toFixed(6)}
- Bookmaker baseline available: ${report.bookmakerBaselineAvailable ? 'yes' : 'no'}

## Candidates
${report.candidateResults
  .map((candidate) => `- \`${candidate.candidateId}\`: LogLoss=${candidate.metrics.logLoss.toFixed(6)}, Brier=${candidate.metrics.brierScore.toFixed(6)}, Accuracy=${candidate.metrics.classAccuracy.toFixed(6)}, ECE=${candidate.metrics.expectedCalibrationError.ece.toFixed(6)}, N=${candidate.evaluatedSampleCount}`)
  .join('\n')}

## Ranking
${report.rankedCandidateIds.map((candidateId, index) => `- ${index + 1}. \`${candidateId}\``).join('\n')}

## Warnings
${report.warnings.map((warning) => `- ${warning}`).join('\n')}

## Explicit Non-Authorizations
- No model selection.
- No runtime prediction route.
- No betting recommendation.
- No stake sizing, Kelly, bankroll, ROI, or CLV logic.
- No club competition expansion.

## Next Phase
Run \`phase:implementation-plan Phase 8.5 Owner-Only Experimental Report Surface\` before any Phase 8.6 Model Selection ADR. If no candidate meaningfully beats baselines, the later ADR outcome can be no model selected.
`;
}
```

- [ ] **Step 4: Run report tests**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates/candidate-bakeoff-report.test.ts
```

Expected: PASS.

---

### Task 6: Generate Phase 8.4 Bake-Off Report

**Files:**
- Create: `scripts/phase8-candidate-bakeoff-verify.ts`
- Create: `scripts/phase8-candidate-bakeoff-verify.test.ts`
- Modify: `package.json`
- Create: `apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json`
- Create: `docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md`

- [ ] **Step 1: Write the failing script preflight test**

Create `scripts/phase8-candidate-bakeoff-verify.test.ts`:

```typescript
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';
import { verifyPhase84Preflight } from './phase8-candidate-bakeoff-verify.js';

const roots: string[] = [];

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'phase84-'));
  roots.push(root);
  fs.mkdirSync(path.join(root, 'apps/local-ai/reports'), { recursive: true });
  return root;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe('Phase 8.4 candidate bake-off verifier preflight', () => {
  it('blocks when Phase 8.3A data readiness is not true', () => {
    const root = makeRoot();
    fs.writeFileSync(
      path.join(root, 'apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json'),
      JSON.stringify({ phase84DataReady: false }, null, 2),
      'utf8'
    );

    expect(() => verifyPhase84Preflight(root)).toThrow('Phase 8.4 requires phase84DataReady=true from Phase 8.3A.');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:

```bash
pnpm exec vitest run scripts/phase8-candidate-bakeoff-verify.test.ts
```

Expected: FAIL because `phase8-candidate-bakeoff-verify.ts` does not exist.

- [ ] **Step 3: Implement the phase script**

Create `scripts/phase8-candidate-bakeoff-verify.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { buildCandidateBakeoffReport, generateCandidateBakeoffMarkdown } from '../apps/local-ai/src/candidates/candidate-bakeoff-report.js';
import { evaluateCandidateBatch } from '../apps/local-ai/src/candidates/candidate-evaluator.js';
import { predictWithEloRatingCandidate } from '../apps/local-ai/src/candidates/elo-rating-candidate.js';
import { predictWithMultinomialLogisticCandidate } from '../apps/local-ai/src/candidates/multinomial-logistic-candidate.js';
import { loadEvaluationDatasets } from '../apps/local-ai/src/evaluation/evaluation-dataset.js';
import { buildEvaluationReport } from '../apps/local-ai/src/evaluation/evaluation-report.js';

type Phase83AReport = {
  phase84DataReady: boolean;
};

type RegistryCompetition = {
  competition_id: string;
  competition_type: 'national_team';
  provider_status: 'supported' | 'unsupported';
  enabled: boolean;
};

export function verifyPhase84Preflight(rootDir: string): void {
  const reportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-3a-national-team-dataset-expansion.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error(`Missing Phase 8.3A readiness report: ${reportPath}`);
  }

  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8')) as Phase83AReport;
  if (report.phase84DataReady !== true) {
    throw new Error('Phase 8.4 requires phase84DataReady=true from Phase 8.3A.');
  }
}

function enabledProcessedDirs(rootDir: string): string[] {
  const registryPath = path.join(rootDir, 'apps/local-ai/config/competition-registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { competitions: RegistryCompetition[] };

  return registry.competitions
    .filter((competition) =>
      competition.enabled &&
      competition.competition_type === 'national_team' &&
      competition.provider_status === 'supported'
    )
    .map((competition) => path.join(rootDir, 'apps/local-ai/data/processed', competition.competition_id));
}

export function generatePhase84Report(rootDir: string) {
  verifyPhase84Preflight(rootDir);

  const dataset = loadEvaluationDatasets(enabledProcessedDirs(rootDir));
  const baselineReport = buildEvaluationReport(dataset);
  const baselineLogLoss = Math.min(...baselineReport.baselines.map((baseline) => baseline.metrics.logLoss));
  const baselineBrierScore = Math.min(...baselineReport.baselines.map((baseline) => baseline.metrics.brierScore));
  const candidateResults = [
    evaluateCandidateBatch(predictWithEloRatingCandidate(dataset)),
    evaluateCandidateBatch(predictWithMultinomialLogisticCandidate(dataset))
  ];

  return buildCandidateBakeoffReport({
    datasetId: dataset.metadata.datasetId,
    competitionIds: dataset.competitionIds ?? [dataset.competitionId],
    featureSpecVersion: dataset.metadata.featureSpecVersion,
    sampleCount: dataset.test.length,
    baselineLogLoss,
    baselineBrierScore,
    bookmakerBaselineAvailable: baselineReport.nonBlockingGates.bookmakerBaselineAvailable,
    candidateResults
  });
}

export function main(): void {
  const rootDir = process.cwd();
  const report = generatePhase84Report(rootDir);
  const reportPath = path.join(rootDir, 'apps/local-ai/reports/phase-8-4-candidate-model-bakeoff.json');
  const docsPath = path.join(rootDir, 'docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md');

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(docsPath, generateCandidateBakeoffMarkdown(report), 'utf8');

  if (report.status !== 'pass' || report.selectedCandidateId !== null) {
    console.error(`[Phase 8.4 Candidate Bake-Off] FAILED. Report: ${reportPath}`);
    process.exit(1);
  }

  console.log(`[Phase 8.4 Candidate Bake-Off] PASSED. Report: ${reportPath}`);
  console.log(`[Phase 8.4 Candidate Bake-Off] Candidates: ${report.candidateResults.length}`);
  console.log(`[Phase 8.4 Candidate Bake-Off] Selected candidate: none`);
}

if (process.argv[1]?.endsWith('phase8-candidate-bakeoff-verify.ts')) {
  main();
}
```

- [ ] **Step 4: Add package script**

Modify root `package.json` scripts:

```json
"phase8:candidate-bakeoff": "tsx scripts/phase8-candidate-bakeoff-verify.ts"
```

- [ ] **Step 5: Run script test and phase script**

Run:

```bash
pnpm exec vitest run scripts/phase8-candidate-bakeoff-verify.test.ts
pnpm run phase8:national-team-expansion
pnpm run phase8:evaluation-harness
pnpm run phase8:candidate-bakeoff
```

Expected:

- Script test: PASS.
- National-team expansion: PASS.
- Evaluation harness: PASS.
- Candidate bake-off: PASS, writes JSON and Markdown reports, prints `Selected candidate: none`.

---

### Task 7: Close Phase 8.4 Without Selecting A Model

**Files:**
- Modify: `PROJECT_PLAN.md`
- Modify: `docs/data/PHASE-8-4-CANDIDATE-MODEL-BAKEOFF-REPORT.md`

- [ ] **Step 1: Run targeted verification**

Run:

```bash
pnpm exec vitest run apps/local-ai/src/candidates scripts/phase8-candidate-bakeoff-verify.test.ts
pnpm run phase8:candidate-bakeoff
```

Expected: PASS.

- [ ] **Step 2: Run local verification**

Run:

```bash
pnpm run verify:local
```

Expected: PASS.

- [ ] **Step 3: Run integration only after Phase 8.4 report boundary is complete**

Run:

```bash
pnpm run test:integration
```

Expected: PASS.

- [ ] **Step 4: Update Project Plan after implementation, not during plan creation**

Modify `PROJECT_PLAN.md` only after the report exists and verification passes:

```markdown
- [x] Create `phase:implementation-plan Phase 8.4 Candidate Model Bake-Off`.
- [x] Complete Phase 8.4 Candidate Model Bake-Off before selecting any real model.
  - **Result**: Candidate comparison report generated. No model selected.
  - **Constraints**: Do not treat high-variance Phase 8.4 outcomes as model-selection evidence. Do not create runtime prediction routes, model artifacts, betting recommendations, or club competition support.
```

- [ ] **Step 5: Confirm next phase remains planning only**

The next safe lifecycle command after Phase 8.4 closeout is:

```text
phase:implementation-plan Phase 8.5 Owner-Only Experimental Report Surface
```

Expected: The ADR may choose `no model selected`. It must not be skipped.

## Self-Review Checklist

- Spec coverage: covers candidate contracts, two offline candidates, scoring, report generation, preflight gates, no-selection closeout, and next-phase boundary.
- Placeholder scan: no empty tasks, no missing file paths, no unqualified test commands.
- Type consistency: `CandidatePredictionBatch`, `CandidateEvaluationResult`, `CandidateBakeoffReport`, `EvaluationFixture`, and phase script names match across tasks.
- Guardrails: no runtime prediction, no production engine mode, no betting logic, no club competitions, no external ML libraries, no model artifact promotion, no model selection before Phase 8.6.
