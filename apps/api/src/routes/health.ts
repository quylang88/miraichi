/**
 * Health check endpoint.
 */
import type { ReleaseMetadata } from '@miraichi/shared';

export function handleHealth(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  release?: ReleaseMetadata
) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'ok',
    service: 'api-mediation-gateway',
    timestamp: new Date().toISOString(),
    ...(release ? { release } : {})
  }));
}
