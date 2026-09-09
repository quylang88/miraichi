import { describe, expect, it, vi } from 'vitest';
import { createOwnerPasswordHash } from '../../apps/api/src/auth/owner-auth.js';
import {
  createEdgeRequestHandler,
  createPostgresEdgeApiHandler
} from '../../apps/api/src/runtime/edge-runtime-composition.js';
import {
  createPostgresJsQueryClient,
  type PostgresJsDriver,
  type PostgresJsResult
} from '../../apps/api/src/persistence/supabase/postgres-js-query-client.js';
import type { PostgresQueryClient } from '../../apps/api/src/persistence/supabase/postgres-query-client.js';

const gatewayToken = 'integration-gateway-token-with-at-least-32-bytes';
const sessionSecret = 'integration-session-secret-with-at-least-32-bytes';
const refreshToken = 'integration-refresh-token-with-at-least-32-bytes';
const password = 'correct horse battery staple';

const matchRow = {
  id: 'edge-match-1',
  competition_id: 'fixture-league',
  competition_name: 'Fixture League',
  competition_type: 'club',
  season: '2026-27',
  kickoff_utc: '2026-09-03T10:00:00.000Z',
  status: 'completed',
  home_team_id: 'home',
  home_team_name: 'Home',
  away_team_id: 'away',
  away_team_name: 'Away',
  home_score: 2,
  away_score: 1,
  source_refs: [{ sourceId: 'fotmob-unofficial', importedAt: '2026-09-03T12:00:00.000Z', sourceMatchId: 'private-locator' }],
  updated_at: '2026-09-03T12:00:00.000Z'
};

function fixtureClient(): { client: PostgresQueryClient; query: ReturnType<typeof vi.fn> } {
  const query = vi.fn();
  const client: PostgresQueryClient = {
    query: async <T extends Record<string, unknown>>(text: string) => {
      query(text);
      if (text.includes('select 1 as ok')) return { rows: [{ ok: 1 } as unknown as T], rowCount: 1 };
      if (text.includes('from miraichi_app.match_record') && text.includes('id=$2')) {
        return { rows: [matchRow as unknown as T], rowCount: 1 };
      }
      if (text.includes('array_agg(distinct season)')) {
        return { rows: [{
          id: 'fixture-league', name: 'Fixture League', seasons: ['2026-27'], match_count: 1
        } as unknown as T], rowCount: 1 };
      }
      if (text.includes('from miraichi_app.match_record')) {
        return { rows: [matchRow as unknown as T], rowCount: 1 };
      }
      if (text.includes('from miraichi_app.match_snapshot')) {
        return { rows: [{
          snapshot_id: 'edge-snapshot',
          generated_at: '2026-09-03T12:00:00.000Z',
          imported_at: '2026-09-03T12:00:00.000Z',
          sources: []
        } as unknown as T], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    },
    transaction: async (operation) => operation(client)
  };
  return { client, query };
}

function request(path: string, init: RequestInit = {}, token = gatewayToken): Request {
  const headers = new Headers(init.headers);
  if (token) headers.set('x-miraichi-gateway-token', token);
  return new Request(`https://project-ref.supabase.co/functions/v1/miraichi-api${path}`, {
    ...init, headers
  });
}

describe('Supabase Edge owner flow integration', () => {
  it('fails direct calls closed, preserves owner isolation, and never reaches filesystem detail', async () => {
    const { client, query } = fixtureClient();
    const passwordHash = await createOwnerPasswordHash(password);
    const env = {
      APP_ENV: 'staging',
      MIRAICHI_GATEWAY_TOKEN: gatewayToken,
      MIRAICHI_OWNER_AUTH_MODE: 'password',
      MIRAICHI_OWNER_PASSWORD_HASH: passwordHash,
      MIRAICHI_SESSION_SECRET: sessionSecret,
      MIRAICHI_REFRESH_TOKEN: refreshToken,
      MIRAICHI_PUBLIC_ORIGIN: 'https://miraichi-stage.workers.dev',
      MIRAICHI_OWNER_PROFILE_ID: 'owner-primary',
      SPORTSCORE_LIVE_MODE: 'disabled',
      SUPABASE_DB_URL: 'postgresql://postgres:secret@db:5432/postgres'
    };
    const createHandler = vi.fn(() => createPostgresEdgeApiHandler(env, client));
    const edge = createEdgeRequestHandler({ env, createHandler });

    const direct = await edge(request('/api/v1/health', {}, ''));
    expect(direct.status).toBe(401);
    expect(createHandler).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();

    const wrong = await edge(request('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong password value' })
    }));
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toEqual({ error: { code: 'invalid_credentials', message: 'Invalid credentials.' } });

    const login = await edge(request('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    }));
    const setCookie = login.headers.get('set-cookie')!;
    const cookie = setCookie.split(';')[0]!;
    expect(login.status).toBe(204);
    expect(setCookie).toContain('HttpOnly; Secure; SameSite=Strict');

    const status = await edge(request('/api/v1/cloud-persistence/status', {
      headers: { Cookie: cookie }
    }));
    expect(status.status).toBe(200);
    await expect(status.json()).resolves.toMatchObject({ state: 'ready' });

    const refreshCannotRead = await edge(request('/api/v1/cloud-persistence/status', {
      headers: { Authorization: `Bearer ${refreshToken}` }
    }));
    expect(refreshCannotRead.status).toBe(401);

    const matches = await edge(request('/api/v1/matches', { headers: { Cookie: cookie } }));
    expect(matches.status).toBe(200);
    const matchesBody = await matches.text();
    expect(JSON.parse(matchesBody).matches[0]).toMatchObject({ id: 'edge-match-1', score: { home: 2, away: 1 } });
    expect(matchesBody).not.toContain('private-locator');

    const detail = await edge(request('/api/v1/matches/detail?id=edge-match-1', {
      headers: { Cookie: cookie }
    }));
    expect(detail.status).toBe(200);
    const detailBody=await detail.text();
    expect(JSON.parse(detailBody)).toMatchObject({match:{id:'edge-match-1'},refresh:{outcome:'unavailable',lastSuccessAt:null}});
    expect(detailBody).not.toMatch(/private-locator|sourceMatchId|sourceUrl/);
  });

  it('rolls a failed postgres.js transaction back through the shared contract', async () => {
    const persisted: string[] = [];
    const rootUnsafe = vi.fn(async () => Object.assign([], { count: 0 }) as PostgresJsResult<Record<string, unknown>>);
    const driver: PostgresJsDriver = {
      unsafe: rootUnsafe,
      begin: async (operation) => {
        const pending: string[] = [];
        const transactionDriver = {
          unsafe: async <T extends Record<string, unknown>>(_text: string, values: readonly unknown[] = []) => {
            pending.push(String(values[0]));
            return Object.assign([], { count: 1 }) as PostgresJsResult<T>;
          }
        };
        try {
          const result = await operation(transactionDriver);
          persisted.push(...pending);
          return result;
        } catch (error) {
          throw error;
        }
      }
    };
    const client = createPostgresJsQueryClient(driver);
    await expect(client.transaction(async (transaction) => {
      await transaction.query('insert into smoke(marker) values ($1)', ['must-rollback']);
      throw new Error('forced integration rollback');
    })).rejects.toThrow('forced integration rollback');
    expect(persisted).toEqual([]);
    expect(rootUnsafe).not.toHaveBeenCalled();
  });
});
