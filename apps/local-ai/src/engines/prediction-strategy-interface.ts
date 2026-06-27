/**
 * prediction-strategy-interface.ts
 * Documents the interface requirements for prediction strategy modules.
 * 
 * CRITICAL WARNING: Implementing real prediction strategy algorithms,
 * probability calculations, neural nets, or statistical heuristics
 * requires a specific, owner-approved ADR before coding.
 */

export class BasePredictionStrategy {
  /**
   * Evaluates the inputCandidate.
   * @param {Object} inputCandidate The normalized input candidate.
   * @returns {Object} A partial prediction envelope dataset.
   * @throws {Error} If execution fails or is not implemented.
   */
  evaluate(inputCandidate) {
    throw new Error(
      'evaluate() must be implemented by concrete strategy subclasses. Real strategy execution requires owner-approved ADR.'
    );
  }
}

/**
 * Validator helper to check if a strategy object implements the interface correctly.
 */
export function isValidStrategy(strategy) {
  return (
    strategy &&
    typeof strategy === 'object' &&
    typeof strategy.evaluate === 'function'
  );
}
