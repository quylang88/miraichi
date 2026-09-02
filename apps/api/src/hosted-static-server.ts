import { existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

export type HostedWebResolution =
  | { kind: 'file'; filePath: string; contentType: string }
  | { kind: 'not-found' };

const CONTENT_TYPES: Readonly<Record<string, string>> = Object.freeze({
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
});

function isFile(filePath: string): boolean {
  return existsSync(filePath) && statSync(filePath).isFile();
}

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

export function assertHostedWebReady(webRoot: string): void {
  if (!isFile(path.join(path.resolve(webRoot), 'index.html'))) {
    throw new Error(`Hosted mode requires a built PWA at ${path.resolve(webRoot)}. Run pnpm run build:web-static first.`);
  }
}

export function resolveHostedWebRequest(webRoot: string, requestPathname: string): HostedWebResolution {
  if (requestPathname === '/api' || requestPathname.startsWith('/api/')) return { kind: 'not-found' };

  let decoded: string;
  try {
    decoded = decodeURIComponent(requestPathname);
  } catch {
    return { kind: 'not-found' };
  }
  if (decoded.includes('\\') || decoded.split('/').includes('..') || decoded.includes('\0')) {
    return { kind: 'not-found' };
  }

  const root = path.resolve(webRoot);
  const relative = decoded.replace(/^\/+/, '');
  const candidate = path.resolve(root, relative || 'index.html');
  if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) return { kind: 'not-found' };

  if (isFile(candidate)) {
    return { kind: 'file', filePath: candidate, contentType: contentTypeFor(candidate) };
  }
  if (path.extname(relative)) return { kind: 'not-found' };

  const entry = path.join(root, 'index.html');
  return isFile(entry)
    ? { kind: 'file', filePath: entry, contentType: CONTENT_TYPES['.html']! }
    : { kind: 'not-found' };
}

export async function serveHostedWeb(
  req: IncomingMessage,
  res: ServerResponse,
  webRoot: string
): Promise<boolean> {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const pathname = new URL(req.url || '/', 'http://localhost').pathname;
  const resolution = resolveHostedWebRequest(webRoot, pathname);
  if (resolution.kind === 'not-found') return false;

  const body = await readFile(resolution.filePath);
  res.writeHead(200, {
    'Content-Type': resolution.contentType,
    'Content-Length': body.byteLength,
    'Cache-Control': resolution.filePath.endsWith('index.html') ? 'no-cache' : 'public, max-age=3600'
  });
  res.end(req.method === 'HEAD' ? undefined : body);
  return true;
}
