import { Readable } from 'node:stream';
import type { IncomingMessage, RequestListener, ServerResponse } from 'node:http';
import type { ApiHandler } from '../api-router.js';

export type NodeFallbackHandler = (
  request: IncomingMessage,
  response: ServerResponse
) => void | Promise<void>;

function requestUrl(request: IncomingMessage): string {
  const forwarded = request.headers['x-forwarded-proto'];
  const protocol = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim() || 'http';
  const host = request.headers.host || 'localhost';
  return new URL(request.url || '/', `${protocol}://${host}`).toString();
}

function toWebRequest(request: IncomingMessage): Request {
  const controller = new AbortController();
  request.once('aborted', () => controller.abort());
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: request.method ?? 'GET',
    headers: request.headers as HeadersInit,
    signal: controller.signal
  };
  if (hasBody) {
    init.body = Readable.toWeb(request) as ReadableStream<Uint8Array>;
    init.duplex = 'half';
  }
  return new Request(requestUrl(request), init);
}

async function writeWebResponse(response: Response, target: ServerResponse): Promise<void> {
  const setCookies = response.headers.getSetCookie();
  for (const [name, value] of response.headers.entries()) {
    if (name === 'set-cookie') continue;
    target.setHeader(name, value);
  }
  if (setCookies.length > 0) target.setHeader('Set-Cookie', setCookies);
  target.writeHead(response.status);
  if (!response.body) {
    target.end();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const body = Readable.fromWeb(response.body as import('node:stream/web').ReadableStream);
    body.once('error', reject);
    target.once('error', reject);
    target.once('finish', resolve);
    body.pipe(target);
  });
}

export function createNodeApiListener(
  apiHandler: ApiHandler,
  fallback?: NodeFallbackHandler
): RequestListener {
  return (request, response) => {
    void (async () => {
      try {
        const result = await apiHandler(toWebRequest(request));
        if (result) {
          await writeWebResponse(result, response);
          return;
        }
        if (fallback) {
          await fallback(request, response);
          return;
        }
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('404 Not Found');
      } catch {
        if (response.headersSent) {
          response.destroy();
          return;
        }
        response.writeHead(500, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store'
        });
        response.end(JSON.stringify({
          error: { code: 'api_runtime_error', message: 'API request failed.' }
        }));
      }
    })();
  };
}
