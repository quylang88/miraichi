import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createCloudBackupEnvelopeV3 } from '../../packages/shared/src/contracts/index.js';
import { encryptOwnerBackup, parseBackupKey, type EncryptedOwnerBackupV1 } from './owner-backup-crypto.js';
import {
  createR2OwnerBackupStore,
  OWNER_BACKUP_OBJECT_BYTE_CEILING,
  OWNER_BACKUP_OBJECT_COUNT_CEILING,
  planBackupRetention,
  type OwnerBackupS3Client,
  type StoredBackupObject
} from './r2-owner-backup-store.js';

interface FakeObject {
  body: Buffer;
  size: number;
  metadata: Record<string, string>;
  lastModified: Date;
}

class FakeS3Client {
  readonly calls: Array<{ name: string; input: Record<string, unknown> }> = [];
  readonly objects = new Map<string, FakeObject>();
  failPut = false;
  corruptReadback = false;
  truncatedListing = false;

  async send(command: Parameters<OwnerBackupS3Client['send']>[0]): Promise<unknown> {
    const name = command.constructor.name;
    const input = command.input as unknown as Record<string, unknown>;
    this.calls.push({ name, input });
    if (name === 'ListObjectsV2Command') {
      const prefix = String(input.Prefix);
      return {
        Contents: [...this.objects.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([Key, value]) => ({ Key, Size: value.size, LastModified: value.lastModified })),
        IsTruncated: this.truncatedListing,
        ...(this.truncatedListing ? { NextContinuationToken: 'more' } : {})
      };
    }
    const key = String(input.Key);
    if (name === 'PutObjectCommand') {
      if (this.failPut) throw new Error('provider leaked credential: should-not-escape');
      const body = Buffer.from(input.Body as Uint8Array);
      this.objects.set(key, {
        body, size: body.byteLength,
        metadata: { ...(input.Metadata as Record<string, string>) },
        lastModified: new Date(String((input.Metadata as Record<string, string>)['uploaded-at']))
      });
      return {};
    }
    const stored = this.objects.get(key);
    if (!stored) throw new Error('not found');
    if (name === 'HeadObjectCommand') {
      return { ContentLength: stored.size, LastModified: stored.lastModified, Metadata: stored.metadata };
    }
    if (name === 'GetObjectCommand') {
      const body = this.corruptReadback
        ? Buffer.concat([stored.body, Buffer.from('x')])
        : stored.body;
      return { Body: { transformToByteArray: async () => body } };
    }
    if (name === 'DeleteObjectCommand') {
      this.objects.delete(key);
      return {};
    }
    throw new Error(`unsupported fake command: ${name}`);
  }
}

const key = parseBackupKey(Buffer.alloc(32, 3).toString('base64'));
const now = new Date('2026-09-27T12:00:00.000Z');

async function encryptedBackup(): Promise<EncryptedOwnerBackupV1> {
  const backup = await createCloudBackupEnvelopeV3({
    exportedAt: now.toISOString(), ownerProfileId: 'owner-primary',
    ownerProfile: {
      ownerProfileId: 'owner-primary', label: 'Quy', settings: {},
      createdAt: '2026-07-02T00:00:00.000Z', updatedAt: now.toISOString()
    },
    drafts: [], bets: [], bankrollAccounts: [], bankrollLedgerEntries: [],
    disciplineConfigs: [], settlementEvents: []
  });
  return encryptOwnerBackup({
    backup, environment: 'production', keyId: 'owner-backup-2026-01'
  }, key);
}

function config(client: FakeS3Client) {
  return {
    endpoint: 'https://account.r2.cloudflarestorage.com', region: 'auto', bucket: 'miraichi-private',
    accessKeyId: 'test-access', secretAccessKey: 'test-secret',
    environment: 'production' as const, ownerProfileId: 'owner-primary', client,
    now: () => now
  };
}

function retainedObject(keyName: string, uploadedAt: string, size = 10): StoredBackupObject {
  return {
    key: keyName, size, uploadedAt, ciphertextSha256: 'a'.repeat(64),
    metadata: {
      environment: 'production', ownerProfileId: 'owner-primary', exportedAt: uploadedAt,
      backupSchemaVersion: 'miraichi.cloud-backup.v3', keyId: 'key-1',
      plaintextSha256: 'b'.repeat(64), ciphertextSha256: 'a'.repeat(64)
    }
  };
}

