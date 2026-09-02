import { describe, expect, it } from 'vitest';
import type { CloudMatchSnapshot } from '@miraichi/shared/src/contracts/index.js';
import { liveSnapshotFixture } from '../../../../../tests/fixtures/live-match-snapshot.js';
import type { PostgresQueryClient } from './postgres-query-client.js';
import { createSupabaseCloudPersistenceAdapter } from './supabase-cloud-persistence-adapter.js';

class FakeClient implements PostgresQueryClient {
  readonly calls: Array<{ text: string; values: readonly unknown[] }> = [];
  readonly queuedRows: Array<Record<string, unknown>[]> = [];
  transactions = 0;
  enqueueRows(...rows: Array<Record<string, unknown>[]>): void {
    this.queuedRows.push(...rows);
  }
  async query<T extends Record<string, unknown>>(text: string, values: readonly unknown[] = []) {
    this.calls.push({ text, values });
    return { rows: (this.queuedRows.shift() ?? []) as T[], rowCount: 1 };
  }
  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactions += 1;
    return operation(this);
  }
}

function enqueueSnapshotStatusRows(client: FakeClient): void {
  client.enqueueRows(
    [{ snapshot_id: 'snapshot-001', generated_at: '2026-07-01T00:00:00.000Z', imported_at: '2026-07-01T00:01:00.000Z', sources: [] }],
    []
  );
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

  it('persists pre-bet plan adherence on drafts and ongoing records', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-09-01T00:00:00.000Z' });
    await adapter.saveBetDraft('owner-primary', { draftId: 'd', matchGroupId: 'm', marketType: '1X2', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, preBetPlanAdherence: 'partly', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
    await adapter.createBetRecord({ betId: 'b', ownerProfileId: 'owner-primary', matchGroupId: 'm', homeTeamName: 'A', awayTeamName: 'B', marketType: '1X2', selectionLabel: 'A', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'pending', preBetPlanAdherence: 'yes', createdAt: '2026-09-01T00:00:00.000Z', updatedAt: '2026-09-01T00:00:00.000Z' });
    const writes = client.calls.filter((call) => call.text.includes('insert into miraichi_app.bet_'));
    expect(writes).toHaveLength(2);
    expect(writes.every((call) => call.text.includes('pre_bet_plan_adherence'))).toBe(true);
    expect(writes[0]?.values).toContain('partly');
    expect(writes[1]?.values).toContain('yes');
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

  it('rejects invalid capital signs before starting a database transaction', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await expect(adapter.createBankrollAccount({ accountId: 'zero', ownerProfileId: 'owner-primary', label: 'Main', openingBalancePoints: 0 })).rejects.toThrow('positive');
    await expect(adapter.createBankrollLedgerEntry({ entryId: 'bad', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'withdrawal', amountPoints: 1, occurredAt: '2026-07-02T00:00:00.000Z' })).rejects.toThrow('sign');
    expect(client.transactions).toBe(0);
    expect(client.calls).toHaveLength(0);
  });

  it('guards withdrawal and transfer updates against negative realized balances', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.createBankrollLedgerEntry({ entryId: 'withdraw', ownerProfileId: 'owner-primary', accountId: 'a', entryType: 'withdrawal', amountPoints: -10, occurredAt: '2026-07-02T00:00:00.000Z' });
    client.enqueueRows([{}], [{}], [{ account_id: 'a', owner_profile_id: 'owner-primary', label: 'A', opening_balance_points: 10, current_balance_points: 0, archived: false, created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z' }], [{ account_id: 'b', owner_profile_id: 'owner-primary', label: 'B', opening_balance_points: 10, current_balance_points: 20, archived: false, created_at: '2026-07-02T00:00:00.000Z', updated_at: '2026-07-02T00:00:00.000Z' }]);
    await adapter.createBankrollTransfer({ transferId: 'transfer', ownerProfileId: 'owner-primary', fromAccountId: 'a', toAccountId: 'b', amountPoints: 10, occurredAt: '2026-07-02T00:00:00.000Z' });
    const balanceUpdates = client.calls.filter((call) => call.text.includes('current_balance_points'));
    expect(balanceUpdates.some((call) => call.text.includes('current_balance_points+$3>=0'))).toBe(true);
    expect(balanceUpdates.some((call) => call.text.includes('current_balance_points>=$3'))).toBe(true);
  });

  it('exports the canonical V2 backup collections', async () => {
    const client = new FakeClient();
    client.enqueueRows([], [], [], [], [], []);
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const envelope = await adapter.exportOwnerData('owner-primary', '2026-08-21T00:00:00.000Z');
    expect(envelope).toMatchObject({ schemaVersion: 'miraichi.cloud-backup.v2', disciplineConfigs: [], settlementEvents: [] });
    expect(client.calls.some((call) => call.text.includes('discipline_config'))).toBe(true);
    expect(client.calls.some((call) => call.text.includes('bet_settlement_event'))).toBe(true);
  });

  it('upserts discipline config including week_start_day', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary', now: () => '2026-07-02T00:00:00.000Z' });
    client.enqueueRows([{
      owner_profile_id: 'owner-primary',
      daily_stop_loss_points: null,
      weekly_stop_loss_points: 200,
      big_bet_threshold_points: 50,
      time_zone: 'Asia/Tokyo',
      week_start_day: 'sunday',
      cooldown_seconds: 15,
      version: 1,
      updated_at: '2026-07-02T00:00:00.000Z'
    }]);
    const config = {
      ownerProfileId: 'owner-primary',
      dailyStopLossPoints: null,
      weeklyStopLossPoints: 200,
      bigBetThresholdPoints: 50,
      timeZone: 'Asia/Tokyo',
      weekStartDay: 'sunday' as const,
      cooldownSeconds: 15 as const,
      version: 1,
      updatedAt: '2026-07-02T00:00:00.000Z'
    };
    const result = await adapter.upsertDisciplineConfig(config);
    expect(result.weekStartDay).toBe('sunday');
    const call = client.calls.find((c) => c.text.includes('miraichi_app.discipline_config'));
    expect(call?.text).toContain('week_start_day');
    expect(call?.values[5]).toBe('sunday');
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
        competition: { id: 'fixture-cup', name: 'Fixture Cup', type: 'club', season: '2026' },
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
    const rows = JSON.parse(String(matchCall?.values[2])) as Array<Record<string, unknown>>;
    expect(matchCall?.text).toContain('$3::jsonb');
    expect(rows[0]?.competition_type).toBe('club');
    expect(rows[0]?.source_refs).toEqual(snapshot.matches[0]!.sourceRefs);
  });

  it('upserts large match snapshots in bounded batches inside one transaction', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    const matches = Array.from({ length: 1_201 }, (_, index) => ({
      id: `match-${index}`,
      competition: { id: 'fixture-cup', name: 'Fixture Cup', type: 'club' as const, season: '2026' },
      kickoffUtc: '2026-06-11T19:00:00.000Z',
      status: 'scheduled' as const,
      homeTeam: { id: `home-${index}`, name: `Home ${index}` },
      awayTeam: { id: `away-${index}`, name: `Away ${index}` },
      score: { home: null, away: null },
      sourceRefs: [],
      updatedAt: '2026-07-02T00:00:00.000Z'
    }));

    await adapter.upsertMatchSnapshot('owner-primary', {
      snapshotId: 'large-snapshot', generatedAt: '2026-07-02T00:00:00.000Z',
      importedAt: '2026-07-02T00:01:00.000Z', sources: [], matches
    });

    const batches = client.calls.filter((call) => call.text.includes('miraichi_app.match_record'));
    expect(client.transactions).toBe(1);
    expect(batches).toHaveLength(3);
    expect(batches.map((call) => (JSON.parse(String(call.values[2])) as unknown[]).length)).toEqual([500, 500, 201]);
  });

  it('reads the canonical club competition type from persisted match rows', async () => {
    const client = new FakeClient();
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    client.enqueueRows(
      [{
        id: 'match-001', competition_id: 'fixture-cup', competition_name: 'Fixture Cup', competition_type: 'club', season: '2026',
        kickoff_utc: '2026-06-11T19:00:00.000Z', status: 'scheduled', home_team_id: 'team-a', home_team_name: 'Team A',
        away_team_id: 'team-b', away_team_name: 'Team B', home_score: null, away_score: null, source_refs: [], updated_at: '2026-07-02T00:00:00.000Z'
      }],
      [{ snapshot_id: 'snapshot-001', generated_at: '2026-07-02T00:00:00.000Z', imported_at: '2026-07-02T00:01:00.000Z', sources: [] }],
      [{ id: 'fixture-cup', name: 'Fixture Cup', seasons: ['2026'], match_count: 1 }]
    );

    const result = await adapter.listCloudMatches('owner-primary', {});

    expect(result.matches[0]?.competition.type).toBe('club');
  });

  it('keeps cloud snapshot status fresh through exactly twelve hours and stale after', async () => {
    const boundaryClient = new FakeClient();
    enqueueSnapshotStatusRows(boundaryClient);
    const boundaryAdapter = createSupabaseCloudPersistenceAdapter({
      client: boundaryClient,
      ownerProfileId: 'owner-primary',
      now: () => '2026-07-01T12:00:00.000Z'
    });
    const afterClient = new FakeClient();
    enqueueSnapshotStatusRows(afterClient);
    const afterAdapter = createSupabaseCloudPersistenceAdapter({
      client: afterClient,
      ownerProfileId: 'owner-primary',
      now: () => '2026-07-01T12:00:00.001Z'
    });

    expect((await boundaryAdapter.getCloudMatchSnapshotStatus('owner-primary')).freshness).toBe('fresh');
    expect((await afterAdapter.getCloudMatchSnapshotStatus('owner-primary')).freshness).toBe('stale');
  });

  it('uses one conditional owner-scoped write to acquire a live refresh lease', async () => {
    const client = new FakeClient();
    client.enqueueRows([{ owner_profile_id: 'owner-primary' }], []);
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    expect(await adapter.acquireLiveRefreshLease('owner-primary', {
      leaseId: 'lease-1', reason: 'visible', acquiredAt: '2026-09-02T12:00:00.000Z', expiresAt: '2026-09-02T12:02:00.000Z'
    })).toBe(true);
    expect(await adapter.acquireLiveRefreshLease('owner-primary', {
      leaseId: 'lease-2', reason: 'hourly', acquiredAt: '2026-09-02T12:01:00.000Z', expiresAt: '2026-09-02T12:03:00.000Z'
    })).toBe(false);
    const acquireSql = client.calls[0]?.text.toLowerCase() ?? '';
    expect(acquireSql).toContain('on conflict (owner_profile_id) do update');
    expect(acquireSql).toContain('lease_expires_at <= excluded.last_attempt_at');
    expect(client.calls[0]?.values).toEqual([
      'owner-primary', 'lease-1', 'visible', '2026-09-02T12:00:00.000Z', '2026-09-02T12:02:00.000Z'
    ]);
  });

  it('maps live JSONB and completes a successful refresh in one transaction', async () => {
    const client = new FakeClient();
    client.enqueueRows(
      [{ owner_profile_id: 'owner-primary', status: 'succeeded', reason: 'visible', last_attempt_at: '2026-09-02T12:00:00.000Z', last_success_at: '2026-09-02T12:00:05.000Z', last_completed_at: '2026-09-02T12:00:05.000Z', last_error_code: null, lease_id: null, lease_acquired_at: null, lease_expires_at: null }],
      [],
      [{ overlay_json: liveSnapshotFixture }]
    );
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.finishLiveRefresh('owner-primary', {
      leaseId: 'lease-1', outcome: 'succeeded', completedAt: '2026-09-02T12:00:05.000Z', snapshot: liveSnapshotFixture
    });
    expect(client.transactions).toBe(1);
    expect(client.calls.some((call) => call.text.includes('live_match_snapshot'))).toBe(true);
    expect(await adapter.getLiveMatchSnapshot('owner-primary')).toEqual(liveSnapshotFixture);
  });

  it('sanitizes a failed refresh and never writes the last-good live snapshot table', async () => {
    const client = new FakeClient();
    client.enqueueRows([{ owner_profile_id: 'owner-primary', status: 'failed' }]);
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: 'owner-primary' });
    await adapter.finishLiveRefresh('owner-primary', {
      leaseId: 'lease-1', outcome: 'failed', completedAt: '2026-09-02T12:00:05.000Z', errorCode: 'database password leaked' as never
    });
    expect(client.calls[0]?.values).toContain('internal_error');
    expect(client.calls[0]?.text).toContain('lease_expires_at > $4');
    expect(client.calls.every((call) => !call.text.includes('live_match_snapshot'))).toBe(true);
  });
});
