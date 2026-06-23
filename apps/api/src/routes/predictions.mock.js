import { MOCK_PREDICTIONS } from '@miraichi/shared';
import url from 'url';

const LOCAL_AI_URL = 'http://localhost:3002';

/**
 * Handles GET /api/v1/predictions?matchId={matchId}.
 * Proxies to local-ai statistics processor, or falls back to mock payload.
 */
export async function handlePredictions(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const matchId = parsedUrl.query.matchId;

  if (!matchId) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Missing matchId query parameter' }));
    return;
  }

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  try {
    console.log(`[API Gateway] Proxying /api/v1/predictions for match ${matchId} to local-ai...`);
    const aiRes = await fetch(`${LOCAL_AI_URL}/ai/v1/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId })
    });
    
    if (aiRes.ok) {
      const data = await aiRes.json();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }
    throw new Error(`local-ai service returned status ${aiRes.status}`);
  } catch (err) {
    console.warn(`[API Gateway] downstream local-ai failed (${err.message}). Using fallback mock.`);
    const prediction = MOCK_PREDICTIONS[matchId] || {
      matchId,
      predictionId: "pred_2026_9999",
      generatedAt: new Date().toISOString(),
      predictionOutcome: "home_win",
      confidenceScore: 0.68,
      confidenceLevel: "medium",
      trace: {
        engine: "api-gateway-fallback-stub",
        version: "1.0.0-mock",
        runTimeMs: 142,
        inputVariables: {
          homeScoringAverage: 2.1,
          awayScoringAverage: 1.2,
          headToHeadRatio: 0.6
        }
      }
    };
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(prediction));
  }
}
