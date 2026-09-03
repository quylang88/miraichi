import { createApiHandler, type ApiHandler } from '../api-router.js';
import { authorizeEdgeGateway, EDGE_GATEWAY_HEADER, readEdgeGatewayConfig } from '../auth/edge-gateway-auth.js';
import { readLiveRefreshServiceAuthConfig } from '../auth/live-refresh-service-auth.js';
import { readOwnerAuthConfig } from '../auth/owner-auth.js';
import { errorResponse } from '../http/web-http.js';
import { CloudPersistenceUnconfiguredError, type CloudPersistenceAdapter } from '../persistence/cloud-persistence-adapter.js';
import type { MatchSnapshotRepository } from '../repositories/match-snapshot-repository.js';
import { defineApiRuntime } from './api-runtime.js';

const FUNCTION_MOUNTS = [
  '/functions/v1/miraichi-api',
  '/miraichi-api'
] as const;

export type EdgeEnvironment = Readonly<Record<string, string | undefined>>;

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
}): (request: Request) => Promise<Response> {
  const gatewayConfig = readEdgeGatewayConfig(options.env);
  let apiHandler: ApiHandler | undefined;
  return async (request) => {
    const denial = authorizeEdgeGateway(request, gatewayConfig);
    if (denial) return denial;

    const normalized = normalizeFunctionRequest(request);
    if (!normalized) return errorResponse(404, 'not_found', 'Not found.');

    try {
      apiHandler ??= (options.createHandler ?? (() => createBootstrapEdgeApiHandler(options.env)))();
      return await apiHandler(normalized)
        ?? errorResponse(404, 'not_found', 'Not found.');
    } catch {
      return errorResponse(500, 'edge_runtime_error', 'API request failed.', {
        headers: { 'Cache-Control': 'no-store' }
      });
    }
  };
}
