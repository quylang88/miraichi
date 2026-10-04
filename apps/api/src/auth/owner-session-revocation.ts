import { createHash } from 'node:crypto';
import type { ApiHandler } from '../api-router.js';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import { OWNER_SESSION_COOKIE, serializeExpiredOwnerSessionCookie, verifyOwnerSessionToken, type OwnerAuthConfig } from './owner-auth.js';

interface Revocations {
  isRevoked(hash: string): Promise<boolean>;
  revoke(hash: string, expiresAt: string): Promise<void>;
}

export function postgresOwnerSessionRevocations(client: PostgresQueryClient): Revocations {
  return {
    async isRevoked(hash) {
      return (await client.query('select token_hash from miraichi_app.owner_session_revocation where token_hash=$1 and expires_at>clock_timestamp()', [hash])).rows.length > 0;
    },
    async revoke(hash, expiresAt) {
      await client.transaction(async (tx) => {
        await tx.query('delete from miraichi_app.owner_session_revocation where expires_at<=clock_timestamp()');
        await tx.query('insert into miraichi_app.owner_session_revocation(token_hash,expires_at) values($1,$2) on conflict(token_hash) do nothing', [hash, expiresAt]);
      });
    }
  };
}

export function withRevocableOwnerSessions(handler: ApiHandler, config: OwnerAuthConfig, store: Revocations, publicOrigin?: string): ApiHandler {
  return async (request) => {
    const url = new URL(request.url);
    if (config.mode !== 'password' || url.pathname === '/api/v1/health' || url.pathname === '/api/v1/auth/login') return handler(request);
    const cookies = (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim()).filter((part) => part.startsWith(`${OWNER_SESSION_COOKIE}=`));
    const token = cookies.length === 1 ? cookies[0].slice(OWNER_SESSION_COOKIE.length + 1) : '';
    if (!token || !verifyOwnerSessionToken(token, config.sessionSecret!)) return handler(request);
    const hash = createHash('sha256').update(token).digest('hex');
    if (url.pathname === '/api/v1/auth/logout' && request.method === 'POST') {
      // Same-origin enforcement remains mandatory before changing persistent session state.
      if (request.headers.has('origin') && request.headers.get('origin') !== (publicOrigin ?? url.origin)) return new Response(null, { status: 403 });
      await store.revoke(hash, new Date(Date.now() + config.sessionTtlSeconds * 1000).toISOString());
    } else if (await store.isRevoked(hash)) {
      const session = url.pathname === '/api/v1/auth/session';
      return Response.json(session ? { authenticated: false } : { error: { code: 'authentication_required' } }, {
        status: session ? 200 : 401,
        headers: { 'Cache-Control': 'no-store', 'Set-Cookie': serializeExpiredOwnerSessionCookie() }
      });
    }
    return handler(request);
  };
}
