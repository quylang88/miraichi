import { Buffer } from 'node:buffer';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual
} from 'node:crypto';
import {
  canonicalCloudBackupV3Payload,
  type CloudBackupEnvelopeV3
} from '../../packages/shared/src/contracts/index.js';

export type OwnerBackupEnvironment = 'staging' | 'production';

export interface OwnerBackupAuthenticatedMetadata {
  readonly environment: OwnerBackupEnvironment;
  readonly backupSchemaVersion: 'miraichi.cloud-backup.v3';
  readonly ownerProfileId: string;
  readonly exportedAt: string;
  readonly plaintextSha256: string;
}

export interface EncryptedOwnerBackupV1 {
  readonly envelopeVersion: 'miraichi.owner-backup.aes-gcm.v1';
  readonly algorithm: 'AES-256-GCM';
  readonly keyId: string;
  readonly nonceBase64: string;
  readonly tagBase64: string;
  readonly ciphertextBase64: string;
  readonly authenticatedMetadata: OwnerBackupAuthenticatedMetadata;
  readonly ciphertextSha256: string;
}

export interface EncryptOwnerBackupInput {
  readonly backup: CloudBackupEnvelopeV3;
  readonly environment: OwnerBackupEnvironment;
  readonly keyId: string;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/u;
const OUTER_KEYS = [
  'algorithm', 'authenticatedMetadata', 'ciphertextBase64', 'ciphertextSha256',
  'envelopeVersion', 'keyId', 'nonceBase64', 'tagBase64'
] as const;
const METADATA_KEYS = [
  'backupSchemaVersion', 'environment', 'exportedAt', 'ownerProfileId', 'plaintextSha256'
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Owner backup encryption input is invalid');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, nested]) => `${JSON.stringify(key)}:${canonicalJson(nested)}`).join(',')}}`;
  }
  throw new Error('Owner backup encryption input is invalid');
}

function sha256(value: string | Uint8Array): Buffer {
  return createHash('sha256').update(value).digest();
}

function sha256Hex(value: string | Uint8Array): string {
  return sha256(value).toString('hex');
}

function canonicalBase64(value: unknown, byteLength?: number): Buffer | null {
  if (typeof value !== 'string' || value.length === 0 || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)) return null;
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value || (byteLength !== undefined && decoded.byteLength !== byteLength)) return null;
  return decoded;
}

function assertKey(key: Buffer): void {
  if (!Buffer.isBuffer(key) || key.byteLength !== 32) {
    throw new Error('Owner backup key must be exactly 32 bytes');
  }
}

function aadFor(
  keyId: string,
  metadata: OwnerBackupAuthenticatedMetadata
): Buffer {
  return Buffer.from(canonicalJson({
    envelopeVersion: 'miraichi.owner-backup.aes-gcm.v1',
    algorithm: 'AES-256-GCM',
    keyId,
    authenticatedMetadata: metadata
  }), 'utf8');
}

function assertCanonicalV3Backup(backup: CloudBackupEnvelopeV3): void {
  const canonicalPayload = canonicalCloudBackupV3Payload(backup);
  const { payloadSha256, ...withoutHash } = backup;
  if (canonicalJson(withoutHash) !== canonicalPayload
    || sha256Hex(canonicalPayload) !== payloadSha256) {
    throw new Error('Owner backup encryption input is invalid');
  }
}

function assertEncryptInput(input: EncryptOwnerBackupInput): void {
  if (!KEY_ID.test(input.keyId)
    || (input.environment !== 'staging' && input.environment !== 'production')
    || input.backup.schemaVersion !== 'miraichi.cloud-backup.v3'
    || !input.backup.ownerProfileId.trim()
    || !ISO.test(input.backup.exportedAt)
    || !SHA256.test(input.backup.payloadSha256)) {
    throw new Error('Owner backup encryption input is invalid');
  }
  assertCanonicalV3Backup(input.backup);
}

export function parseBackupKey(base64: string): Buffer {
  const parsed = canonicalBase64(base64, 32);
  if (!parsed) throw new Error('Owner backup key must be exactly 32 bytes encoded as canonical base64');
  return parsed;
}

export function encryptOwnerBackup(
  input: EncryptOwnerBackupInput,
  key: Buffer
): EncryptedOwnerBackupV1 {
  assertKey(key);
  assertEncryptInput(input);
  const plaintext = canonicalJson(input.backup);
  const authenticatedMetadata: OwnerBackupAuthenticatedMetadata = {
    environment: input.environment,
    backupSchemaVersion: input.backup.schemaVersion,
    ownerProfileId: input.backup.ownerProfileId,
    exportedAt: input.backup.exportedAt,
    plaintextSha256: sha256Hex(plaintext)
  };
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce, { authTagLength: 16 });
  cipher.setAAD(aadFor(input.keyId, authenticatedMetadata));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    envelopeVersion: 'miraichi.owner-backup.aes-gcm.v1',
    algorithm: 'AES-256-GCM',
    keyId: input.keyId,
    nonceBase64: nonce.toString('base64'),
    tagBase64: tag.toString('base64'),
    ciphertextBase64: ciphertext.toString('base64'),
    authenticatedMetadata,
    ciphertextSha256: sha256Hex(ciphertext)
  };
}

