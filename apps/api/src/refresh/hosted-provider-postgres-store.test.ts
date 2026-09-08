import { describe, expect, it, vi } from 'vitest';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import type { ProviderLease } from './hosted-provider-store.js';
import { createSupabaseCloudPersistenceAdapter, upsertMatchBatch } from '../persistence/supabase/supabase-cloud-persistence-adapter.js';

const lease: ProviderLease = { id: 'lease-a', revision: 3, startedAt: '2026-09-09T12:00:00.000Z',
  state: { current: {}, dates: {}, matches: {}, circuits: {} } };

describe('Postgres provider publication fence', () => {
  it('updates rescheduled kickoff while guarding older observations and completed results at SQL boundary', async () => {
    let observedSql = '';
    const client: PostgresQueryClient = { query: async (sql) => { observedSql = sql; return { rows: [], rowCount: 0 }; }, transaction: async (run) => run(client) };
    await upsertMatchBatch(client, 'owner-primary', 'snapshot', []);
    expect(observedSql).toContain('kickoff_utc=excluded.kickoff_utc');
    expect(observedSql).toContain('match_record.updated_at <= excluded.updated_at');
    expect(observedSql).toContain("match_record.status <> 'completed' or excluded.status = 'completed'");
  });
  it('counts the whole current serving table after an incremental publication', async () => {
    const client: PostgresQueryClient = { query: async (sql) => {
      if (sql.includes('array_agg(distinct season)')) return { rows: (sql.includes('snapshot_id = $2') ? [] : [{ id: 'cup', name: 'Cup', seasons: ['2026'], match_count: 7 }]) as never[], rowCount: 1 };
      return { rows: [{ snapshot_id: 'incremental', generated_at: lease.startedAt, imported_at: lease.startedAt, sources: [] }] as never[], rowCount: 1 };
    }, transaction: async (run) => run(client) };
    const status = await createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' }).getCloudMatchSnapshotStatus('owner-primary');
    expect(status.matchCount).toBe(7);
  });
  it('rejects an expired or replaced lease before writing a checkpoint or snapshot', async () => {
    const module = await import('./hosted-provider-postgres-store.js').catch(() => null);
    expect(module?.PostgresHostedProviderStore).toBeTypeOf('function');
    if (!module) return;
    const query = vi.fn(async (_sql: string) => ({ rows: [], rowCount: 0 }));
    const client: PostgresQueryClient = { query: query as PostgresQueryClient['query'], transaction: async (run) => run(client) };
    const store = new module.PostgresHostedProviderStore(client, 'owner-primary');
    await expect(store.finish(lease, lease.state, [])).rejects.toThrow('lease');
    expect(query).toHaveBeenCalledTimes(1);
    const sql = query.mock.calls[0]?.[0] as unknown as string;
    expect(sql).toContain('revision');
    expect(sql).toContain('lease_expires_at > clock_timestamp()');
    expect(sql).toContain('for update');
  });
  it('uses one durable shared lease for both current and terminal refresh', async () => {
    const module = await import('./hosted-provider-postgres-store.js').catch(() => null);
    expect(module?.PostgresHostedProviderStore).toBeTypeOf('function');
    if (!module) return;
    const query = vi.fn(async (_sql: string) => ({ rows: [], rowCount: 0 }));
    const client: PostgresQueryClient = { query: query as PostgresQueryClient['query'], transaction: async (run) => run(client) };
    expect(await new module.PostgresHostedProviderStore(client, 'owner-primary').acquire()).toBeNull();
    const sql = query.mock.calls[0]?.[0] as unknown as string;
    expect(sql).toContain('on conflict (owner_profile_id)');
    expect(sql).toContain('lease_expires_at <= clock_timestamp()');
  });
});
