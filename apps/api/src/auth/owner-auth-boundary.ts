import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  OWNER_SESSION_COOKIE,
  createOwnerSessionToken,
  serializeExpiredOwnerSessionCookie,
  serializeOwnerSessionCookie,
  verifyOwnerPassword,
  verifyOwnerSessionToken,
  type OwnerAuthConfig
} from './owner-auth.js';

export type OwnerSessionBoundaryResult = 'continue' | 'handled';

const AUTH_ROUTE_PREFIX = '/api/v1/auth/';
const MAX_LOGIN_BODY_BYTES = 8 * 1024;

function pathname(req: IncomingMessage): string {
  return new URL(req.url || '/', 'http://localhost').pathname;
}

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function readCookie(req: IncomingMessage, name: string): string | undefined {
  const matches = (header(req, 'cookie') || '')
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${name}=`));
  if (matches.length !== 1) return undefined;
  return matches[0]!.slice(name.length + 1);
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(payload));
}

function invalidCredentials(res: ServerResponse): void {
  writeJson(res, 401, { error: { code: 'invalid_credentials', message: 'Invalid credentials.' } });
}

async function readLoginPassword(req: IncomingMessage): Promise<string | null> {
  if (!header(req, 'content-type')?.toLowerCase().startsWith('application/json')) return null;
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > MAX_LOGIN_BODY_BYTES) throw new RangeError('login_body_too_large');
    chunks.push(buffer);
  }
  try {
    const payload = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) return null;
    const password = (payload as Record<string, unknown>).password;
    return typeof password === 'string' && password.length <= 512 ? password : null;
  } catch {
    return null;
  }
}

function isAuthenticated(req: IncomingMessage, config: OwnerAuthConfig, nowMs = Date.now()): boolean {
  if (config.mode === 'disabled') return true;
  const token = readCookie(req, OWNER_SESSION_COOKIE);
  return token !== undefined && verifyOwnerSessionToken(token, config.sessionSecret!, nowMs);
}

export function isOwnerAuthRoute(requestPathname: string): boolean {
  return requestPathname.startsWith(AUTH_ROUTE_PREFIX);
}

export function enforceOwnerSession(
  req: IncomingMessage,
  res: ServerResponse,
  config: OwnerAuthConfig,
  nowMs = Date.now()
): OwnerSessionBoundaryResult {
  const requestPathname = pathname(req);
  if (!requestPathname.startsWith('/api/') || requestPathname === '/api/v1/health' || isOwnerAuthRoute(requestPathname)) {
    return 'continue';
  }
  if (isAuthenticated(req, config, nowMs)) return 'continue';
  writeJson(res, 401, { error: { code: 'authentication_required', message: 'Authentication required.' } });
  return 'handled';
}

export async function handleOwnerAuthRoute(
  req: IncomingMessage,
  res: ServerResponse,
  config: OwnerAuthConfig,
  nowMs = Date.now()
): Promise<void> {
  const requestPathname = pathname(req);
  res.setHeader('Cache-Control', 'no-store');

  if (requestPathname === '/api/v1/auth/session') {
    if (req.method !== 'GET') {
      res.setHeader('Allow', 'GET');
      writeJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
      return;
    }
    writeJson(res, 200, { authenticated: isAuthenticated(req, config, nowMs) });
    return;
  }

  if (requestPathname === '/api/v1/auth/login') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      writeJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
      return;
    }
    if (config.mode === 'disabled') {
      res.writeHead(204, { 'Cache-Control': 'no-store' });
      res.end();
      return;
    }

    let password: string | null;
    try {
      password = await readLoginPassword(req);
    } catch (error) {
      if (error instanceof RangeError) {
        writeJson(res, 413, { error: { code: 'request_too_large', message: 'Request body is too large.' } });
        return;
      }
      invalidCredentials(res);
      return;
    }
    if (password === null || !(await verifyOwnerPassword(password, config.passwordHash!))) {
      invalidCredentials(res);
      return;
    }

    const token = createOwnerSessionToken(config.sessionSecret!, nowMs, config.sessionTtlSeconds);
    res.setHeader('Set-Cookie', serializeOwnerSessionCookie(token, config.sessionTtlSeconds));
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (requestPathname === '/api/v1/auth/logout') {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      writeJson(res, 405, { error: { code: 'method_not_allowed', message: 'Method not allowed.' } });
      return;
    }
    res.setHeader('Set-Cookie', serializeExpiredOwnerSessionCookie());
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  writeJson(res, 404, { error: { code: 'not_found', message: 'Not found.' } });
}
