/**
 * Health check endpoint.
 */
export function handleHealth(req: import('http').IncomingMessage, res: import('http').ServerResponse) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'api-mediation-gateway',
    timestamp: new Date().toISOString()
  }));
}
