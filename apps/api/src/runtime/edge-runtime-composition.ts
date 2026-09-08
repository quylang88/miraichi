import { createApiHandler, type ApiHandler } from '../api-router.js';
import { authorizeEdgeGateway, EDGE_GATEWAY_HEADER, readEdgeGatewayConfig } from '../auth/edge-gateway-auth.js';
import { readLiveRefreshServiceAuthConfig } from '../auth/live-refresh-service-auth.js';
import {
  createOwnerPasswordHash,
  createOwnerSessionToken,
  readOwnerAuthConfig,
  verifyOwnerPassword,
  verifyOwnerSessionToken
} from '../auth/owner-auth.js';
import { readEdgeCloudPersistenceConfig } from '../config/cloud-persistence-config.js';
import { errorResponse } from '../http/web-http.js';
import { LiveRefreshCoordinator } from '../live/live-refresh-coordinator.js';
import { SportScoreWidgetClient, type SportScoreLiveSource } from '../live/sportscore-widget-client.js';
import { CloudPersistenceUnconfiguredError, type CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
import {
  runPostgresRuntimeSmoke,
  type PostgresRuntimeSmokeResult
} from '../persistence/supabase/postgres-js-query-client.js';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import { createSupabaseCloudPersistenceAdapter } from '../persistence/supabase/supabase-cloud-persistence-adapter.js';
import { CloudMatchSnapshotRepository } from '../repositories/cloud-match-snapshot-repository.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { TerminalLiveProjectionRepository } from '../repositories/terminal-live-projection-repository.js';
import { defineApiRuntime } from './api-runtime.js';
import { createHostedProviderRoute } from '../refresh/hosted-provider-route.js';
import { HostedProviderRefresh } from '../refresh/hosted-provider-refresh.js';
import { PostgresHostedProviderStore } from '../refresh/hosted-provider-postgres-store.js';
import { postgresOwnerSessionRevocations, withRevocableOwnerSessions } from '../auth/owner-session-revocation.js';

export { createPostgresJsQueryClient } from '../persistence/supabase/postgres-js-query-client.js';

const FUNCTION_MOUNTS = [
  '/functions/v1/miraichi-api',
  '/miraichi-api'
] as const;

export type EdgeEnvironment = Readonly<Record<string, string | undefined>>;

function runtimeDiagnostic(error: unknown): string {
  if (!(error instanceof Error)) return 'unknown_error';
  return `${error.name}: ${error.message}`.slice(0, 200);
}

function createUnavailableCloudAdapter(): CloudPersistenceAdapter {
  const unavailable = async (): Promise<never> => {
    throw new CloudPersistenceUnconfiguredError();
  };
  const status = async () => ({
    provider: 'supabase-postgres' as const,
    mode: 'disabled' as const,
    state: 'unconfigured' as const,
    checkedAt: new Date().toISOString(),
    message: 'Cloud persistence is not configured.'
  });
  return new Proxy({ getStatus: status }, {
    get(target, property) {
      if (property === 'getStatus') return target.getStatus;
      return unavailable;
    }
  }) as CloudPersistenceAdapter;
}

function createUnavailableMatchRepository(): MatchSnapshotRepository {
  const unavailable = async (): Promise<never> => {
    throw new CloudPersistenceUnconfiguredError();
  };
  return {
    listMatches: unavailable,
    findById: unavailable,
    getStatus: unavailable
  };
}

export function createBootstrapEdgeApiHandler(env: EdgeEnvironment): ApiHandler {
  const adapter = createUnavailableCloudAdapter();
  const repository = createUnavailableMatchRepository();
  const unavailableLive = async (): Promise<never> => {
    throw new CloudPersistenceUnconfiguredError();
  };
  return createApiHandler(defineApiRuntime({
    ownerAuthConfig: readOwnerAuthConfig(env),
    liveRefreshServiceAuthConfig: readLiveRefreshServiceAuthConfig(env),
    cloudDependencies: {
      adapter,
      ownerProfileId: env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary'
    },
    matchRepository: repository,
    matchDetailDependencies: { repository },
    liveCoordinator: { read: unavailableLive, refresh: unavailableLive } as never,
    ...(env.MIRAICHI_PUBLIC_ORIGIN?.trim() ? { allowedOrigin: env.MIRAICHI_PUBLIC_ORIGIN.trim() } : {})
  }));
}

export function createPostgresEdgeApiHandler(
  env: EdgeEnvironment,
  client: PostgresQueryClient
): ApiHandler {
  const config = readEdgeCloudPersistenceConfig(env);
  const adapter = createSupabaseCloudPersistenceAdapter({
    client,
    ownerProfileId: config.ownerProfileId
  });
  const cloudRepository = new CloudMatchSnapshotRepository(adapter, config.ownerProfileId);
  const matchRepository = new TerminalLiveProjectionRepository(
    cloudRepository,
    adapter,
    config.ownerProfileId
  );
  const disabledLiveSource: SportScoreLiveSource = {
    listMatches: async () => { throw new Error('SportScore live widget is disabled'); },
    getMatch: async () => { throw new Error('SportScore live widget is disabled'); }
  };
  const liveMode = env.SPORTSCORE_LIVE_MODE?.trim() || 'disabled';
  if (liveMode !== 'disabled' && liveMode !== 'widget') {
    throw new Error('SPORTSCORE_LIVE_MODE must be disabled or widget');
  }
  const timeoutMs = Number(env.SPORTSCORE_WIDGET_TIMEOUT_MS?.trim() || 8_000);
  const liveCoordinator = new LiveRefreshCoordinator({
    ownerProfileId: config.ownerProfileId,
    persistence: adapter,
    repository: matchRepository,
    source: liveMode === 'widget' ? new SportScoreWidgetClient({ timeoutMs }) : disabledLiveSource
  });
  const providerRoute = createHostedProviderRoute(env.MIRAICHI_PROVIDER_REFRESH_TOKEN, () => new HostedProviderRefresh({
    store: new PostgresHostedProviderStore(client, config.ownerProfileId),
    maxCurrentRequests: Number(env.MIRAICHI_CURRENT_REFRESH_BATCH_SIZE || 3)
  }));
  const api = createApiHandler(defineApiRuntime({
    ownerAuthConfig: readOwnerAuthConfig(env),
    liveRefreshServiceAuthConfig: readLiveRefreshServiceAuthConfig(env),
    cloudDependencies: { adapter, ownerProfileId: config.ownerProfileId },
    matchRepository,
    matchDetailDependencies: { repository: matchRepository },
    liveCoordinator,
    ...(env.MIRAICHI_PUBLIC_ORIGIN?.trim() ? { allowedOrigin: env.MIRAICHI_PUBLIC_ORIGIN.trim() } : {})
  }));
  const authenticatedApi = withRevocableOwnerSessions(api, readOwnerAuthConfig(env), postgresOwnerSessionRevocations(client), env.MIRAICHI_PUBLIC_ORIGIN);
  return async (request) => await providerRoute(request) ?? authenticatedApi(request);
}

export function createEdgeRuntimeSmokeHandler(client: PostgresQueryClient): ApiHandler {
  return async (request) => {
    const url = new URL(request.url);
    if (url.pathname === '/__runtime-smoke/auth-primitives') {
      if (request.method !== 'POST') return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
      try {
        const password = 'miraichi-edge-runtime-smoke-password';
        const hash = await createOwnerPasswordHash(password);
        const parts = hash.split('$');
        const scrypt = parts.slice(0, 4).join('$') === 'scrypt-v1$16384$8$1'
          && await verifyOwnerPassword(password, hash);
        const randomBytes = parts[4]?.length === 22;
        const secret = 'miraichi-edge-runtime-smoke-session-secret';
        const now = Date.now();
        const token = createOwnerSessionToken(secret, now, 600);
        const hmacSession = verifyOwnerSessionToken(token, secret, now + 1_000);
        if (!scrypt || !randomBytes || !hmacSession) throw new Error('Auth primitive smoke failed');
        return Response.json({
          scope: 'auth-primitives', scrypt: true, randomBytes: true, hmacSession: true
        }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        return Response.json({
          error: { code: 'runtime_smoke_failed', message: 'Runtime smoke failed.' },
          diagnostic: runtimeDiagnostic(error)
        }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }
    }
    if (url.pathname !== '/__runtime-smoke/postgres') return null;
    if (request.method !== 'POST') return errorResponse(405, 'method_not_allowed', 'Method not allowed.');
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(400, 'invalid_runtime_smoke', 'Invalid runtime smoke request.');
    }
    const marker = typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>).marker
      : undefined;
    if (typeof marker !== 'string') {
      return errorResponse(400, 'invalid_runtime_smoke', 'Invalid runtime smoke request.');
    }
    try {
      const result: PostgresRuntimeSmokeResult = await runPostgresRuntimeSmoke(client, marker);
      return Response.json(result, { status: 200, headers: { 'Cache-Control': 'no-store' } });
    } catch {
      return errorResponse(500, 'runtime_smoke_failed', 'Runtime smoke failed.', {
        headers: { 'Cache-Control': 'no-store' }
      });
    }
  };
}

export const createPostgresRuntimeSmokeHandler = createEdgeRuntimeSmokeHandler;

function normalizeFunctionRequest(request: Request): Request | null {
  const url = new URL(request.url);
  const mount = FUNCTION_MOUNTS.find((candidate) => (
    url.pathname === candidate || url.pathname.startsWith(`${candidate}/`)
  ));
  if (!mount) return null;
  url.pathname = url.pathname.slice(mount.length) || '/';
  const normalized = new Request(url, request);
  normalized.headers.delete(EDGE_GATEWAY_HEADER);
  return normalized;
}

export function createEdgeRequestHandler(options: {
  readonly env: EdgeEnvironment;
  readonly createHandler?: () => ApiHandler;
  readonly createRuntimeSmokeHandler?: () => ApiHandler;
}): (request: Request) => Promise<Response> {
  const gatewayConfig = readEdgeGatewayConfig(options.env);
  let apiHandler: ApiHandler | undefined;
  let runtimeSmokeHandler: ApiHandler | undefined;
  return async (request) => {
    const denial = authorizeEdgeGateway(request, gatewayConfig);
    if (denial) return denial;

    const normalized = normalizeFunctionRequest(request);
    if (!normalized) return errorResponse(404, 'not_found', 'Not found.');

    try {
      if (new URL(normalized.url).pathname.startsWith('/__runtime-smoke/')) {
        if (options.env.APP_ENV !== 'local'
          || options.env.MIRAICHI_EDGE_RUNTIME_SMOKE !== 'enabled'
          || !options.createRuntimeSmokeHandler) {
          return errorResponse(404, 'not_found', 'Not found.');
        }
        runtimeSmokeHandler ??= options.createRuntimeSmokeHandler();
        return await runtimeSmokeHandler(normalized)
          ?? errorResponse(404, 'not_found', 'Not found.');
      }
      apiHandler ??= (options.createHandler ?? (() => createBootstrapEdgeApiHandler(options.env)))();
      return await apiHandler(normalized)
        ?? errorResponse(404, 'not_found', 'Not found.');
    } catch (error) {
      if (options.env.APP_ENV === 'local' && options.env.MIRAICHI_EDGE_RUNTIME_SMOKE === 'enabled') {
        return Response.json({
          error: { code: 'edge_runtime_error', message: 'API request failed.' },
          diagnostic: runtimeDiagnostic(error)
        }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }
      return errorResponse(500, 'edge_runtime_error', 'API request failed.', {
        headers: { 'Cache-Control': 'no-store' }
      });
    }
  };
}