describe('R2 owner backup store', () => {
  it('accepts only the official HTTPS R2 S3 endpoint with region auto', () => {
    const client = new FakeS3Client();
    expect(() => createR2OwnerBackupStore({
      ...config(client), endpoint: 'https://credential-sink.example'
    })).toThrow('configuration is invalid');
    expect(() => createR2OwnerBackupStore({
      ...config(client), region: 'ap-southeast-1'
    })).toThrow('configuration is invalid');
  });

  it('disables automatic SDK retries for the real R2 client', () => {
    let captured: Record<string, unknown> | undefined;
    const { client: injectedClient, ...withoutInjectedClient } = config(new FakeS3Client());
    void injectedClient;
    createR2OwnerBackupStore({
      ...withoutInjectedClient,
      clientFactory: (options) => {
        captured = options as unknown as Record<string, unknown>;
        return new FakeS3Client();
      }
    });

    expect(captured).toMatchObject({ maxAttempts: 1 });
  });

  it('uploads privately, verifies HEAD/readback, and makes an identical retry idempotent', async () => {
    const client = new FakeS3Client();
    const store = createR2OwnerBackupStore(config(client));
    const encrypted = await encryptedBackup();
    const stored = await store.put(encrypted);

    expect(stored.key).toMatch(/^owner-backups\/production\/owner-primary\/2026\/09\/27\/.*-[a-f0-9]{64}\.json$/u);
    const put = client.calls.find((call) => call.name === 'PutObjectCommand');
    expect(put?.input).toMatchObject({ Bucket: 'miraichi-private', Key: stored.key, ContentType: 'application/json' });
    expect(put?.input).not.toHaveProperty('ACL');
    expect(client.calls.map((call) => call.name)).toEqual(expect.arrayContaining([
      'ListObjectsV2Command', 'PutObjectCommand', 'HeadObjectCommand', 'GetObjectCommand'
    ]));
    await expect(store.get(stored.key)).resolves.toEqual(encrypted);

    const putCount = client.calls.filter((call) => call.name === 'PutObjectCommand').length;
    await expect(store.put(encrypted)).resolves.toEqual(stored);
    expect(client.calls.filter((call) => call.name === 'PutObjectCommand')).toHaveLength(putCount);
  });

  it('keeps the latest 30 UTC days and 12 UTC months deterministically', () => {
    const objects: StoredBackupObject[] = [];
    for (let day = 0; day < 45; day += 1) {
      const date = new Date(now.getTime() - day * 86_400_000);
      objects.push(retainedObject(`daily-${day}`, date.toISOString()));
      if (day === 0) objects.push(retainedObject('older-same-day', new Date(date.getTime() - 60_000).toISOString()));
    }
    for (let month = 2; month < 15; month += 1) {
      objects.push(retainedObject(`monthly-${month}`, new Date(Date.UTC(2026, 8 - month, 1, 12)).toISOString()));
    }

    const plan = planBackupRetention(objects, now);
    expect(plan.keep.filter((item) => item.key.startsWith('daily-')).map((item) => item.key))
      .toEqual(expect.arrayContaining(Array.from({ length: 30 }, (_, index) => `daily-${index}`)));
    expect(plan.remove.map((item) => item.key)).toContain('older-same-day');
    expect(new Set(plan.keep.map((item) => item.uploadedAt.slice(0, 7))).size).toBeLessThanOrEqual(12);
    expect(plan.projectedBytes).toBe(plan.keep.reduce((sum, item) => sum + item.size, 0));
  });

  it('refuses the 1 GB ceiling before PUT and never deletes retention candidates after a failed PUT', async () => {
    const encrypted = await encryptedBackup();

    const fullClient = new FakeS3Client();
    const fullStore = createR2OwnerBackupStore(config(fullClient));
    const prefix = 'owner-backups/production/owner-primary/';
    fullClient.objects.set(`${prefix}2026/09/26/existing-${'a'.repeat(64)}.json`, {
      body: Buffer.from('{}'), size: 1_000_000_000, lastModified: new Date('2026-09-26T12:00:00.000Z'),
      metadata: {
        environment: 'production', 'owner-profile-id': 'owner-primary',
        'exported-at': '2026-09-26T12:00:00.000Z', 'backup-schema-version': 'miraichi.cloud-backup.v3',
        'key-id': 'key-1', 'plaintext-sha256': 'b'.repeat(64),
        'ciphertext-sha256': 'a'.repeat(64), 'uploaded-at': '2026-09-26T12:00:00.000Z'
      }
    });
    await expect(fullStore.put(encrypted)).rejects.toThrow('1 GB');
    expect(fullClient.calls.some((call) => call.name === 'PutObjectCommand')).toBe(false);

    const failingClient = new FakeS3Client();
    const failingStore = createR2OwnerBackupStore(config(failingClient));
    const oldKey = `${prefix}2020/01/01/old-${'c'.repeat(64)}.json`;
    failingClient.objects.set(oldKey, {
      body: Buffer.from('{}'), size: 2, lastModified: new Date('2020-01-01T00:00:00.000Z'),
      metadata: {
        environment: 'production', 'owner-profile-id': 'owner-primary',
        'exported-at': '2020-01-01T00:00:00.000Z', 'backup-schema-version': 'miraichi.cloud-backup.v3',
        'key-id': 'key-1', 'plaintext-sha256': 'd'.repeat(64),
        'ciphertext-sha256': 'c'.repeat(64), 'uploaded-at': '2020-01-01T00:00:00.000Z'
      }
    });
    failingClient.failPut = true;
    await expect(failingStore.put(encrypted)).rejects.toThrowError(/^Owner backup storage operation failed$/u);
    expect(failingClient.objects.has(oldKey)).toBe(true);
    expect(failingClient.calls.some((call) => call.name === 'DeleteObjectCommand')).toBe(false);
  });

  it('rejects an oversized single backup before any R2 request', async () => {
    const client = new FakeS3Client();
    const store = createR2OwnerBackupStore(config(client));
    const encrypted = await encryptedBackup();
    const ciphertext = Buffer.alloc(OWNER_BACKUP_OBJECT_BYTE_CEILING, 7);
    const oversized: EncryptedOwnerBackupV1 = {
      ...encrypted,
      ciphertextBase64: ciphertext.toString('base64'),
      ciphertextSha256: createHash('sha256').update(ciphertext).digest('hex')
    };

    await expect(store.put(oversized)).rejects.toThrow('single-object safety ceiling');
    expect(client.calls).toHaveLength(0);
  });

  it('fails closed when the bounded prefix contains too many objects', async () => {
    const client = new FakeS3Client();
    const prefix = 'owner-backups/production/owner-primary/';
    for (let index = 0; index <= OWNER_BACKUP_OBJECT_COUNT_CEILING; index += 1) {
      client.objects.set(`${prefix}${index}-${'a'.repeat(64)}.json`, {
        body: Buffer.from('{}'), size: 2, lastModified: now, metadata: {}
      });
    }
    client.truncatedListing = true;
    const store = createR2OwnerBackupStore(config(client));

    await expect(store.list()).rejects.toThrow('object-count safety ceiling');
    expect(client.calls.map((call) => call.name)).toEqual(['ListObjectsV2Command']);
    expect(client.calls[0]?.input.MaxKeys).toBe(OWNER_BACKUP_OBJECT_COUNT_CEILING + 1);
  });

  it('refuses a new PUT when the prefix is already at the object-count ceiling', async () => {
    const client = new FakeS3Client();
    const prefix = 'owner-backups/production/owner-primary/';
    for (let index = 0; index < OWNER_BACKUP_OBJECT_COUNT_CEILING; index += 1) {
      client.objects.set(`${prefix}${index}-${'a'.repeat(64)}.json`, {
        body: Buffer.from('{}'), size: 2, lastModified: now,
        metadata: {
          environment: 'production', 'owner-profile-id': 'owner-primary',
          'exported-at': now.toISOString(), 'backup-schema-version': 'miraichi.cloud-backup.v3',
          'key-id': 'key-1', 'plaintext-sha256': 'b'.repeat(64),
          'ciphertext-sha256': 'a'.repeat(64), 'uploaded-at': now.toISOString()
        }
      });
    }
    const store = createR2OwnerBackupStore(config(client));

    await expect(store.put(await encryptedBackup())).rejects.toThrow('object-count safety ceiling');
    expect(client.calls.some((call) => call.name === 'PutObjectCommand')).toBe(false);
    expect(client.objects).toHaveLength(OWNER_BACKUP_OBJECT_COUNT_CEILING);
  });

  it('rejects cross-environment metadata and corrupted readback without deleting anything', async () => {
    const client = new FakeS3Client();
    const store = createR2OwnerBackupStore(config(client));
    const encrypted = await encryptedBackup();
    const prefix = 'owner-backups/production/owner-primary/';
    const badKey = `${prefix}2026/09/27/bad-${'e'.repeat(64)}.json`;
    client.objects.set(badKey, {
      body: Buffer.from('{}'), size: 2, lastModified: now,
      metadata: {
        environment: 'staging', 'owner-profile-id': 'owner-primary',
        'exported-at': now.toISOString(), 'backup-schema-version': 'miraichi.cloud-backup.v3',
        'key-id': 'key-1', 'plaintext-sha256': 'f'.repeat(64),
        'ciphertext-sha256': 'e'.repeat(64), 'uploaded-at': now.toISOString()
      }
    });
    await expect(store.list()).rejects.toThrow('metadata mismatch');

    client.objects.clear();
    client.corruptReadback = true;
    await expect(store.put(encrypted)).rejects.toThrow('readback verification failed');
    expect(client.calls.some((call) => call.name === 'DeleteObjectCommand')).toBe(false);
  });
});