function parseEncryptedEnvelope(value: unknown): {
  envelope: EncryptedOwnerBackupV1;
  nonce: Buffer;
  tag: Buffer;
  ciphertext: Buffer;
} {
  if (!isRecord(value) || !hasExactKeys(value, OUTER_KEYS)
    || value.envelopeVersion !== 'miraichi.owner-backup.aes-gcm.v1'
    || value.algorithm !== 'AES-256-GCM'
    || typeof value.keyId !== 'string' || !KEY_ID.test(value.keyId)
    || !isRecord(value.authenticatedMetadata)
    || !hasExactKeys(value.authenticatedMetadata, METADATA_KEYS)) throw new Error('invalid');

  const metadata = value.authenticatedMetadata;
  if ((metadata.environment !== 'staging' && metadata.environment !== 'production')
    || metadata.backupSchemaVersion !== 'miraichi.cloud-backup.v3'
    || typeof metadata.ownerProfileId !== 'string' || !metadata.ownerProfileId.trim()
    || typeof metadata.exportedAt !== 'string' || !ISO.test(metadata.exportedAt)
    || typeof metadata.plaintextSha256 !== 'string' || !SHA256.test(metadata.plaintextSha256)
    || typeof value.ciphertextSha256 !== 'string' || !SHA256.test(value.ciphertextSha256)) throw new Error('invalid');

  const nonce = canonicalBase64(value.nonceBase64, 12);
  const tag = canonicalBase64(value.tagBase64, 16);
  const ciphertext = canonicalBase64(value.ciphertextBase64);
  if (!nonce || !tag || !ciphertext || ciphertext.byteLength === 0) throw new Error('invalid');
  const envelope = value as unknown as EncryptedOwnerBackupV1;
  if (!timingSafeEqual(sha256(ciphertext), Buffer.from(envelope.ciphertextSha256, 'hex'))) throw new Error('invalid');
  return { envelope, nonce, tag, ciphertext };
}

function assertDecryptedBackup(value: unknown, plaintext: string, metadata: OwnerBackupAuthenticatedMetadata): CloudBackupEnvelopeV3 {
  if (!isRecord(value)
    || value.schemaVersion !== 'miraichi.cloud-backup.v3'
    || value.ownerProfileId !== metadata.ownerProfileId
    || value.exportedAt !== metadata.exportedAt
    || typeof value.payloadSha256 !== 'string' || !SHA256.test(value.payloadSha256)
    || !Array.isArray(value.drafts) || !Array.isArray(value.bets)
    || !Array.isArray(value.bankrollAccounts) || !Array.isArray(value.bankrollLedgerEntries)
    || !Array.isArray(value.disciplineConfigs) || !Array.isArray(value.settlementEvents)
    || !isRecord(value.recordCounts)) throw new Error('invalid');
  const backup = value as unknown as CloudBackupEnvelopeV3;
  if (canonicalJson(backup) !== plaintext || sha256Hex(plaintext) !== metadata.plaintextSha256) throw new Error('invalid');
  assertCanonicalV3Backup(backup);
  const expectedCounts = {
    ownerProfiles: backup.ownerProfile ? 1 : 0,
    betDrafts: backup.drafts.length,
    bets: backup.bets.length,
    bankrollAccounts: backup.bankrollAccounts.length,
    bankrollLedgerEntries: backup.bankrollLedgerEntries.length,
    disciplineConfigs: backup.disciplineConfigs.length,
    settlementEvents: backup.settlementEvents.length
  };
  if (canonicalJson(backup.recordCounts) !== canonicalJson(expectedCounts)) throw new Error('invalid');
  return backup;
}

export function decryptOwnerBackup(envelope: unknown, key: Buffer): CloudBackupEnvelopeV3 {
  try {
    assertKey(key);
    const parsed = parseEncryptedEnvelope(envelope);
    const decipher = createDecipheriv('aes-256-gcm', key, parsed.nonce, { authTagLength: 16 });
    decipher.setAAD(aadFor(parsed.envelope.keyId, parsed.envelope.authenticatedMetadata));
    decipher.setAuthTag(parsed.tag);
    const plaintext = Buffer.concat([decipher.update(parsed.ciphertext), decipher.final()]).toString('utf8');
    const value: unknown = JSON.parse(plaintext);
    return assertDecryptedBackup(value, plaintext, parsed.envelope.authenticatedMetadata);
  } catch {
    throw new Error('Owner backup decryption failed');
  }
}
