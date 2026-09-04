import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface EdgeRuntimeSmokeArgs {
  readonly scope: 'postgres' | 'auth' | 'all';
}

export interface EdgePostgresRuntimeSmokeResult {
  readonly scope: 'postgres';
  readonly parameterizedQuery: boolean;
  readonly rollback: boolean;
  readonly commit: boolean;
  readonly cleanup: boolean;
}

export interface EdgeAuthRuntimeSmokeResult {
  readonly scope: 'auth';
  readonly scrypt: true;
  readonly randomBytes: true;
  readonly hmacSession: true;
  readonly invalidLogin: true;
  readonly sessionCookie: true;
  readonly protectedRoute: true;
  readonly refreshIsolation: true;
  readonly logout: true;
}

export type EdgeRuntimeSmokeResult = EdgePostgresRuntimeSmokeResult | EdgeAuthRuntimeSmokeResult;

export interface EdgeAllRuntimeSmokeResult {
  readonly scope: 'all';
  readonly postgres: EdgePostgresRuntimeSmokeResult;
  readonly auth: EdgeAuthRuntimeSmokeResult;
}

export function parseEdgeRuntimeSmokeArgs(args: readonly string[]): EdgeRuntimeSmokeArgs {
  const scopeIndex = args.indexOf('--scope');
  const scope = scopeIndex >= 0 ? args[scopeIndex + 1] : undefined;
  if (scope !== 'postgres' && scope !== 'auth' && scope !== 'all') {
    throw new Error(`Unsupported Edge runtime smoke scope: ${scope ?? 'missing'}`);
  }
  return { scope };
}

