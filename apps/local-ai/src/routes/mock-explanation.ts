/**
 * mock-explanation.ts
 * Router endpoint for POST /ai/v1/mock/explain.
 * Enforces LLM explanation/refusal logic.
 */

import { generateMockExplanation } from '../explainability/mock-explanation-refusal.js';

export function handleMockExplain(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: unknown) => {
    body += String(chunk);
  });

  req.on('end', () => {
    try {
      if (!body.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required prediction envelope body.' }));
        return;
      }

      const envelope = JSON.parse(body);
      console.log(`[local-ai] Running mock explanation check for predictionId: ${envelope.predictionId || 'unknown'}`);
      
      const explanationPayload = generateMockExplanation(envelope);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(explanationPayload));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message || 'Invalid JSON request body' }));
    }
  });
}
