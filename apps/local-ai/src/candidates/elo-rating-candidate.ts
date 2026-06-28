import type {
  EvaluationDataset,
  EvaluationFixture
} from '../evaluation/evaluation-dataset.js';
import type { OutcomeProbabilities } from '../evaluation/evaluation-metrics.js';
import type { CandidatePredictionBatch } from './candidate-types.js';

export type EloCandidateInput = Pick<EvaluationDataset, 'train' | 'validation' | 'test'>;

const INITIAL_RATING = 1500;
const K_FACTOR = 24;
const DEFAULT_DRAW_RATE = 0.25;
const MIN_DRAW_RATE = 0.18;
const MAX_DRAW_RATE = 0.36;
const ELO_SCALE = 400;

type TeamRatings = Map<string, number>;

function sortedChronologically(fixtures: readonly EvaluationFixture[]): EvaluationFixture[] {
  return [...fixtures].sort((left, right) => {
    const leftTime = new Date(left.kickoffTime).getTime();
    const rightTime = new Date(right.kickoffTime).getTime();
    return leftTime - rightTime;
  });
}

function getRating(ratings: TeamRatings, teamId: string): number {
  const currentRating = ratings.get(teamId);
  if (currentRating === undefined) {
    ratings.set(teamId, INITIAL_RATING);
    return INITIAL_RATING;
  }

  return currentRating;
}

function ratingForPrediction(ratings: TeamRatings, teamId: string): number {
  return ratings.get(teamId) ?? INITIAL_RATING;
}

function expectedHomeScore(homeRating: number, awayRating: number): number {
  return 1 / (1 + Math.pow(10, (awayRating - homeRating) / ELO_SCALE));
}

function actualScore(outcome: EvaluationFixture['actualOutcome'], side: 'home' | 'away'): number {
  if (outcome === 'draw') {
    return 0.5;
  }

  return outcome === side ? 1 : 0;
}

function updateRatings(ratings: TeamRatings, fixture: EvaluationFixture): void {
  const homeRating = getRating(ratings, fixture.homeTeamId);
  const awayRating = getRating(ratings, fixture.awayTeamId);
  const expectedHome = expectedHomeScore(homeRating, awayRating);
  const expectedAway = 1 - expectedHome;
  const homeActual = actualScore(fixture.actualOutcome, 'home');
  const awayActual = actualScore(fixture.actualOutcome, 'away');

  ratings.set(fixture.homeTeamId, homeRating + K_FACTOR * (homeActual - expectedHome));
  ratings.set(fixture.awayTeamId, awayRating + K_FACTOR * (awayActual - expectedAway));
}

function clampDrawRate(drawRate: number): number {
  return Math.min(MAX_DRAW_RATE, Math.max(MIN_DRAW_RATE, drawRate));
}

function drawProbabilityFromTraining(fixtures: readonly EvaluationFixture[]): number {
  if (fixtures.length === 0) {
    return DEFAULT_DRAW_RATE;
  }

  const drawCount = fixtures.reduce(
    (count, fixture) => count + (fixture.actualOutcome === 'draw' ? 1 : 0),
    0
  );

  return clampDrawRate(drawCount / fixtures.length);
}

function probabilitiesFromRatings(
  homeRating: number,
  awayRating: number,
  drawProbability: number
): OutcomeProbabilities {
  const nonDrawMass = 1 - drawProbability;
  const homeShare = expectedHomeScore(homeRating, awayRating);

  return {
    home: nonDrawMass * homeShare,
    draw: drawProbability,
    away: nonDrawMass * (1 - homeShare)
  };
}

export function predictWithEloRatingCandidate(
  input: EloCandidateInput
): CandidatePredictionBatch {
  const trainingFixtures = sortedChronologically([...input.train, ...input.validation]);
  const ratings: TeamRatings = new Map();
  const drawProbability = drawProbabilityFromTraining(trainingFixtures);

  for (const fixture of trainingFixtures) {
    updateRatings(ratings, fixture);
  }

  return {
    candidateId: 'elo_rating_v0',
    candidateFamily: 'elo_rating',
    trainedOnSplitNames: ['train', 'validation'],
    evaluatedOnSplitName: 'test',
    predictions: input.test.map((fixture) => {
      const homeRating = ratingForPrediction(ratings, fixture.homeTeamId);
      const awayRating = ratingForPrediction(ratings, fixture.awayTeamId);

      return {
        matchId: fixture.matchId,
        actualOutcome: fixture.actualOutcome,
        probabilities: probabilitiesFromRatings(homeRating, awayRating, drawProbability)
      };
    })
  };
}
