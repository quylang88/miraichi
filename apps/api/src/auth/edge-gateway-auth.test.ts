import { describe, expect, it } from 'vitest';
import { authorizeEdgeGateway, readEdgeGatewayConfig } from './edge-gateway-auth.js';

describe('Supabase Edge gateway authentication', () => {
  const token = 'edge-gateway-token-with-at-least-32-bytes';

  it('requires one strong server-side gateway token', () => {
    expect(() => readEdgeGatewayConfig({})).toThrow('MIRAICHI_GATEWAY_TOKEN is required');
    expect(() => readEdgeGatewayConfig({ MIRAICHI_GATEWAY_TOKEN: 'too-short' })).toThrow('at least 32 bytes');
    expect(readEdgeGatewayConfig({ MIRAICHI_GATEWAY_TOKEN: token })).toEqual({ token });
  });

  it('returns the same generic denial for missing, wrong, empty, or duplicate headers', async () => {
    const config = { token };
    const headers = new Headers();
    headers.append('x-miraichi-gateway-token', token);
    headers.append('x-miraichi-gateway-token', token);
    const requests = [
      new Request('https://edge.example/functions/v1/miraichi-api/api/v1/health'),
      new Request('https://edge.example/functions/v1/miraichi-api/api/v1/health', {
        headers: { 'x-miraichi-gateway-token': '' }
      }),
      new Request('https://edge.example/functions/v1/miraichi-api/api/v1/health', {
        headers: { 'x-miraichi-gateway-token': `${token}x` }
      }),
      new Request('https://edge.example/functions/v1/miraichi-api/api/v1/health', { headers })
    ];

    for (const request of requests) {
      const response = authorizeEdgeGateway(request, config);
      expect(response?.status).toBe(401);
      await expect(response?.json()).resolves.toEqual({
        error: { code: 'gateway_auth_required', message: 'Gateway authentication required.' }
      });
    }
  });

  it('continues only for one exact token', () => {
    const request = new Request('https://edge.example/functions/v1/miraichi-api/api/v1/health', {
      headers: { 'x-miraichi-gateway-token': token }
    });
    expect(authorizeEdgeGateway(request, { token })).toBeNull();
  });
});