export async function runEdgeRuntimeSmoke(options: {
  readonly scope: 'postgres' | 'auth' | 'all';
  readonly functionUrl: string;
  readonly gatewayToken: string;
  readonly ownerPassword?: string;
  readonly refreshToken?: string;
  readonly fetcher?: typeof fetch;
}): Promise<EdgeRuntimeSmokeResult | EdgeAllRuntimeSmokeResult> {
  if (Buffer.byteLength(options.gatewayToken, 'utf8') < 32) {
    throw new Error('MIRAICHI_GATEWAY_TOKEN must be at least 32 bytes');
  }
  const fetcher = options.fetcher ?? fetch;
  const functionUrl = options.functionUrl.replace(/\/$/, '');
  const gatewayHeaders = { 'x-miraichi-gateway-token': options.gatewayToken };
  if (options.scope === 'all') {
    const postgres = await runEdgeRuntimeSmoke({ ...options, scope: 'postgres' });
    const auth = await runEdgeRuntimeSmoke({ ...options, scope: 'auth' });
    if (postgres.scope !== 'postgres' || auth.scope !== 'auth') {
      throw new Error('Edge all-scope smoke returned an invalid result');
    }
    return { scope: 'all', postgres, auth };
  }
  if (options.scope === 'auth') {
    if (!options.ownerPassword || options.ownerPassword.length < 12) {
      throw new Error('MIRAICHI_OWNER_PASSWORD is required for the auth smoke');
    }
    if (!options.refreshToken || Buffer.byteLength(options.refreshToken, 'utf8') < 32) {
      throw new Error('MIRAICHI_REFRESH_TOKEN is required for the auth smoke');
    }
    const primitivesResponse = await fetcher(`${functionUrl}/__runtime-smoke/auth-primitives`, {
      method: 'POST', headers: gatewayHeaders
    });
    const primitives = primitivesResponse.ok
      ? await primitivesResponse.json() as Record<string, unknown>
      : {};

    const login = async (password: string) => fetcher(`${functionUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { ...gatewayHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const invalidResponse = await login(`${options.ownerPassword}-invalid`);
    const invalidBody = await invalidResponse.json().catch(() => ({})) as Record<string, unknown>;
    const invalidError = typeof invalidBody.error === 'object' && invalidBody.error !== null
      ? invalidBody.error as Record<string, unknown>
      : {};
    const invalidLogin = invalidResponse.status === 401
      && invalidError.code === 'invalid_credentials'
      && invalidError.message === 'Invalid credentials.';

    const loginResponse = await login(options.ownerPassword);
    const setCookie = loginResponse.headers.get('set-cookie') ?? '';
    const cookie = setCookie.split(';')[0] ?? '';
    const sessionCookie = loginResponse.status === 204
      && cookie.startsWith('__Host-miraichi_owner=v1.')
      && setCookie.includes('Path=/')
      && setCookie.includes('HttpOnly')
      && setCookie.includes('Secure')
      && setCookie.includes('SameSite=Strict');

    const protectedResponse = await fetcher(`${functionUrl}/api/v1/cloud-persistence/status`, {
      headers: { ...gatewayHeaders, Cookie: cookie }
    });
    const protectedBody = await protectedResponse.json().catch(() => ({})) as Record<string, unknown>;
    const protectedRoute = protectedResponse.status === 200
      && protectedBody.state === 'ready';

    const refreshResponse = await fetcher(`${functionUrl}/api/v1/cloud-persistence/status`, {
      headers: { ...gatewayHeaders, Authorization: `Bearer ${options.refreshToken}` }
    });
    const refreshBody = await refreshResponse.json().catch(() => ({})) as Record<string, unknown>;
    const refreshError = typeof refreshBody.error === 'object' && refreshBody.error !== null
      ? refreshBody.error as Record<string, unknown>
      : {};
    const refreshIsolation = refreshResponse.status === 401
      && refreshError.code === 'authentication_required';

    const logoutResponse = await fetcher(`${functionUrl}/api/v1/auth/logout`, {
      method: 'POST', headers: { ...gatewayHeaders, Cookie: cookie }
    });
    const logoutCookie = logoutResponse.headers.get('set-cookie') ?? '';
    const logout = logoutResponse.status === 204
      && logoutCookie.startsWith('__Host-miraichi_owner=;')
      && logoutCookie.includes('Max-Age=0');

    const gates = {
      scrypt: primitives.scrypt === true,
      randomBytes: primitives.randomBytes === true,
      hmacSession: primitives.hmacSession === true,
      invalidLogin,
      sessionCookie,
      protectedRoute,
      refreshIsolation,
      logout
    };
    const failedGates = Object.entries(gates).filter(([, passed]) => !passed).map(([name]) => name);
    if (failedGates.length > 0) {
      throw new Error(`Edge auth smoke did not prove all gates: ${failedGates.join(', ')}`);
    }
    return {
      scope: 'auth', scrypt: true, randomBytes: true, hmacSession: true,
      invalidLogin: true, sessionCookie: true, protectedRoute: true,
      refreshIsolation: true, logout: true
    };
  }

  const response = await fetcher(`${functionUrl}/__runtime-smoke/postgres`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-miraichi-gateway-token': options.gatewayToken
    },
    body: JSON.stringify({ marker: randomUUID() })
  });
  if (!response.ok) throw new Error(`Edge postgres smoke failed with HTTP ${response.status}`);
  const result = await response.json() as Partial<EdgePostgresRuntimeSmokeResult>;
  if (result.scope !== options.scope
    || result.parameterizedQuery !== true
    || result.rollback !== true
    || result.commit !== true
    || result.cleanup !== true) {
    throw new Error('Edge postgres smoke did not prove all gates');
  }
  return result as EdgePostgresRuntimeSmokeResult;
}

function readLocalSecrets(file: string): Record<string, string> {
  if (!existsSync(file)) throw new Error(`Local Edge env file does not exist: ${file}`);
  return Object.fromEntries(readFileSync(file, 'utf8').split(/\r?\n/).flatMap((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return [];
    const separator = trimmed.indexOf('=');
    if (separator < 1) return [];
    return [[trimmed.slice(0, separator).trim(), trimmed.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')]];
  }));
}

async function main(): Promise<void> {
  const args = parseEdgeRuntimeSmokeArgs(process.argv.slice(2));
  const secrets = readLocalSecrets(path.resolve('.secrets/edge.local.env'));
  const result = await runEdgeRuntimeSmoke({
    ...args,
    functionUrl: process.env.MIRAICHI_EDGE_FUNCTION_URL
      ?? 'http://127.0.0.1:15421/functions/v1/miraichi-api',
    gatewayToken: process.env.MIRAICHI_GATEWAY_TOKEN ?? secrets.MIRAICHI_GATEWAY_TOKEN ?? '',
    ownerPassword: process.env.MIRAICHI_OWNER_PASSWORD ?? secrets.MIRAICHI_OWNER_PASSWORD,
    refreshToken: process.env.MIRAICHI_REFRESH_TOKEN ?? secrets.MIRAICHI_REFRESH_TOKEN
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
