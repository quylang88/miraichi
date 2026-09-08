import { readCloudflareGatewayConfig } from './config.js';

export interface StaticAssetsBinding {
  fetch(request: Request): Promise<Response>;
}

export interface CloudflareGatewayEnv extends Readonly<Record<string, unknown>> {
  readonly ASSETS: StaticAssetsBinding;
  readonly DEPLOYMENT_ENV: string;
  readonly MIRAICHI_EDGE_FUNCTION_URL: string;
  readonly MIRAICHI_GATEWAY_TOKEN: string;
  readonly MIRAICHI_PUBLIC_ORIGIN: string;
  readonly MIRAICHI_EDGE_REGION: string;
}

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade'
]);
const INTERNAL_UPSTREAM_RESPONSE_HEADERS = new Set([
  'endpoint-load-metrics',
  'sb-gateway-version',
  'sb-project-ref',
  'sb-request-id',
  'x-deno-execution-id',
  'x-sb-edge-region',
  'x-served-by'
]);
const UPSTREAM_TIMEOUT_MS = 15_000;

function isApiPath(pathname: string): boolean {
  return pathname === '/api' || pathname.startsWith('/api/');
}

function sanitizedFailure(status: 500 | 502 | 504, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, {
    status,
    headers: { 'Cache-Control': 'no-store' }
  });
}

function forwardingHeaders(request: Request, gatewayToken: string, region: string): Headers {
  const headers = new Headers(request.headers);
  for (const name of HOP_BY_HOP_HEADERS) headers.delete(name);
  headers.delete('host');
  headers.set('x-miraichi-gateway-token', gatewayToken);
  headers.set('x-region', region);
  return headers;
}

function responseHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const [name, value] of source.entries()) {
    const normalizedName = name.toLowerCase();
    if (normalizedName !== 'set-cookie'
      && !HOP_BY_HOP_HEADERS.has(normalizedName)
      && !INTERNAL_UPSTREAM_RESPONSE_HEADERS.has(normalizedName)) {
      headers.append(name, value);
    }
  }
  const cookies = source.getSetCookie();
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  headers.set('Cache-Control', 'no-store');
  return headers;
}

export function createCloudflareGateway(options: {
  readonly fetcher?: typeof fetch;
} = {}) {
  const fetcher = options.fetcher ?? fetch;
  return {
    async fetch(request: Request, env: CloudflareGatewayEnv): Promise<Response> {
      const incomingUrl = new URL(request.url);
      if (!isApiPath(incomingUrl.pathname)) return env.ASSETS.fetch(request);

      let config;
      try {
        config = readCloudflareGatewayConfig(env);
      } catch {
        return sanitizedFailure(500, 'gateway_configuration_error', 'Gateway configuration is invalid.');
      }

      const upstreamUrl = new URL(config.functionUrl);
      upstreamUrl.pathname = `${upstreamUrl.pathname}${incomingUrl.pathname}`;
      upstreamUrl.search = incomingUrl.search;
      try {
        const upstream = await fetcher(upstreamUrl, {
          method: request.method,
          headers: forwardingHeaders(request, config.gatewayToken, config.region),
          body: request.method === 'GET' || request.method === 'HEAD' ? null : request.body,
          redirect: 'manual',
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS)
        });
        return new Response(upstream.body, {
          status: upstream.status,
          statusText: upstream.statusText,
          headers: responseHeaders(upstream.headers)
        });
      } catch (error) {
        const isTimeout = error instanceof DOMException
          && (error.name === 'TimeoutError' || error.name === 'AbortError');
        return isTimeout
          ? sanitizedFailure(504, 'edge_upstream_timeout', 'Edge API timed out.')
          : sanitizedFailure(502, 'edge_upstream_unavailable', 'Edge API is unavailable.');
      }
    }
  };
}

export default createCloudflareGateway();
