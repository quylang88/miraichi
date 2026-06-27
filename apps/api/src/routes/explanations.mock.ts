import { MOCK_EXPLANATIONS } from '@miraichi/shared';

const LOCAL_AI_URL = 'http://localhost:3002';

/**
 * Handles POST /api/v1/chat.
 * Proxies to local-ai /ai/v1/explain, or returns mock/refusal payload.
 */
export async function handleExplanations(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', chunk => {
    body += chunk;
  });

  req.on('end', async () => {
    try {
      const payload = JSON.parse(body);
      const { predictionId, message } = payload;

      if (!predictionId || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required parameters predictionId or message' }));
        return;
      }

      console.log(`[API Gateway] Proxying /api/v1/chat request to local-ai /ai/v1/explain...`);

      try {
        const aiRes = await fetch(`${LOCAL_AI_URL}/ai/v1/explain`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ predictionId, message })
        });

        if (aiRes.ok) {
          const data = await aiRes.json();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
          return;
        }
        throw new Error(`local-ai service returned status ${aiRes.status}`);
      } catch (err) {
        console.warn(`[API Gateway] Downstream local-ai explanation request failed (${err.message}). Using fallback.`);

        // Rule Check: Refuse non-sports questions (ADR-0007)
        const isSportsQuery = /predict|win|team|score|match|odds|play|ratio|history|average|stats/i.test(message);

        let responsePayload;
        if (!isSportsQuery) {
          responsePayload = {
            predictionId,
            reply: "I am a football prediction and statistical assistant. I cannot answer queries unrelated to football analytics or matches.",
            trace: {
              llmProvider: "mock-local-llm-fallback",
              modelName: "mock-instruct-v1",
              tokensUsed: { prompt: 15, completion: 18 },
              refusalCheck: { passed: false, action: "refuse" }
            }
          };
        } else {
          responsePayload = MOCK_EXPLANATIONS[predictionId] || {
            predictionId,
            reply: "Based on the mock historical trace, the model favors Team A due to their higher average home scoring rate (2.1 vs 1.2) and a strong head-to-head record.",
            trace: {
              llmProvider: "mock-local-llm-fallback",
              modelName: "mock-instruct-v1",
              tokensUsed: { prompt: 45, completion: 30 },
              refusalCheck: { passed: true, action: "reply" }
            }
          };
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(responsePayload));
      }
    } catch (parseErr) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
    }
  });
}
