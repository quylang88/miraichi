import { describe, expect, it, vi } from 'vitest';
import { createCloudflareGateway, type CloudflareGatewayEnv } from './index.js';

function environment(assetResponse = new Response('asset')): CloudflareGatewayEnv {
  return {
    ASSETS: { fetch: vi.fn(async () => assetResponse) },
    DEPLOYMENT_ENV: 'staging',
    MIRAICHI_EDGE_FUNCTION_URL: 'https://project-ref.supabase.co/functions/v1/miraichi-api',
    MIRAICHI_GATEWAY_TOKEN: 'gateway-token-with-at-least-thirty-two-bytes',
    MIRAICHI_PUBLIC_ORIGIN: 'https://miraichi-stage.workers.dev',
    MIRAICHI_EDGE_REGION: 'eu-central-1'
  };
}

describe('Cloudflare owner gateway', () => {
  it('delegates every non-API request to Static Assets', async () => {
    const env = environment(new Response('static-shell'));
    const upstream = vi.fn();
    const worker = createCloudflareGateway({ fetcher: upstream as unknown as typeof fetch });

    await expect(worker.fetch(new Request('https://miraichi-stage.workers.dev/today'), env))
      .resolves.toHaveProperty('status', 200);
    await expect(worker.fetch(new Request('https://miraichi-stage.workers.dev/apix'), env))
      .resolves.toHaveProperty('status', 200);
    expect(env.ASSETS.fetch).toHaveBeenCalledTimes(2);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('streams one exact API request and overwrites only gateway routing headers', async () => {
    const upstreamHeaders = new Headers({ 'Content-Type': 'application/json', Connection: 'close' });
    upstreamHeaders.append('Set-Cookie', 'one=1; Secure');
    upstreamHeaders.append('Set-Cookie', 'two=2; Secure');
    const upstream = vi.fn(async (_input: string | URL | Request, _init?: RequestInit) => new Response('{"ok":true}', {
      status: 201, headers: upstreamHeaders
    }));
    const worker = createCloudflareGateway({ fetcher: upstream as unknown as typeof fetch });
    const env = environment();
    const response = await worker.fetch(new Request(
      'https://miraichi-stage.workers.dev/api/v1/bets?view=pending',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Cookie: '__Host-miraichi_owner=session',
          Origin: 'https://miraichi-stage.workers.dev',
          Connection: 'keep-alive',
          'x-miraichi-gateway-token': 'attacker-value',
          'x-region': 'attacker-region'
        },
        body: JSON.stringify({ stakePoints: 5 })
      }
    ), env);

    expect(upstream).toHaveBeenCalledTimes(1);
    const forwardedUrl = String(upstream.mock.calls[0]![0]);
    const forwarded = upstream.mock.calls[0]![1]!;
    const headers = new Headers(forwarded.headers);
    expect(forwardedUrl).toBe(
      'https://project-ref.supabase.co/functions/v1/miraichi-api/api/v1/bets?view=pending'
    );
    expect(forwarded.method).toBe('POST');
    expect(forwarded.redirect).toBe('manual');
    expect(headers.get('cookie')).toBe('__Host-miraichi_owner=session');
    expect(headers.get('origin')).toBe('https://miraichi-stage.workers.dev');
    expect(headers.get('connection')).toBeNull();
    expect(headers.get('x-miraichi-gateway-token')).toBe(env.MIRAICHI_GATEWAY_TOKEN);
    expect(headers.get('x-region')).toBe('eu-central-1');
    await expect(new Response(forwarded.body).json()).resolves.toEqual({ stakePoints: 5 });

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('connection')).toBeNull();
    expect(response.headers.getSetCookie()).toEqual(['one=1; Secure', 'two=2; Secure']);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });

  it('returns sanitized gateway failures without retrying upstream', async () => {
    const networkFetch = vi.fn(async () => { throw new Error('secret upstream detail'); });
    const timeoutFetch = vi.fn(async () => { throw new DOMException('timed out detail', 'TimeoutError'); });
    const request = () => new Request('https://miraichi-stage.workers.dev/api/v1/health');

    const network = await createCloudflareGateway({ fetcher: networkFetch as unknown as typeof fetch })
      .fetch(request(), environment());
    expect(network.status).toBe(502);
    expect(await network.text()).not.toContain('secret upstream detail');
    expect(networkFetch).toHaveBeenCalledTimes(1);

    const timeout = await createCloudflareGateway({ fetcher: timeoutFetch as unknown as typeof fetch })
      .fetch(request(), environment());
    expect(timeout.status).toBe(504);
    expect(await timeout.text()).not.toContain('timed out detail');
    expect(timeoutFetch).toHaveBeenCalledTimes(1);
  });
});
