import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createNodeApiListener } from './node-api-adapter.js';

const servers: http.Server[] = [];

async function listen(handler: http.RequestListener): Promise<string> {
  const server = http.createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('test server did not bind');
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  })));
});

describe('Node adapter for the Web API', () => {
  it('streams the request and preserves repeated Set-Cookie response headers', async () => {
    const origin = await listen(createNodeApiListener(async (request) => {
      const body = await request.text();
      const headers = new Headers({ 'content-type': 'text/plain' });
      headers.append('set-cookie', 'owner=one; Path=/');
      headers.append('set-cookie', 'refresh=two; Path=/');
      return new Response(`${request.method}:${new URL(request.url).pathname}:${body}`, {
        status: 201,
        headers
      });
    }));

    const response = await fetch(`${origin}/api/echo`, { method: 'POST', body: 'streamed-body' });
    expect(response.status).toBe(201);
    expect(await response.text()).toBe('POST:/api/echo:streamed-body');
    expect(response.headers.getSetCookie()).toEqual(['owner=one; Path=/', 'refresh=two; Path=/']);
  });

  it('delegates a non-API null result to the Node static fallback', async () => {
    const origin = await listen(createNodeApiListener(
      async () => null,
      async (_request, response) => {
        response.writeHead(200, { 'content-type': 'text/plain' });
        response.end('static-fallback');
      }
    ));

    const response = await fetch(`${origin}/matches`);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('static-fallback');
  });

  it('returns a sanitized failure when the Web handler throws', async () => {
    const origin = await listen(createNodeApiListener(async () => {
      throw new Error('secret database password');
    }));

    const response = await fetch(`${origin}/api/v1/health`);
    expect(response.status).toBe(500);
    expect(await response.text()).toBe(JSON.stringify({
      error: { code: 'api_runtime_error', message: 'API request failed.' }
    }));
  });
});
