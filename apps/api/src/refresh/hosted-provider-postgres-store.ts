import { randomUUID } from 'node:crypto';
import type { LocalMatch } from '@miraichi/shared';
import type { CanonicalWarehouseSnapshot } from '../../../../scripts/providers/shared/canonical-warehouse.js';
import { fromCanonicalWarehouse, mergeCanonicalWarehouseSnapshots, toCanonicalWarehouse } from '../../../worker/src/sources/shared/hosted-canonical.js';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import { postgresJson } from '../persistence/supabase/postgres-parameters.js';
import { mapCloudMatchRow, upsertMatchBatch } from '../persistence/supabase/supabase-cloud-persistence-adapter.js';
import type { HostedProviderStore, ProviderLease, ProviderState } from './hosted-provider-store.js';

export class PostgresHostedProviderStore implements HostedProviderStore {
  constructor(private readonly client: PostgresQueryClient, private readonly owner: string) {}

  async acquire(): Promise<ProviderLease | null> {
    const id = randomUUID();
    const result = await this.client.query(`insert into miraichi_app.provider_refresh_control
      (owner_profile_id, lease_id, lease_expires_at) values ($1,$2,clock_timestamp()+interval '120 seconds')
      on conflict (owner_profile_id) do update set lease_id=excluded.lease_id,
      lease_expires_at=excluded.lease_expires_at
      where miraichi_app.provider_refresh_control.lease_expires_at is null
        or miraichi_app.provider_refresh_control.lease_expires_at <= clock_timestamp()
      returning revision, state_json, clock_timestamp() as started_at`, [this.owner, id]);
    const row = result.rows[0];
    if (!row) return null;
    const startedAt = row.started_at instanceof Date ? row.started_at.toISOString() : String(row.started_at);
    return { id, startedAt, revision: Number(row.revision), state: row.state_json as ProviderState };
  }

  async readMatches(scope: { competitionIds?: readonly string[]; dueAt?: string }): Promise<LocalMatch[]> {
    return this.read(this.client, scope);
  }

  private async read(client: PostgresQueryClient, scope: { competitionIds?: readonly string[]; dueAt?: string }): Promise<LocalMatch[]> {
    if (scope.dueAt) {
      const result = await client.query(`select * from miraichi_app.match_record where owner_profile_id=$1
        and status='scheduled' and kickoff_utc > $2::timestamptz-interval '4 hours'
        and kickoff_utc <= $2::timestamptz-interval '105 minutes' order by kickoff_utc limit 2000`, [this.owner, scope.dueAt]);
      return result.rows.map(mapCloudMatchRow);
    }
    if (!scope.competitionIds?.length) return [];
    const result = await client.query(`select * from miraichi_app.match_record where owner_profile_id=$1
      and competition_id = any($2::text[]) order by id for update`, [this.owner, scope.competitionIds]);
    return result.rows.map(mapCloudMatchRow);
  }

  async finish(lease: ProviderLease, state: ProviderState, deltas: readonly CanonicalWarehouseSnapshot[]): Promise<string | null> {
    return this.client.transaction(async (tx) => {
      const fenced = await tx.query(`select revision from miraichi_app.provider_refresh_control
        where owner_profile_id=$1 and lease_id=$2 and revision=$3
          and lease_expires_at > clock_timestamp() for update`, [this.owner, lease.id, lease.revision]);
      if (!fenced.rows.length) throw new Error('Provider publication lease expired or replaced');
      let snapshotId: string | null = null;
      if (deltas.some((delta) => delta.matches.length)) {
        const competitionIds = [...new Set(deltas.flatMap((delta) => delta.matches.map((match) => match.competitionId)))];
        const original = await this.read(tx, { competitionIds });
        const before = new Map(original.map((match) => [match.id, match]));
        let candidate = toCanonicalWarehouse(original);
        for (const delta of deltas) candidate = mergeCanonicalWarehouseSnapshots(candidate, delta);
        const changed = fromCanonicalWarehouse(candidate).flatMap((match) => {
          const old = before.get(match.id);
          if (old && old.updatedAt === match.updatedAt) return [];
          // Keep any prior source URL/import metadata that the canonical adapter does not own.
          const refs = new Map((old?.sourceRefs ?? []).map((ref) => [`${ref.sourceId}|${ref.sourceMatchId ?? ''}`, ref]));
          for (const ref of match.sourceRefs) {
            const key = `${ref.sourceId}|${ref.sourceMatchId ?? ''}`;
            refs.set(key, { ...refs.get(key), ...ref });
          }
          return [{ ...match, sourceRefs: [...refs.values()] }];
        });
        if (changed.length) {
          snapshotId = `hosted-${lease.id}`;
          await tx.query(`insert into miraichi_app.match_snapshot (snapshot_id,owner_profile_id,generated_at,imported_at,sources)
            select $2,$1,$3,$3,coalesce((select sources from miraichi_app.match_snapshot
              where owner_profile_id=$1 order by imported_at desc limit 1),'[]'::jsonb)`, [this.owner, snapshotId, lease.startedAt]);
          for (let offset = 0; offset < changed.length; offset += 500) {
            await upsertMatchBatch(tx, this.owner, snapshotId, changed.slice(offset, offset + 500));
          }
        }
      }
      const finished = await tx.query(`update miraichi_app.provider_refresh_control set state_json=$4,
        revision=revision+1,lease_id=null,lease_expires_at=null,last_completed_at=clock_timestamp()
        where owner_profile_id=$1 and lease_id=$2 and revision=$3
          and lease_expires_at > clock_timestamp() returning revision`, [this.owner, lease.id, lease.revision, postgresJson(state)]);
      if (!finished.rows.length) throw new Error('Provider publication lease expired during transaction');
      return snapshotId;
    });
  }
}
