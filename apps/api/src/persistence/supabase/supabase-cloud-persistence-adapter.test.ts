import { describe, expect, it } from 'vitest';
import type { CloudMatchSnapshot } from '@miraichi/shared/src/contracts/index.js';
import type { PostgresQueryClient } from './postgres-query-client.js';
import { createSupabaseCloudPersistenceAdapter } from './supabase-cloud-persistence-adapter.js';

class FakeClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];
  transactions = 0;
  async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
    this.calls.push({ text, values });
    return { rows: [] as T[], rowCount: 1 };
  }
  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return operation(this);
  }
}

describe('supabase cloud persistence adapter', () => {
  it('uses parameterized owner-scoped bet queries', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    await adapter.listBetRecords('owner-primary');
    expect(client.calls[0]?.text).toContain('$1');
    expect(client.calls[0]?.text).not.toContain('owner-primary');
    expect(client.calls[0]?.values).toEqual(['owner-primary']);
  });

  it('rejects owner mismatch before querying', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await expect(adapter.listBetRecords('other-owner')).rejects.toThrow('Owner profile mismatch');
    expect(client.calls).toHaveLength(0);
  });

  it('reconciles ledger entries inside one transaction', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    await adapter.createBankrollLedgerEntry({ entryId: 'entry-1', ownerProfileId: 'owner-primary', accountId: 'account-1', entryType: 'deposit', amountPoints: 100, occurredAt: '2026-07-02T00:00:00.000Z' });
    expect(client.transactions).toBe(1);
    expect(client.calls).toHaveLength(2);
    expect(client.calls.every((call) => call.text.includes('$1'))).toBe(true);
  });

  it('does not leak credentials when connectivity fails', async () => {
    const client: PostgresQueryClient = {
      query: async () => { throw new Error('postgresql://secret@db.example'); },
      transaction: async () => { throw new Error('unused'); }
    };
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    await expect(adapter.getStatus()).resolves.toEqual({ provider: 'supabase-postgres', mode: 'supabase', state: 'unavailable', checkedAt: '2026-07-02T00:00:00.000Z', message: 'Cloud database is unavailable.' });
  });

  it('serializes JSONB values before sending them to pg', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const snapshot: CloudMatchSnapshot = {
      snapshotId: 'snapshot-001',
      generatedAt: '2026-07-02T00:00:00.000Z',
      importedAt: '2026-07-02T00:01:00.000Z',
      sources: [{ sourceId: 'manual-snapshot', importedAt: '2026-07-02T00:00:00.000Z' }],
      matches: [{
        id: 'match-001',
        competition: { id: 'fixture-cup', name: 'Fixture Cup', type: 'national-team', season: '2026' },
        kickoffUtc: '2026-06-11T19:00:00.000Z',
        status: 'scheduled',
        homeTeam: { id: 'team-a', name: 'Team A' },
        awayTeam: { id: 'team-b', name: 'Team B' },
        score: { home: null, away: null },
        sourceRefs: [{ sourceId: 'manual-snapshot', sourceMatchId: 'fixture-001', importedAt: '2026-07-02T00:00:00.000Z' }],
        updatedAt: '2026-07-02T00:00:00.000Z'
      }]
    };

    await adapter.upsertMatchSnapshot('owner-primary', snapshot);

    const snapshotCall = client.calls.find((call) => call.text.includes('miraichi_app.match_snapshot'));
    const matchCall = client.calls.find((call) => call.text.includes('miraichi_app.match_record'));
    expect(snapshotCall?.values[4]).toBe(JSON.stringify(snapshot.sources));
    expect(matchCall?.values[20]).toBe(JSON.stringify(snapshot.matches[0]!.sourceRefs));
  });
});
