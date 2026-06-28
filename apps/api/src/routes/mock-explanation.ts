/**
 * mock-explanation.ts
 * API Gateway route for POST /api/v1/mock/explain.
 * Proxies to local-ai /ai/v1/mock/explain, falling back to a safe refusal if unreachable.
 */

import type { IncomingMessage, ServerResponse } from 'http';
import { isJsonObject, parseJsonObjectBody, readNestedStringField, readStringField, type JsonObject } from './json-body.js';

const LOCAL_AI_URL = 'http://localhost:3002';

export function handleMockExplain(req: IncomingMessage, res: ServerResponse): void {
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
    let envelope: JsonObject = {};
    try {
      envelope = parseJsonObjectBody(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
      return;
    }

    try {
      console.log(`[API Gateway] Proxying /api/v1/mock/explain to local-ai...`);
      const aiRes = await fetch(`${LOCAL_AI_URL}/ai/v1/mock/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(envelope)
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
      console.warn(`[API Gateway] downstream local-ai mock explain failed (${errMessage}). Using safe refusal fallback.`);

      const fallbackRefusal = {
        explanationAvailable: false,
        reason: 'No owner-approved prediction algorithm is active.',
        references: {
          predictionId: readStringField(envelope, 'predictionId', 'unknown-prediction'),
          traceId: readNestedStringField(envelope, 'trace', 'inputCandidateId', 'unknown-trace')
        },
        text: `No prediction data is available because the explanation service is unreachable. (Trace: ${readStringField(envelope, 'predictionId', 'unreachable')})`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fallbackRefusal));
    }
  });
}
