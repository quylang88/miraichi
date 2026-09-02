import type { IncomingMessage, ServerResponse } from 'node:http';

export type OriginBoundaryResult = 'continue' | 'handled';

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function normalizeOrigin(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

function requestOrigin(req: IncomingMessage): string | undefined {
  const host = header(req, 'host');
  if (!host) return undefined;
  const forwarded = header(req, 'x-forwarded-proto')?.split(',')[0]?.trim();
  const protocol = forwarded || 'http';
  return normalizeOrigin(`${protocol}://${host}`);
}

function reject(res: ServerResponse): OriginBoundaryResult {
  res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ error: { code: 'origin_forbidden', message: 'Request origin is not allowed.' } }));
  return 'handled';
}

export function enforceOriginBoundary(
  req: IncomingMessage,
  res: ServerResponse,
  configuredAllowedOrigin?: string
): OriginBoundaryResult {
  const originHeader = header(req, 'origin');
  if (!originHeader) return 'continue';

  const origin = normalizeOrigin(originHeader);
  if (!origin) return reject(res);
  const sameOrigin = requestOrigin(req);
  const allowedOrigin = normalizeOrigin(configuredAllowedOrigin);
  const isSameOrigin = origin === sameOrigin;
  const isConfiguredOrigin = allowedOrigin !== undefined && origin === allowedOrigin;
  if (!isSameOrigin && !isConfiguredOrigin) return reject(res);

  if (isConfiguredOrigin && !isSameOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return 'handled';
  }
  return 'continue';
}
