import type { Buffer } from 'node:buffer';
import type { ReleaseEnvironment, ReleaseTarget } from '../../packages/config/src/release-targets.js';
import {
  verifyCloudBackupEnvelopeV3,
  type CloudBackupEnvelopeV3,
  type CloudBackupRecordCounts
} from '../../packages/shared/src/contracts/index.js';
import type { CloudPersistenceAdapter } from '../../apps/api/src/persistence/cloud-persistence-adapter.js';
import { decryptOwnerBackup, encryptOwnerBackup } from './owner-backup-crypto.js';
import type { OwnerBackupStore } from './r2-owner-backup-store.js';

export interface OwnerBackupKey {
  readonly keyId: string;
  readonly material: Buffer;
}

export interface BackupReceipt {
  readonly receiptId: string;
  readonly objectKey: string;
  readonly environment: ReleaseEnvironment;
  readonly ownerProfileId: string;
  readonly schemaVersion: 'miraichi.cloud-backup.v3';
  readonly exportedAt: string;
  readonly payloadSha256: string;
  readonly ciphertextSha256: string;
  readonly storedBytes: number;
  readonly recordCounts: CloudBackupRecordCounts;
}

export interface BackupVerificationReport {
  readonly objectKey: string;
  readonly environment: ReleaseEnvironment;
  readonly ownerProfileId: string;
  readonly schemaVersion: 'miraichi.cloud-backup.v3';
  readonly exportedAt: string;
  readonly payloadSha256: string;
  readonly ciphertextSha256: string;
  readonly storedBytes: number;
}

export interface RestoreReport {
  readonly ownerProfileId: string;
  readonly schemaVersion: 'miraichi.cloud-backup.v3';
  readonly payloadSha256: string;
  readonly recordCounts: CloudBackupRecordCounts;
  readonly relationshipsVerified: true;
  readonly excludedCollections: {
    readonly matches: 0;
    readonly liveSnapshots: 0;
    readonly liveRefreshStates: 0;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Owner backup contains non-JSON data');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([name, nested]) => `${JSON.stringify(name)}:${canonicalJson(nested)}`).join(',')}}`;
  }
  throw new Error('Owner backup contains non-JSON data');
}

function isEmptyCounts(counts: CloudBackupRecordCounts): boolean {
  return Object.values(counts).every((count) => count === 0);
}

async function assertProviderCollectionsEmpty(adapter: CloudPersistenceAdapter, ownerProfileId: string): Promise<void> {
  const [feed, liveSnapshot, liveRefresh] = await Promise.all([
    adapter.listCloudMatches(ownerProfileId, {}),
    adapter.getLiveMatchSnapshot(ownerProfileId),
    adapter.getLiveRefreshState(ownerProfileId)
  ]);
  if (feed.matches.length !== 0 || feed.snapshot.matchCount !== 0 || feed.snapshot.freshness !== 'missing'
    || liveSnapshot !== null || liveRefresh !== null) {
    throw new Error('Disposable restore target contains match or provider state');
  }
}

export async function createAndVerifyOwnerBackup(input: {
  readonly adapter: CloudPersistenceAdapter;
  readonly store: OwnerBackupStore;
  readonly key: OwnerBackupKey;
  readonly target: ReleaseTarget;
  readonly ownerProfileId: string;
  readonly now: () => Date;
}): Promise<BackupReceipt> {
  const exportedAt = input.now().toISOString();
  const exported = await input.adapter.exportOwnerData(input.ownerProfileId, exportedAt);
  if (exported.schemaVersion !== 'miraichi.cloud-backup.v3'
    || exported.ownerProfileId !== input.ownerProfileId
    || !await verifyCloudBackupEnvelopeV3(exported)) {
    throw new Error('Owner backup export verification failed');
  }
  const encrypted = encryptOwnerBackup({
    backup: exported,
    environment: input.target.environment,
    keyId: input.key.keyId
  }, input.key.material);
  const stored = await input.store.put(encrypted);
  const readback = await input.store.get(stored.key);
  const decrypted = decryptOwnerBackup(readback, input.key.material);
  if (!await verifyCloudBackupEnvelopeV3(decrypted)
    || canonicalJson(decrypted) !== canonicalJson(exported)
    || stored.ciphertextSha256 !== encrypted.ciphertextSha256
    || stored.metadata.environment !== input.target.environment
    || stored.metadata.ownerProfileId !== input.ownerProfileId) {
    throw new Error('Owner backup readback verification failed');
  }
  const receiptId = `backup-${encrypted.ciphertextSha256.slice(0, 24)}`;
  const receipt: BackupReceipt = {
    receiptId,
    objectKey: stored.key,
    environment: input.target.environment,
    ownerProfileId: input.ownerProfileId,
    schemaVersion: exported.schemaVersion,
    exportedAt,
    payloadSha256: exported.payloadSha256,
    ciphertextSha256: encrypted.ciphertextSha256,
    storedBytes: stored.size,
    recordCounts: exported.recordCounts
  };
  if (exported.recordCounts.ownerProfiles === 1) {
    await input.adapter.recordBackupExport({
      exportId: receiptId,
      ownerProfileId: input.ownerProfileId,
      schemaVersion: exported.schemaVersion,
      exportedAt,
      sha256: exported.payloadSha256,
      recordCounts: exported.recordCounts
    });
  }
  return receipt;
}

