import type { CloudPersistenceConfig } from '../config/cloud-persistence-config.js';
import { CloudPersistenceUnconfiguredError, type CloudPersistenceAdapter } from './cloud-persistence-adapter.js';
import { createMemoryCloudPersistenceAdapter } from './memory-cloud-persistence-adapter.js';
import { createPostgresQueryClient } from './supabase/postgres-query-client.js';
import { createSupabaseCloudPersistenceAdapter } from './supabase/supabase-cloud-persistence-adapter.js';

export function createCloudPersistenceAdapter(config: CloudPersistenceConfig): CloudPersistenceAdapter {
  if (config.mode === 'memory') return createMemoryCloudPersistenceAdapter();
  if (config.mode === 'supabase') {
    if (!config.databaseUrl) throw new Error('SUPABASE_DATABASE_URL is required');
    return createSupabaseCloudPersistenceAdapter({ client: createPostgresQueryClient(config.databaseUrl), ownerProfileId: config.ownerProfileId });
  }
  const unavailable = async (): Promise<never> => { throw new CloudPersistenceUnconfiguredError(); };
  return {
    getStatus: async () => ({
      provider: 'supabase-postgres', mode: 'disabled', state: 'unconfigured',
      checkedAt: new Date().toISOString(), message: 'Cloud persistence is not configured.'
    }),
    saveBetDraft: unavailable, listBetDrafts: unavailable, deleteBetDraft: unavailable,
    createBetRecord: unavailable, listBetRecords: unavailable, updateBetRecord: unavailable,
    getDisciplineConfig: unavailable, upsertDisciplineConfig: unavailable,
    createDisciplineChallenge: unavailable, findDisciplineChallenge: unavailable,
    consumeDisciplineChallenge: unavailable, applyBetSettlement: unavailable,
    listBetSettlementEvents: unavailable,
    createBankrollAccount: unavailable, listBankrollAccounts: unavailable,
    updateBankrollAccount: unavailable, createBankrollLedgerEntry: unavailable,
    listBankrollLedgerEntries: unavailable, createBankrollTransfer: unavailable, upsertMatchSnapshot: unavailable,
    listCloudMatches: unavailable, findCloudMatchById: unavailable,
    getCloudMatchSnapshotStatus: unavailable, exportOwnerData: unavailable,
    importOwnerData: unavailable, recordBackupExport: unavailable, listBackupExports: unavailable
  };
}
