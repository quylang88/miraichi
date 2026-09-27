import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { getReleaseTarget } from '../../packages/config/src/release-targets.js';
import { createCloudBackupEnvelopeV3 } from '../../packages/shared/src/contracts/index.js';
import type { CloudPersistenceAdapter } from '../../apps/api/src/persistence/cloud-persistence-adapter.js';
import { createMemoryCloudPersistenceAdapter } from '../../apps/api/src/persistence/memory-cloud-persistence-adapter.js';
import type { EncryptedOwnerBackupV1 } from './owner-backup-crypto.js';
import { parseBackupKey } from './owner-backup-crypto.js';
import type { OwnerBackupStore, StoredBackupObject } from './r2-owner-backup-store.js';
import {
  createAndVerifyOwnerBackup,
  restoreOwnerBackupToDisposableDatabase,
  verifyLatestOwnerBackup
} from './owner-backup-runtime.js';

const now = '2026-09-27T12:00:00.000Z';
const ownerProfile = {
  ownerProfileId: 'owner-primary', label: 'Quy', settings: { locale: 'vi' },
  createdAt: '2026-07-02T00:00:00.000Z', updatedAt: now
};
const encryptionKey = {
  keyId: 'owner-backup-2026-01',
  material: parseBackupKey(Buffer.alloc(32, 4).toString('base64'))
};

async function completeBackup() {
  return createCloudBackupEnvelopeV3({
    exportedAt: now, ownerProfileId: 'owner-primary', ownerProfile,
    drafts: [{
      draftId: 'draft-001', matchGroupId: 'match-group-001', homeTeamName: 'A', awayTeamName: 'B',
      marketType: '1X2', selectionLabel: 'A', oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10,
      createdAt: now, updatedAt: now
    }],
    bets: [{
      betId: 'bet-001', ownerProfileId: 'owner-primary', matchGroupId: 'match-group-001',
      homeTeamName: 'A', awayTeamName: 'B', marketType: '1X2', selectionLabel: 'A',
      oddsFormat: 'HK', oddsValue: 0.9, stakePoints: 10, status: 'settled',
      bankrollAccountId: 'account-001', createdAt: now, updatedAt: now
    }],
    bankrollAccounts: [{
      accountId: 'account-001', ownerProfileId: 'owner-primary', label: 'Main', unit: 'points',
      openingBalancePoints: 100, currentBalancePoints: 109, archived: false,
      createdAt: now, updatedAt: now
    }],
    bankrollLedgerEntries: [{
      entryId: 'entry-001', ownerProfileId: 'owner-primary', accountId: 'account-001',
      entryType: 'bet_settlement', amountPoints: 9, betId: 'bet-001', settlementEventId: 'event-001',
      effectiveAt: now, occurredAt: now, createdAt: now
    }],
    disciplineConfigs: [{
      ownerProfileId: 'owner-primary', dailyStopLossPoints: -10, weeklyStopLossPoints: -30,
      bigBetThresholdPoints: 20, timeZone: 'Asia/Tokyo', weekStartDay: 'monday',
      cooldownSeconds: 15, version: 1, updatedAt: now
    }],
    settlementEvents: [{
      settlementEventId: 'event-001', ownerProfileId: 'owner-primary', betId: 'bet-001',
      bankrollAccountId: 'account-001', settlementType: 'full_win',
      calculatedProfitLossPoints: 9, ledgerDeltaPoints: 9, effectiveAt: now, occurredAt: now
    }]
  });
}

