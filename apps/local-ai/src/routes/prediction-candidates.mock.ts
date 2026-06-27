import { MOCK_PREDICTIONS, MOCK_EXPLANATIONS } from '@miraichi/shared';

/**
 * Handles POST /ai/v1/predict.
 * Returns mock statistical prediction candidates (ADR-0006 compliance).
 */
export async function handlePredict(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = '';
  req.on('data', (chunk: unknown) => {
    body += chunk;
  });

  req.on('end', () => {
    try {
      const { matchId } = JSON.parse(body);
      if (!matchId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required field matchId' }));
        return;
      }

      console.log(`[local-ai] Calculating mock statistics/probabilities for match ${matchId}...`);

      const basePrediction = MOCK_PREDICTIONS[matchId as keyof typeof MOCK_PREDICTIONS] || {
        matchId,
        predictionId: "pred_2026_9999",
        generatedAt: new Date().toISOString(),
        predictionOutcome: "home_win",
        confidenceScore: 0.68,
        confidenceLevel: "medium",
        trace: {
          engine: "local-statistical-stub",
          version: "1.0.0-mock",
          runTimeMs: 142,
          inputVariables: {
            homeScoringAverage: 2.1,
            awayScoringAverage: 1.2,
            headToHeadRatio: 0.6
          }
        }
      };

      // Enrich with required fields: status, prediction_available, confidence_label, trace_summary, explanation_stub
      const candidatePayload = {
        ...basePrediction,
        status: "completed",
        prediction_available: true,
        confidence_label: basePrediction.confidenceLevel,
        trace_summary: `statistical-stub-trace-for-${matchId}`,
        explanation_stub: "Stubbed explanation using basic score average comparisons."
      };

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(candidatePayload));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
    }
  });
}

/**
 * Handles POST /ai/v1/explain.
 * Returns mock LLM chatbot response and audits for scope refusal (ADR-0007 compliance).
 */
export async function handleExplain(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
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
      const { predictionId, message } = JSON.parse(body);
      if (!predictionId || !message) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Missing required field predictionId or message' }));
        return;
      }

      console.log(`[local-ai] Running mock chat inference for query: "${message}"`);

      // Rule Check: Refuse non-sports/non-analytical requests (ADR-0007)
      const isSportsQuery = /predict|win|team|score|match|odds|play|ratio|history|average|stats/i.test(message);

      let responsePayload;
      if (!isSportsQuery) {
        responsePayload = {
          predictionId,
          reply: "I am a football prediction and statistical assistant. I cannot answer queries unrelated to football analytics or matches.",
          trace: {
            llmProvider: "mock-local-llm",
            modelName: "mock-instruct-v1",
            tokensUsed: { prompt: 15, completion: 18 },
            refusalCheck: { passed: false, action: "refuse" }
          }
        };
      } else {
        responsePayload = MOCK_EXPLANATIONS[predictionId as keyof typeof MOCK_EXPLANATIONS] || {
          predictionId,
          reply: "Based on the mock historical trace, the model favors Team A due to their higher average home scoring rate (2.1 vs 1.2) and a strong head-to-head record.",
          trace: {
            llmProvider: "mock-local-llm",
            modelName: "mock-instruct-v1",
            tokensUsed: { prompt: 45, completion: 30 },
            refusalCheck: { passed: true, action: "reply" }
          }
        };
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responsePayload));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid JSON request body' }));
    }
  });
}