export async function verifyLatestOwnerBackup(input: {
  readonly store: OwnerBackupStore;
  readonly key: OwnerBackupKey;
  readonly environment: ReleaseEnvironment;
  readonly ownerProfileId: string;
}): Promise<BackupVerificationReport> {
  const objects = await input.store.list();
  const latest = [...objects].sort((left, right) =>
    Date.parse(right.uploadedAt) - Date.parse(left.uploadedAt) || left.key.localeCompare(right.key))[0];
  if (!latest) throw new Error('No owner backup object is available');
  const encrypted = await input.store.get(latest.key);
  if (encrypted.keyId !== input.key.keyId) throw new Error('Owner backup key identifier mismatch');
  const envelope = decryptOwnerBackup(encrypted, input.key.material);
  if (!await verifyCloudBackupEnvelopeV3(envelope)
    || envelope.ownerProfileId !== input.ownerProfileId
    || encrypted.authenticatedMetadata.environment !== input.environment
    || latest.metadata.environment !== input.environment
    || latest.metadata.ownerProfileId !== input.ownerProfileId
    || latest.ciphertextSha256 !== encrypted.ciphertextSha256) {
    throw new Error('Latest owner backup verification failed');
  }
  return {
    objectKey: latest.key,
    environment: input.environment,
    ownerProfileId: input.ownerProfileId,
    schemaVersion: envelope.schemaVersion,
    exportedAt: envelope.exportedAt,
    payloadSha256: envelope.payloadSha256,
    ciphertextSha256: encrypted.ciphertextSha256,
    storedBytes: latest.size
  };
}

export async function restoreOwnerBackupToDisposableDatabase(input: {
  readonly envelope: CloudBackupEnvelopeV3;
  readonly adapter: CloudPersistenceAdapter;
  readonly expectedOwner: string;
}): Promise<RestoreReport> {
  if (input.envelope.ownerProfileId !== input.expectedOwner) {
    throw new Error('Owner backup restore owner mismatch');
  }
  if (!await verifyCloudBackupEnvelopeV3(input.envelope)) {
    throw new Error('Owner backup restore envelope is invalid');
  }
  const before = await input.adapter.exportOwnerData(input.expectedOwner, input.envelope.exportedAt);
  if (before.schemaVersion !== 'miraichi.cloud-backup.v3'
    || !await verifyCloudBackupEnvelopeV3(before)
    || !isEmptyCounts(before.recordCounts)) {
    throw new Error('Disposable restore target is not empty');
  }
  await assertProviderCollectionsEmpty(input.adapter, input.expectedOwner);
  await input.adapter.importOwnerData(input.expectedOwner, input.envelope);
  const restored = await input.adapter.exportOwnerData(input.expectedOwner, input.envelope.exportedAt);
  if (restored.schemaVersion !== 'miraichi.cloud-backup.v3'
    || !await verifyCloudBackupEnvelopeV3(restored)
    || canonicalJson(restored) !== canonicalJson(input.envelope)) {
    throw new Error('Owner backup restore verification failed');
  }
  await assertProviderCollectionsEmpty(input.adapter, input.expectedOwner);
  return {
    ownerProfileId: input.expectedOwner,
    schemaVersion: restored.schemaVersion,
    payloadSha256: restored.payloadSha256,
    recordCounts: restored.recordCounts,
    relationshipsVerified: true,
    excludedCollections: { matches: 0, liveSnapshots: 0, liveRefreshStates: 0 }
  };
}
