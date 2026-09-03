import { createHash, timingSafeEqual } from 'node:crypto';
import { errorResponse } from '../http/web-http.js';

const MIN_GATEWAY_TOKEN_BYTES = 32;
export const EDGE_GATEWAY_HEADER = 'x-miraichi-gateway-token';

export interface EdgeGatewayConfig {
  readonly token: string;
}

function utf8Length(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function secureEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function readEdgeGatewayConfig(
  env: Readonly<Record<string, string | undefined>>
): EdgeGatewayConfig {
  const token = env.MIRAICHI_GATEWAY_TOKEN?.trim();
  if (!token) throw new Error('MIRAICHI_GATEWAY_TOKEN is required');
  if (utf8Length(token) < MIN_GATEWAY_TOKEN_BYTES) {
    throw new Error(`MIRAICHI_GATEWAY_TOKEN must be at least ${MIN_GATEWAY_TOKEN_BYTES} bytes`);
  }
  if (token.includes(',')) throw new Error('MIRAICHI_GATEWAY_TOKEN must not contain a comma');
  return { token };
}

export function authorizeEdgeGateway(
  request: Request,
  config: EdgeGatewayConfig
): Response | null {
  const provided = request.headers.get(EDGE_GATEWAY_HEADER);
  if (!provided || provided.includes(',') || !secureEqual(provided, config.token)) {
    return errorResponse(401, 'gateway_auth_required', 'Gateway authentication required.', {
      headers: { 'Cache-Control': 'no-store' }
    });
  }
  return null;
}
