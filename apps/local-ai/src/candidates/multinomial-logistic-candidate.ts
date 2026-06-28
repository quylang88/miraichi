import type {
  EvaluationDataset,
  EvaluationFixture
} from '../evaluation/evaluation-dataset.js';
import type { OutcomeClass, OutcomeProbabilities } from '../evaluation/evaluation-metrics.js';
import type { CandidatePredictionBatch } from './candidate-types.js';

const OUTCOMES: readonly OutcomeClass[] = ['home', 'draw', 'away'];

export type LogisticTrainingRow = {
  features: readonly number[];
  actualOutcome: OutcomeClass;
};

export type LogisticTrainingOptions = {
  iterations: number;
  learningRate: number;
  l2Penalty: number;
};

export type MultinomialLogisticModel = {
  featureCount: number;
  weightsByOutcome: Readonly<Record<OutcomeClass, readonly number[]>>;
  predict(features: readonly number[]): OutcomeProbabilities;
};

type MutableWeightsByOutcome = Record<OutcomeClass, number[]>;

function assertFiniteNumber(value: number, label: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number.`);
  }
}

function validateTrainingOptions(options: LogisticTrainingOptions): void {
  if (!Number.isInteger(options.iterations) || options.iterations <= 0) {
    throw new Error('iterations must be a positive integer.');
  }

  assertFiniteNumber(options.learningRate, 'learningRate');
  assertFiniteNumber(options.l2Penalty, 'l2Penalty');

  if (options.learningRate <= 0) {
    throw new Error('learningRate must be greater than 0.');
  }

  if (options.l2Penalty < 0) {
    throw new Error('l2Penalty must be greater than or equal to 0.');
  }
}

function validateTrainingRows(rows: readonly LogisticTrainingRow[]): number {
  if (rows.length === 0) {
    throw new Error('At least one training row is required.');
  }

  const featureCount = rows[0]?.features.length ?? 0;
  if (featureCount === 0) {
    throw new Error('Training rows must include at least one feature.');
  }

  for (const row of rows) {
    if (row.features.length !== featureCount) {
      throw new Error('Training rows must all use the same feature dimension.');
    }

    for (const value of row.features) {
      assertFiniteNumber(value, 'feature value');
    }

    if (!OUTCOMES.includes(row.actualOutcome)) {
      throw new Error(`Unsupported outcome: ${String(row.actualOutcome)}`);
    }
  }

  return featureCount;
}

function initializeWeights(featureCount: number): MutableWeightsByOutcome {
  return {
    home: Array(featureCount).fill(0),
    draw: Array(featureCount).fill(0),
    away: Array(featureCount).fill(0)
  };
}

function dotProduct(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length) {
    throw new Error('Feature dimension mismatch.');
  }

  let total = 0;
  for (let index = 0; index < left.length; index += 1) {
    total += left[index]! * right[index]!;
  }

  return total;
}

function softmaxFromLogits(logits: Record<OutcomeClass, number>): OutcomeProbabilities {
  const maxLogit = Math.max(...OUTCOMES.map((outcome) => logits[outcome]));
  const expValues = OUTCOMES.map((outcome) => Math.exp(logits[outcome] - maxLogit));
  const denominator = expValues.reduce((sum, value) => sum + value, 0);

  return {
    home: expValues[0]! / denominator,
    draw: expValues[1]! / denominator,
    away: expValues[2]! / denominator
  };
}

function oneHotOutcome(outcome: OutcomeClass): Record<OutcomeClass, number> {
  return {
    home: outcome === 'home' ? 1 : 0,
    draw: outcome === 'draw' ? 1 : 0,
    away: outcome === 'away' ? 1 : 0
  };
}

function probabilityForRow(
  weightsByOutcome: Readonly<Record<OutcomeClass, readonly number[]>>,
  features: readonly number[]
): OutcomeProbabilities {
  const logits: Record<OutcomeClass, number> = {
    home: dotProduct(weightsByOutcome.home, features),
    draw: dotProduct(weightsByOutcome.draw, features),
    away: dotProduct(weightsByOutcome.away, features)
  };

  return softmaxFromLogits(logits);
}

export function trainMultinomialLogisticRegression(
  rows: readonly LogisticTrainingRow[],
  options: LogisticTrainingOptions
): MultinomialLogisticModel {
  validateTrainingOptions(options);
  const featureCount = validateTrainingRows(rows);
  const weightsByOutcome = initializeWeights(featureCount);
  const rowCount = rows.length;
  const learningRate = options.learningRate;
  const inverseRowCount = 1 / rowCount;

  for (let iteration = 0; iteration < options.iterations; iteration += 1) {
    const gradients: MutableWeightsByOutcome = {
      home: Array(featureCount).fill(0),
      draw: Array(featureCount).fill(0),
      away: Array(featureCount).fill(0)
    };

    for (const row of rows) {
      const probabilities = probabilityForRow(weightsByOutcome, row.features);
      const target = oneHotOutcome(row.actualOutcome);

      for (const outcome of OUTCOMES) {
        const gradient = gradients[outcome];
        const error = probabilities[outcome] - target[outcome];

        for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
          gradient[featureIndex]! += error * row.features[featureIndex]!;
        }
      }
    }

    for (const outcome of OUTCOMES) {
      const gradient = gradients[outcome];

      for (let featureIndex = 0; featureIndex < featureCount; featureIndex += 1) {
        gradient[featureIndex]! *= inverseRowCount;
        if (featureIndex > 0) {
          gradient[featureIndex]! += options.l2Penalty * weightsByOutcome[outcome][featureIndex]!;
        }
        weightsByOutcome[outcome][featureIndex]! -= learningRate * gradient[featureIndex]!;
      }
    }
  }

  const frozenWeights = {
    home: Object.freeze([...weightsByOutcome.home]),
    draw: Object.freeze([...weightsByOutcome.draw]),
    away: Object.freeze([...weightsByOutcome.away])
  } as const;

  return {
    featureCount,
    weightsByOutcome: frozenWeights,
    predict(features: readonly number[]): OutcomeProbabilities {
      if (features.length !== featureCount) {
        throw new Error(
          `Feature dimension mismatch: expected ${featureCount}, received ${features.length}.`
        );
      }

      for (const value of features) {
        assertFiniteNumber(value, 'feature value');
      }

      return probabilityForRow(frozenWeights, features);
    }
  };
}

function competitionIds(fixtures: readonly EvaluationFixture[]): string[] {
  return [...new Set(fixtures.map((fixture) => fixture.competitionId))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function featuresForFixture(
  fixture: EvaluationFixture,
  knownCompetitionIds: readonly string[]
): readonly number[] {
  const competitionIndex = knownCompetitionIds.indexOf(fixture.competitionId);

  if (competitionIndex < 0) {
    throw new Error(`Fixture ${fixture.matchId} uses unknown competition ${fixture.competitionId}.`);
  }

  const features = Array.from({ length: knownCompetitionIds.length + 1 }, () => 0);
  features[0] = 1;
  features[competitionIndex + 1] = 1;
  return features;
}

function rowsFromFixtures(fixtures: readonly EvaluationFixture[]): LogisticTrainingRow[] {
  const knownCompetitionIds = competitionIds(fixtures);

  return fixtures.map((fixture) => ({
    features: featuresForFixture(fixture, knownCompetitionIds),
    actualOutcome: fixture.actualOutcome
  }));
}

export function predictWithMultinomialLogisticCandidate(
  dataset: EvaluationDataset
): CandidatePredictionBatch {
  const trainRows = rowsFromFixtures(dataset.train);
  const model = trainMultinomialLogisticRegression(trainRows, {
    iterations: 300,
    learningRate: 0.2,
    l2Penalty: 0.001
  });
  const knownCompetitionIds = competitionIds(dataset.train);

  return {
    candidateId: 'multinomial_logistic_competition_v0',
    candidateFamily: 'multinomial_logistic_regression',
    trainedOnSplitNames: ['train'],
    evaluatedOnSplitName: 'test',
    predictions: dataset.test.map((fixture) => ({
      matchId: fixture.matchId,
      actualOutcome: fixture.actualOutcome,
      probabilities: model.predict(featuresForFixture(fixture, knownCompetitionIds))
    }))
  };
}
