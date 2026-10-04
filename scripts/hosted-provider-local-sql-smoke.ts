import { randomUUID } from 'node:crypto';
import { createPostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';
import { createSupabaseCloudPersistenceAdapter } from '../apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.js';
import { PostgresHostedProviderStore } from '../apps/api/src/refresh/hosted-provider-postgres-store.js';
import { toCanonicalWarehouse } from '../apps/worker/src/sources/shared/hosted-canonical.js';
import { gate } from './staging-hosted-config.js';
import type { LocalMatch } from '../packages/shared/src/contracts/local-match-contracts.js';

async function main() {
  const client = createPostgresQueryClient('postgresql://postgres:postgres@127.0.0.1:15422/postgres');
  const owner = `e2e-refresh-${randomUUID()}`;
  try {
    await client.query('insert into miraichi_app.app_profile(id,label) values($1,$1)', [owner]);
    const store = new PostgresHostedProviderStore(client, owner);
    const first = await store.acquire();
    gate(first, 'first lease acquired');
    gate(await store.acquire() === null, 'concurrent lease denied');
    const row: LocalMatch = { id: `match-${owner}`, competition: { id: 'test-cup', name: 'Test Cup', type: 'national-team', season: '2026' },
      homeTeam: { id: 'test-home', name: 'Home' }, awayTeam: { id: 'test-away', name: 'Away' }, kickoffUtc: new Date().toISOString(),
      status: 'scheduled', score: { home: null, away: null }, updatedAt: new Date().toISOString(), sourceRefs: [{ sourceId: 'fotmob-unofficial', sourceMatchId: '123', importedAt: new Date().toISOString() }] };
    const snapshotId = await store.finish(first, first.state, [toCanonicalWarehouse([row])]);
    gate(snapshotId, 'atomic first publication');
    const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: owner });
    gate((await adapter.getCloudMatchSnapshotStatus(owner)).matchCount === 1, 'incremental count');
    const next = await store.acquire();
    gate(next, 'second lease');
    await client.query("update miraichi_app.provider_refresh_control set lease_expires_at=clock_timestamp()-interval '1 second' where owner_profile_id=$1", [owner]);
    let expiredRejected = false;
    try { await store.finish(next, next.state, [toCanonicalWarehouse([{ ...row, score: { home: 99, away: 99 }, status: 'completed' }])]); } catch { expiredRejected = true; }
    gate(expiredRejected, 'expired fence');
    gate((await adapter.findCloudMatchById(owner, row.id))?.status === 'scheduled', 'last-good after expired fence');
    const third = await store.acquire();
    gate(third, 'third lease');
    let rolledBack = false;
    try {
      await client.transaction(async (tx) => {
        await new PostgresHostedProviderStore(tx, owner).finish(third, third.state, [toCanonicalWarehouse([{ ...row, updatedAt: new Date(Date.now()+1000).toISOString(), status: 'completed', score: { home: 2, away: 1 } }])]);
        throw new Error('intentional rollback');
      });
    } catch { rolledBack = true; }
    gate(rolledBack && (await adapter.findCloudMatchById(owner, row.id))?.status === 'scheduled', 'transaction rollback preserves data');
    console.log(JSON.stringify({ gate: 'local-provider-sql', status: 'passed', concurrentLease: true, atomicPublication: true, expiredFence: true, rollback: true }));
  } finally {
    await client.transaction(async (tx) => {
      await tx.query('delete from miraichi_app.provider_refresh_control where owner_profile_id=$1', [owner]);
      await tx.query('delete from miraichi_app.match_snapshot where owner_profile_id=$1', [owner]);
      await tx.query('delete from miraichi_app.app_profile where id=$1', [owner]);
    });
    gate((await client.query('select id from miraichi_app.app_profile where id=$1', [owner])).rows.length === 0, 'local SQL cleanup');
  }
}
void main().then(() => process.exit(0)).catch(() => { console.error('Local provider SQL gate failed'); process.exit(1); });
