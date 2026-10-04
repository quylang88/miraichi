import { createHash, timingSafeEqual } from 'node:crypto';
import type { ApiHandler } from '../api-router.js';
import type { HostedProviderRefresh } from './hosted-provider-refresh.js';

export function createHostedProviderRoute(token: string | undefined, create: () => Pick<HostedProviderRefresh, 'run'>): ApiHandler {
  if (token && new TextEncoder().encode(token).length < 32) throw new Error('Provider refresh token must be at least 32 bytes');
  return async (request) => {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/internal/providers/')) return null;
    const headers = { 'Cache-Control': 'no-store' };
    const supplied = request.headers.get('authorization') ?? '';
    if (!token || !timingSafeEqual(createHash('sha256').update(supplied).digest(), createHash('sha256').update(`Bearer ${token}`).digest())) {
      return Response.json({ error: { code: 'provider_auth_required' } }, { status: 401, headers });
    }
    if (request.method !== 'POST') return Response.json({ error: { code: 'method_not_allowed' } }, { status: 405, headers });
    const match = /^\/api\/internal\/providers\/(current|terminal)\/refresh$/u.exec(url.pathname);
    if (!match || url.search) return Response.json({ error: { code: 'not_found' } }, { status: 404, headers });
    try {
      const result = await create().run(match[1] as 'current' | 'terminal');
      return Response.json(result, { status: result.outcome === 'failed' ? 503 : 200, headers });
    } catch {
      return Response.json({ error: { code: 'provider_refresh_failed' } }, { status: 503, headers });
    }
  };
}
