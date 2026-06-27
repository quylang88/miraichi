/**
 * mock-prediction.ts
 * Router endpoint for POST /ai/v1/mock/predict.
 * Returns standard traceable prediction envelopes and defaults to mock refusal.
 */

import { runMockPrediction } from '../engines/mock-prediction-engine.js';
import { mockInputCandidate } from '../input/mock-input-candidate.js';

export function handleMockPredict(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      let inputCandidate;
      // If the body is empty or only whitespace, fallback to standard mock input
      if (!body.trim()) {
        inputCandidate = mockInputCandidate;
      } else {
        inputCandidate = JSON.parse(body);
      }

      console.log(`[local-ai] Running mock prediction for candidateId: ${inputCandidate.inputCandidateId || 'unknown'}`);
      const predictionEnvelope = runMockPrediction(inputCandidate);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(predictionEnvelope));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Invalid JSON request body' }));
    }
  });
}
