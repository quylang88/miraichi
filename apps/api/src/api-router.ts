import type { IncomingMessage, ServerResponse } from 'node:http';
import { enforceOwnerSession, handleOwnerAuthRoute, isOwnerAuthRoute } from './auth/owner-auth-boundary.js';
import { isAuthorizedHourlyLiveRefresh } from './auth/live-refresh-service-auth.js';
import { enforceOriginBoundary } from './http-origin-boundary.js';
import { errorResponse } from './http/web-http.js';
import type { ApiRuntime } from './runtime/api-runtime.js';
import { handleBackups } from './routes/backups.js';
import { handleBankroll } from './routes/bankroll.js';
import { handleBetDrafts } from './routes/bet-drafts.js';
import { handleBetReports } from './routes/bet-reports.js';
import { handleBetSettlements } from './routes/bet-settlements.js';
import { handleBets } from './routes/bets.js';
import { handleCloudPersistenceStatus } from './routes/cloud-persistence-status.js';
import { handleDataSnapshotStatus } from './routes/data-snapshot-status.js';
import { handleDiscipline } from './routes/discipline.js';
import { handleHealth } from './routes/health.js';
import { handleIngestionStatus } from './routes/ingestion-status.mock.js';
import { handleLiveMatches } from './routes/live-matches.js';
import { handleMatchDetail } from './routes/match-detail.js';
import { handleMatches } from './routes/matches.js';

type HeaderValue = string | number | readonly string[];

class WebRequestFacade implements AsyncIterable<Uint8Array> {
  readonly method: string;
  readonly url: string;
  readonly headers: Record<string, string>;

  constructor(private readonly request: Request) {
    const url = new URL(request.url);
    this.method = request.method;
    this.url = `${url.pathname}${url.search}`;
    this.headers = Object.fromEntries(request.headers.entries());
    this.headers.host ??= url.host;
    this.headers['x-forwarded-proto'] ??= url.protocol.slice(0, -1);
  }

  async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
    if (!this.request.body) return;
    const reader = this.request.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  }
}

class WebResponseFacade {
  private readonly headers = new Map<string, { name: string; value: HeaderValue }>();
  private status = 200;
  private body: BodyInit | null = null;

  setHeader(name: string, value: HeaderValue): void {
    this.headers.set(name.toLowerCase(), { name, value });
  }

  writeHead(status: number, headers?: Record<string, HeaderValue>): this {
    this.status = status;
    for (const [name, value] of Object.entries(headers ?? {})) this.setHeader(name, value);
    return this;
  }

  end(body?: unknown): void {
    if (body === undefined || body === null) this.body = null;
    else if (typeof body === 'string') this.body = body;
    else if (body instanceof Uint8Array) this.body = body.slice().buffer as ArrayBuffer;
    else this.body = String(body);
  }

  toResponse(): Response {
    const headers = new Headers();
    for (const { name, value } of this.headers.values()) {
      if (Array.isArray(value)) {
        for (const entry of value) headers.append(name, entry);
      } else {
        headers.set(name, String(value));
      }
    }
    const body = this.status === 204 || this.status === 304 ? null : this.body;
    return new Response(body, { status: this.status, headers });
  }
}

export type ApiHandler = (request: Request) => Promise<Response | null>;

export function createApiHandler(runtime: ApiRuntime): ApiHandler {
  return async (request) => {
    const url = new URL(request.url);
    const pathname = url.pathname;
    if (pathname !== '/api' && !pathname.startsWith('/api/')) return null;

    const req = new WebRequestFacade(request) as unknown as IncomingMessage;
    const response = new WebResponseFacade();
    const res = response as unknown as ServerResponse;

    if (enforceOriginBoundary(req, res, runtime.allowedOrigin) === 'handled') {
      return response.toResponse();
    }

    if (isOwnerAuthRoute(pathname)) {
      await handleOwnerAuthRoute(req, res, runtime.ownerAuthConfig, runtime.now?.());
      return response.toResponse();
    }

    if (!isAuthorizedHourlyLiveRefresh(req, runtime.liveRefreshServiceAuthConfig)
      && enforceOwnerSession(req, res, runtime.ownerAuthConfig, runtime.now?.()) === 'handled') {
      return response.toResponse();
    }

    if (pathname === '/api/v1/health') {
      handleHealth(req, res);
    } else if (pathname === '/api/v1/live' || pathname === '/api/v1/live/refresh') {
      await handleLiveMatches(req, res, { coordinator: runtime.liveCoordinator });
    } else if (pathname === '/api/v1/matches/detail') {
      await handleMatchDetail(req, res, runtime.matchDetailDependencies);
    } else if (pathname === '/api/v1/data-snapshot/status') {
      await handleDataSnapshotStatus(req, res, { repository: runtime.matchRepository });
    } else if (pathname === '/api/v1/matches') {
      await handleMatches(req, res, { repository: runtime.matchRepository });
    } else if (/^\/api\/v1\/bets\/[^/]+\/settlements$/.test(pathname)) {
      await handleBetSettlements(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/bets') {
      await handleBets(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/discipline-config' || pathname === '/api/v1/discipline-challenges') {
      await handleDiscipline(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/bet-reports') {
      await handleBetReports(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/bet-drafts') {
      await handleBetDrafts(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/cloud-persistence/status') {
      await handleCloudPersistenceStatus(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/bankroll/setup' || pathname === '/api/v1/bankroll/accounts'
      || pathname === '/api/v1/bankroll/ledger' || pathname === '/api/v1/bankroll/summary'
      || pathname === '/api/v1/bankroll/transfers') {
      await handleBankroll(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/backups/export' || pathname === '/api/v1/backups/import'
      || pathname === '/api/v1/backups/log') {
      await handleBackups(req, res, runtime.cloudDependencies);
    } else if (pathname === '/api/v1/ingestion/status') {
      handleIngestionStatus(req, res);
    } else {
      return errorResponse(404, 'not_found', `Not found: ${pathname}`);
    }

    return response.toResponse();
  };
}
