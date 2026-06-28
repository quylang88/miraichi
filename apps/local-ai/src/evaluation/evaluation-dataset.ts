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
  competitionIds?: string[];
  datasetIds?: string[];
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

    const fixture: EvaluationFixture = {
      matchId: record.id,
      split,
      competitionId: record.competitionId,
      kickoffTime: record.kickoffTime,
      actualOutcome: actualOutcomeFromScores(record.scores)
    };

    const marketProbabilities = marketProbabilitiesFromRecord(record);
    if (marketProbabilities) {
      fixture.marketProbabilities = marketProbabilities;
    }

    fixtures.push(fixture);
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

export type AggregateEvaluationDataset = EvaluationDataset & {
  competitionIds: string[];
};

export function loadEvaluationDatasets(processedDirs: readonly string[]): AggregateEvaluationDataset {
  if (processedDirs.length === 0) {
    throw new Error('At least one processed dataset directory is required.');
  }

  const datasets = processedDirs.map((processedDir) => loadEvaluationDataset(processedDir));
  const first = datasets[0];
  const competitionIds = datasets.map((dataset) => dataset.competitionId);
  const datasetIds = datasets.map((dataset) => dataset.metadata.datasetId);
  const aggregateCompetitionId = 'aggregate-national-team';
  const aggregateMetadata: EvaluationDatasetMetadata = {
    ...first.metadata,
    datasetId: `dataset-national-team-aggregate-${competitionIds.join('__')}`,
    competitionId: aggregateCompetitionId,
    sourceSnapshotHash: datasets.map((dataset) => dataset.metadata.sourceSnapshotHash).join('|'),
    trainCount: datasets.reduce((sum, dataset) => sum + dataset.train.length, 0),
    valCount: datasets.reduce((sum, dataset) => sum + dataset.validation.length, 0),
    testCount: datasets.reduce((sum, dataset) => sum + dataset.test.length, 0),
  };

  return {
    metadata: aggregateMetadata,
    competitionId: aggregateCompetitionId,
    competitionIds,
    datasetIds,
    train: datasets.flatMap((dataset) => dataset.train),
    validation: datasets.flatMap((dataset) => dataset.validation),
    test: datasets.flatMap((dataset) => dataset.test),
    skippedRecordCount: datasets.reduce((sum, dataset) => sum + dataset.skippedRecordCount, 0),
  };
}
