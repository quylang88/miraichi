export type OutcomeClass = 'home' | 'draw' | 'away';

export type OutcomeProbabilities = {
  home: number;
  draw: number;
  away: number;
};

export type EvaluationSample = {
  actualOutcome: OutcomeClass;
  probabilities: OutcomeProbabilities;
};

export type CalibrationBin = {
  index: number;
  lowerInclusive: number;
  upperExclusive: number;
  sampleCount: number;
  averageConfidence: number;
  accuracy: number;
  gap: number;
};

export type ExpectedCalibrationErrorResult = {
  ece: number;
  sampleCount: number;
  binCount: number;
  bins: CalibrationBin[];
};

const OUTCOME_CLASSES: readonly OutcomeClass[] = ['home', 'draw', 'away'];
const DEFAULT_EPSILON = 1e-15;
const PROBABILITY_SUM_TOLERANCE = 1e-6;

function assertNonEmptySamples(samples: readonly EvaluationSample[]): void {
  if (samples.length === 0) {
    throw new Error('At least one evaluation sample is required.');
  }
}

function assertValidProbabilityVector(probabilities: OutcomeProbabilities): void {
  const values = OUTCOME_CLASSES.map((outcome) => probabilities[outcome]);

  if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) {
    throw new Error('Predicted probabilities must be finite numbers between 0 and 1.');
  }

  const sum = values.reduce((total, value) => total + value, 0);
  if (Math.abs(sum - 1) > PROBABILITY_SUM_TOLERANCE) {
    throw new Error('Predicted probabilities must sum to 1.');
  }
}

function assertValidSamples(samples: readonly EvaluationSample[]): void {
  assertNonEmptySamples(samples);

  for (const sample of samples) {
    assertValidProbabilityVector(sample.probabilities);
  }
}

function oneHot(actualOutcome: OutcomeClass, outcome: OutcomeClass): number {
  return actualOutcome === outcome ? 1 : 0;
}

function clippedProbability(value: number, epsilon: number): number {
  return Math.min(1 - epsilon, Math.max(epsilon, value));
}

function predictedOutcome(probabilities: OutcomeProbabilities): OutcomeClass {
  return OUTCOME_CLASSES.reduce((bestOutcome, outcome) =>
    probabilities[outcome] > probabilities[bestOutcome] ? outcome : bestOutcome
  );
}

function confidence(probabilities: OutcomeProbabilities): number {
  return probabilities[predictedOutcome(probabilities)];
}

export function brierScore(samples: readonly EvaluationSample[]): number {
  assertValidSamples(samples);

  const total = samples.reduce((sampleTotal, sample) => {
    const sampleScore = OUTCOME_CLASSES.reduce((outcomeTotal, outcome) => {
      const error = sample.probabilities[outcome] - oneHot(sample.actualOutcome, outcome);
      return outcomeTotal + error * error;
    }, 0);

    return sampleTotal + sampleScore;
  }, 0);

  return total / samples.length;
}

export function logLoss(
  samples: readonly EvaluationSample[],
  epsilon: number = DEFAULT_EPSILON
): number {
  assertValidSamples(samples);

  if (!Number.isFinite(epsilon) || epsilon <= 0 || epsilon >= 0.5) {
    throw new Error('Log loss epsilon must be greater than 0 and less than 0.5.');
  }

  const total = samples.reduce((sum, sample) => {
    const probability = clippedProbability(sample.probabilities[sample.actualOutcome], epsilon);
    return sum - Math.log(probability);
  }, 0);

  return total / samples.length;
}

export function expectedCalibrationError(
  samples: readonly EvaluationSample[],
  binCount: number = 10
): ExpectedCalibrationErrorResult {
  assertValidSamples(samples);

  if (!Number.isInteger(binCount) || binCount <= 0) {
    throw new Error('ECE bin count must be a positive integer.');
  }

  const mutableBins = Array.from({ length: binCount }, (_, index) => ({
    index,
    lowerInclusive: index / binCount,
    upperExclusive: (index + 1) / binCount,
    sampleCount: 0,
    confidenceTotal: 0,
    correctCount: 0
  }));

  for (const sample of samples) {
    const sampleConfidence = confidence(sample.probabilities);
    const binIndex = Math.min(binCount - 1, Math.floor(sampleConfidence * binCount));
    const bin = mutableBins[binIndex];

    bin.sampleCount += 1;
    bin.confidenceTotal += sampleConfidence;
    bin.correctCount += predictedOutcome(sample.probabilities) === sample.actualOutcome ? 1 : 0;
  }

  let ece = 0;
  const bins = mutableBins.map((bin): CalibrationBin => {
    const averageConfidence = bin.sampleCount === 0 ? 0 : bin.confidenceTotal / bin.sampleCount;
    const accuracy = bin.sampleCount === 0 ? 0 : bin.correctCount / bin.sampleCount;
    const gap = Math.abs(accuracy - averageConfidence);

    ece += (bin.sampleCount / samples.length) * gap;

    return {
      index: bin.index,
      lowerInclusive: bin.lowerInclusive,
      upperExclusive: bin.upperExclusive,
      sampleCount: bin.sampleCount,
      averageConfidence,
      accuracy,
      gap
    };
  });

  return {
    ece,
    sampleCount: samples.length,
    binCount,
    bins
  };
}
