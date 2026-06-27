/**
 * mock-explanation-refusal.ts
 * Evaluates prediction envelopes and returns natural language refusal rationales
 * when predictionAvailable is false. Does not speculate, invent predictions,
 * or connect to external LLMs.
 */

export function generateMockExplanation(envelope) {
  if (!envelope || typeof envelope !== 'object') {
    return {
      explanationAvailable: false,
      reason: 'Missing prediction envelope payload.',
      references: {}
    };
  }

  // Mandatory Refusal: if predictionAvailable is false, return deterministic clarification
  if (!envelope.predictionAvailable) {
    return {
      explanationAvailable: false,
      reason: 'No owner-approved prediction algorithm is active.',
      references: {
        predictionId: envelope.predictionId || 'unknown-prediction',
        traceId: envelope.trace ? envelope.trace.inputCandidateId : 'unknown-trace'
      },
      text: `No prediction data is available for match ${envelope.matchId} because no owner-approved prediction algorithm is active. I cannot speculate on this match outcome. (Trace: ${envelope.predictionId || 'unknown'})`
    };
  }

  // Fallback if somehow true but no algorithm is active
  return {
    explanationAvailable: false,
    reason: 'Strategy execution not implemented. Real model explanations require owner-approved ADR.',
    references: {
      predictionId: envelope.predictionId
    }
  };
}