function inMemoryStore(order: string[]): OwnerBackupStore & { encrypted?: EncryptedOwnerBackupV1; stored?: StoredBackupObject } {
  const store: OwnerBackupStore & { encrypted?: EncryptedOwnerBackupV1; stored?: StoredBackupObject } = {
    list: async () => store.stored ? [store.stored] : [],
    put: async (envelope) => {
      order.push('put');
      store.encrypted = envelope;
      store.stored = {
        key: `owner-backups/production/owner-primary/${envelope.ciphertextSha256}.json`,
        size: 1000, uploadedAt: now, ciphertextSha256: envelope.ciphertextSha256,
        metadata: {
          environment: 'production', ownerProfileId: 'owner-primary', exportedAt: now,
          backupSchemaVersion: 'miraichi.cloud-backup.v3', keyId: envelope.keyId,
          plaintextSha256: envelope.authenticatedMetadata.plaintextSha256,
          ciphertextSha256: envelope.ciphertextSha256
        }
      };
      return store.stored;
    },
    head: async () => { throw new Error('not used'); },
    get: async () => {
      order.push('get');
      if (!store.encrypted) throw new Error('missing');
      return store.encrypted;
    },
    delete: async () => { throw new Error('not used'); }
  };
  return store;
}

describe('owner backup runtime', () => {
  it('records a receipt only after export, verified upload, readback, and decrypt', async () => {
    const order: string[] = [];
    const base = createMemoryCloudPersistenceAdapter({ ownerProfile });
    const receipts: unknown[] = [];
    const adapter: CloudPersistenceAdapter = {
      ...base,
      exportOwnerData: async (owner, exportedAt) => {
        order.push('export');
        return base.exportOwnerData(owner, exportedAt);
      },
      recordBackupExport: async (receipt) => {
        order.push('record');
        receipts.push(receipt);
      }
    };
    const store = inMemoryStore(order);

    const receipt = await createAndVerifyOwnerBackup({
      adapter, store, key: encryptionKey, target: getReleaseTarget('production'),
      ownerProfileId: 'owner-primary', now: () => new Date(now)
    });

    expect(order).toEqual(['export', 'put', 'get', 'record']);
    expect(receipt).toMatchObject({
      environment: 'production', ownerProfileId: 'owner-primary',
      schemaVersion: 'miraichi.cloud-backup.v3', exportedAt: now,
      payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      ciphertextSha256: expect.stringMatching(/^[a-f0-9]{64}$/u),
      recordCounts: { ownerProfiles: 1 }
    });
    expect(receipts).toHaveLength(1);
  });

  it('performs no later remote mutation after export or upload failure', async () => {
    const base = createMemoryCloudPersistenceAdapter({ ownerProfile });
    let puts = 0;
    let records = 0;
    const store = inMemoryStore([]);
    store.put = async () => { puts += 1; throw new Error('upload failed'); };
    const adapter: CloudPersistenceAdapter = {
      ...base,
      recordBackupExport: async () => { records += 1; }
    };
    await expect(createAndVerifyOwnerBackup({
      adapter: { ...adapter, exportOwnerData: async () => { throw new Error('export failed'); } },
      store, key: encryptionKey, target: getReleaseTarget('production'),
      ownerProfileId: 'owner-primary', now: () => new Date(now)
    })).rejects.toThrow('export failed');
    expect({ puts, records }).toEqual({ puts: 0, records: 0 });

    await expect(createAndVerifyOwnerBackup({
      adapter, store, key: encryptionKey, target: getReleaseTarget('production'),
      ownerProfileId: 'owner-primary', now: () => new Date(now)
    })).rejects.toThrow('upload failed');
    expect({ puts, records }).toEqual({ puts: 1, records: 0 });
  });

  it('backs up a clean production database without inventing an owner row for a receipt', async () => {
    const base = createMemoryCloudPersistenceAdapter();
    let databaseReceipts = 0;
    const adapter: CloudPersistenceAdapter = {
      ...base,
      recordBackupExport: async () => { databaseReceipts += 1; }
    };
    const receipt = await createAndVerifyOwnerBackup({
      adapter, store: inMemoryStore([]), key: encryptionKey,
      target: getReleaseTarget('production'), ownerProfileId: 'owner-primary',
      now: () => new Date(now)
    });
    expect(receipt.recordCounts.ownerProfiles).toBe(0);
    expect(databaseReceipts).toBe(0);
    const stillEmpty = await base.exportOwnerData('owner-primary', now);
    expect(stillEmpty.schemaVersion).toBe('miraichi.cloud-backup.v3');
    if (stillEmpty.schemaVersion !== 'miraichi.cloud-backup.v3') throw new Error('V3 expected');
    expect(stillEmpty.ownerProfile).toBeNull();
  });

  it('binds verification to the encrypted artifact key identifier', async () => {
    const base = createMemoryCloudPersistenceAdapter({ ownerProfile });
    const store = inMemoryStore([]);
    await createAndVerifyOwnerBackup({
      adapter: base, store, key: encryptionKey, target: getReleaseTarget('production'),
      ownerProfileId: 'owner-primary', now: () => new Date(now)
    });
    await expect(verifyLatestOwnerBackup({
      store,
      key: { ...encryptionKey, keyId: 'wrong-key-id' },
      environment: 'production', ownerProfileId: 'owner-primary'
    })).rejects.toThrow('key identifier mismatch');
    await expect(verifyLatestOwnerBackup({
      store, key: encryptionKey, environment: 'production', ownerProfileId: 'owner-primary'
    })).resolves.toMatchObject({
      environment: 'production', ownerProfileId: 'owner-primary',
      ciphertextSha256: store.encrypted?.ciphertextSha256
    });
  });

  it('restores every durable relationship into an empty disposable database and keeps provider data empty', async () => {
    const envelope = await completeBackup();
    const target = createMemoryCloudPersistenceAdapter();
    const report = await restoreOwnerBackupToDisposableDatabase({
      envelope, adapter: target, expectedOwner: 'owner-primary'
    });

    expect(report).toMatchObject({
      ownerProfileId: 'owner-primary', relationshipsVerified: true,
      recordCounts: envelope.recordCounts,
      excludedCollections: { matches: 0, liveSnapshots: 0, liveRefreshStates: 0 }
    });
    const restored = await target.exportOwnerData('owner-primary', now);
    expect(restored).toMatchObject({
      ownerProfile: envelope.ownerProfile, drafts: envelope.drafts, bets: envelope.bets,
      bankrollAccounts: envelope.bankrollAccounts,
      bankrollLedgerEntries: envelope.bankrollLedgerEntries,
      disciplineConfigs: envelope.disciplineConfigs, settlementEvents: envelope.settlementEvents
    });
  });

  it('rejects the wrong owner before touching the target and leaves a failed import target unchanged', async () => {
    const envelope = await completeBackup();
    let targetTouches = 0;
    const untouched = new Proxy({} as CloudPersistenceAdapter, {
      get: () => { targetTouches += 1; throw new Error('target touched'); }
    });
    await expect(restoreOwnerBackupToDisposableDatabase({
      envelope, adapter: untouched, expectedOwner: 'other-owner'
    })).rejects.toThrow('owner mismatch');
    expect(targetTouches).toBe(0);

    const base = createMemoryCloudPersistenceAdapter();
    const before = await base.exportOwnerData('owner-primary', now);
    const failing: CloudPersistenceAdapter = {
      ...base,
      importOwnerData: async () => { throw new Error('transaction rolled back'); }
    };
    await expect(restoreOwnerBackupToDisposableDatabase({
      envelope, adapter: failing, expectedOwner: 'owner-primary'
    })).rejects.toThrow('transaction rolled back');
    const after = await base.exportOwnerData('owner-primary', now);
    expect(after).toEqual(before);
  });

  it('rejects an empty provider snapshot instead of treating zero matches as zero provider state', async () => {
    const envelope = await completeBackup();
    const target = createMemoryCloudPersistenceAdapter();
    await target.upsertMatchSnapshot('owner-primary', {
      snapshotId: 'provider-snapshot', generatedAt: now, importedAt: now,
      sources: [], matches: []
    });
    await expect(restoreOwnerBackupToDisposableDatabase({
      envelope, adapter: target, expectedOwner: 'owner-primary'
    })).rejects.toThrow('match or provider state');
  });
});
