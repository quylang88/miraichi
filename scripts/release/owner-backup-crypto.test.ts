import { Buffer } from 'node:buffer';
import { describe, expect, it } from 'vitest';
import { createCloudBackupEnvelopeV3 } from '../../packages/shared/src/contracts/index.js';
import {
  decryptOwnerBackup,
  encryptOwnerBackup,
  parseBackupKey,
  type EncryptedOwnerBackupV1
} from './owner-backup-crypto.js';

const now = '2026-09-27T12:00:00.000Z';
const key = () => parseBackupKey(Buffer.alloc(32, 7).toString('base64'));

async function backup() {
  return createCloudBackupEnvelopeV3({
    exportedAt: now,
    ownerProfileId: 'owner-primary',
    ownerProfile: {
      ownerProfileId: 'owner-primary', label: 'Quy',
      settings: { theme: 'dark', locale: 'vi' },
      createdAt: '2026-07-02T00:00:00.000Z', updatedAt: now
    },
    drafts: [], bets: [], bankrollAccounts: [], bankrollLedgerEntries: [],
    disciplineConfigs: [], settlementEvents: []
  });
}

const encrypt = async () => encryptOwnerBackup({
  backup: await backup(), environment: 'production', keyId: 'owner-backup-2026-01'
}, key());

function replaceBase64Byte(value: string): string {
  const bytes = Buffer.from(value, 'base64');
  bytes[0] ^= 0xff;
  return bytes.toString('base64');
}

describe('owner backup crypto', () => {
  it('round-trips canonical V3 JSON with fresh AES-256-GCM nonces and authenticated metadata', async () => {
    const source = await backup();
    const first = encryptOwnerBackup({ backup: source, environment: 'production', keyId: 'owner-backup-2026-01' }, key());
    const second = encryptOwnerBackup({
      backup: {
        ...source,
        ownerProfile: source.ownerProfile ? {
          ...source.ownerProfile,
          settings: { locale: 'vi', theme: 'dark' }
        } : null
      },
      environment: 'production', keyId: 'owner-backup-2026-01'
    }, key());

    expect(first).toMatchObject({
      envelopeVersion: 'miraichi.owner-backup.aes-gcm.v1',
      algorithm: 'AES-256-GCM',
      keyId: 'owner-backup-2026-01',
      authenticatedMetadata: {
        environment: 'production', backupSchemaVersion: 'miraichi.cloud-backup.v3',
        ownerProfileId: 'owner-primary', exportedAt: now,
        plaintextSha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
      },
      ciphertextSha256: expect.stringMatching(/^[a-f0-9]{64}$/u)
    });
    expect(Object.keys(first.authenticatedMetadata)).toEqual([
      'environment', 'backupSchemaVersion', 'ownerProfileId', 'exportedAt', 'plaintextSha256'
    ]);
    expect(Buffer.from(first.nonceBase64, 'base64')).toHaveLength(12);
    expect(Buffer.from(first.tagBase64, 'base64')).toHaveLength(16);
    expect(first.nonceBase64).not.toBe(second.nonceBase64);
    expect(first.ciphertextBase64).not.toBe(second.ciphertextBase64);
    expect(first.authenticatedMetadata.plaintextSha256).toBe(second.authenticatedMetadata.plaintextSha256);
    expect(decryptOwnerBackup(first, key())).toEqual(source);
  });

  it('accepts only canonical base64 keys containing exactly 32 bytes', () => {
    expect(parseBackupKey(Buffer.alloc(32, 1).toString('base64'))).toEqual(Buffer.alloc(32, 1));
    for (const invalid of [
      '', 'not-base64', Buffer.alloc(31).toString('base64'), Buffer.alloc(33).toString('base64'),
      Buffer.alloc(32).toString('base64').replace(/=$/u, '')
    ]) expect(() => parseBackupKey(invalid)).toThrow('exactly 32 bytes');
  });

  it('refuses to encrypt a V3 envelope whose canonical counts were changed', async () => {
    const source = await backup();
    expect(() => encryptOwnerBackup({
      backup: {
        ...source,
        recordCounts: { ...source.recordCounts, bets: source.recordCounts.bets + 1 }
      },
      environment: 'production', keyId: 'owner-backup-2026-01'
    }, key())).toThrow('encryption input is invalid');
  });

  it('rejects wrong keys and every authenticated field or ciphertext mutation with one sanitized error', async () => {
    const encrypted = await encrypt();
    const changed = [
      { ...encrypted, keyId: 'attacker-key' },
      { ...encrypted, authenticatedMetadata: { ...encrypted.authenticatedMetadata, environment: 'staging' as const } },
      { ...encrypted, authenticatedMetadata: { ...encrypted.authenticatedMetadata, ownerProfileId: 'other-owner' } },
      { ...encrypted, authenticatedMetadata: { ...encrypted.authenticatedMetadata, exportedAt: '2026-09-28T00:00:00.000Z' } },
      { ...encrypted, authenticatedMetadata: { ...encrypted.authenticatedMetadata, plaintextSha256: '0'.repeat(64) } },
      { ...encrypted, ciphertextSha256: '0'.repeat(64) },
      { ...encrypted, ciphertextBase64: replaceBase64Byte(encrypted.ciphertextBase64) },
      { ...encrypted, tagBase64: replaceBase64Byte(encrypted.tagBase64) }
    ];

    expect(() => decryptOwnerBackup(encrypted, Buffer.alloc(32, 9))).toThrow('Owner backup decryption failed');
    for (const candidate of changed) {
      expect(() => decryptOwnerBackup(candidate, key())).toThrowError(/^Owner backup decryption failed$/u);
    }
  });

  it('rejects unsupported or malformed envelopes before returning plaintext', async () => {
    const encrypted = await encrypt();
    const unsupported = { ...encrypted, envelopeVersion: 'miraichi.owner-backup.aes-gcm.v0' };
    const malformedMetadata = {
      ...encrypted,
      authenticatedMetadata: { ...encrypted.authenticatedMetadata, extra: 'not-authenticated-contract' }
    };
    for (const candidate of [unsupported, malformedMetadata, null, {}]) {
      expect(() => decryptOwnerBackup(candidate as EncryptedOwnerBackupV1, key()))
        .toThrowError(/^Owner backup decryption failed$/u);
    }
  });
});
