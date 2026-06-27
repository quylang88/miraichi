/**
 * Health check endpoint for local-ai.
 */
export function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'local-ai-service',
    timestamp: new Date().toISOString()
  }));
}
