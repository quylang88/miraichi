/**
 * mock-explanation.js
 * API Gateway route for POST /api/v1/mock/explain.
 * Proxies to local-ai /ai/v1/mock/explain, falling back to a safe refusal if unreachable.
 */

const LOCAL_AI_URL = 'http://localhost:3002';

export function handleMockExplain(req, res) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    let envelope = {};
    try {
      if (body.trim()) {
        envelope = JSON.parse(body);
      }
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
      console.warn(`[API Gateway] downstream local-ai mock explain failed (${err.message}). Using safe refusal fallback.`);
      
      const fallbackRefusal = {
        explanationAvailable: false,
        reason: 'No owner-approved prediction algorithm is active.',
        references: {
          predictionId: envelope.predictionId || 'unknown-prediction',
          traceId: envelope.trace ? envelope.trace.inputCandidateId : 'unknown-trace'
        },
        text: `No prediction data is available because the explanation service is unreachable. (Trace: ${envelope.predictionId || 'unreachable'})`
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(fallbackRefusal));
    }
  });
}
