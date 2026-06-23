/**
 * Health check endpoint.
 */
export function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'api-mediation-gateway',
    timestamp: new Date().toISOString()
  }));
}
