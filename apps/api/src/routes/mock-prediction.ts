/**
 * mock-prediction.ts
 * API Gateway route for POST /api/v1/mock/predict.
 * Proxies to local-ai /ai/v1/mock/predict, falling back to a safe envelope if unreachable.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { isJsonObject, parseJsonObjectBody, readNestedStringField, readStringField, type JsonObject } from './json-body.js';

const LOCAL_AI_URL = 'http://localhost:3002';

export function handleMockPredict(req: IncomingMessage, res: ServerResponse): void {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  let body = '';
  req.on('data', (chunk: unknown) => {
    body += String(chunk);
  });

  req.on('end', async () => {
    let inputCandidate: JsonObject = {};
    try {
      inputCandidate = parseJsonObjectBody(body);
    } catch {
      // Bad json request body handled gracefully
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
      return;
    }

    try {
      console.log(`[API Gateway] Proxying /api/v1/mock/predict to local-ai...`);
      const aiRes = await fetch(`${LOCAL_AI_URL}/ai/v1/mock/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(inputCandidate)
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data));
        return;
      }
      throw new Error(`local-ai returned status ${aiRes.status}`);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : String(err);
      console.warn(`[API Gateway] downstream local-ai mock predict failed (${errMessage}). Using safe unreachable fallback.`);

      const traceInput = inputCandidate.trace;
      const traceWorkerRunId = isJsonObject(traceInput)
        ? readStringField(traceInput, 'workerRunId', 'unknown-run')
        : 'unknown-run';

      // Construct safe fallback envelope
      const fallbackEnvelope = {
        predictionId: 'pred-fallback-unreachable',
        matchId: readStringField(inputCandidate, 'matchId', 'unknown-match'),
        competitionId: readStringField(inputCandidate, 'competitionId', 'unknown-competition'),
        seasonId: readStringField(inputCandidate, 'seasonId', 'unknown-season'),
        generatedAt: new Date().toISOString(),
        engineMode: 'mock',
        predictionAvailable: false,
        confidenceLabel: 'not_available',
        outputSummary: 'No owner-approved prediction algorithm is active.',
        trace: {
          inputCandidateId: readStringField(inputCandidate, 'inputCandidateId', 'unknown-candidate'),
          workerRunId: traceWorkerRunId,
          sourceProviderId: readStringField(inputCandidate, 'sourceProviderId', 'unknown-provider'),
          engineVersion: '1.0.0-mock'
        },
        warnings: ['downstream_service_unreachable']
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fallbackEnvelope));
    }
  });
}
