import { Buffer } from 'node:buffer';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type HeadObjectCommandOutput,
  type ListObjectsV2CommandOutput
} from '@aws-sdk/client-s3';
import type {
  EncryptedOwnerBackupV1,
  OwnerBackupAuthenticatedMetadata,
  OwnerBackupEnvironment
} from './owner-backup-crypto.js';

export const OWNER_BACKUP_BYTE_CEILING = 1_000_000_000;

export interface StoredBackupMetadata {
  readonly environment: OwnerBackupEnvironment;
  readonly ownerProfileId: string;
  readonly exportedAt: string;
  readonly backupSchemaVersion: 'miraichi.cloud-backup.v3';
  readonly keyId: string;
  readonly plaintextSha256: string;
  readonly ciphertextSha256: string;
}

export interface StoredBackupObject {
  readonly key: string;
  readonly size: number;
  readonly uploadedAt: string;
  readonly ciphertextSha256: string;
  readonly metadata: StoredBackupMetadata;
}

export interface BackupRetentionPlan {
  readonly keep: StoredBackupObject[];
  readonly remove: StoredBackupObject[];
  readonly projectedBytes: number;
}

type OwnerBackupS3Command = ListObjectsV2Command | PutObjectCommand | HeadObjectCommand | GetObjectCommand | DeleteObjectCommand;

export interface OwnerBackupS3Client {
  send(command: OwnerBackupS3Command): Promise<unknown>;
}

export interface R2OwnerBackupStoreConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly environment: OwnerBackupEnvironment;
  readonly ownerProfileId: string;
  readonly prefix?: string;
  readonly client?: OwnerBackupS3Client;
  readonly now?: () => Date;
}

export interface OwnerBackupStore {
  list(): Promise<StoredBackupObject[]>;
  put(envelope: EncryptedOwnerBackupV1): Promise<StoredBackupObject>;
  head(key: string): Promise<StoredBackupObject>;
  get(key: string): Promise<EncryptedOwnerBackupV1>;
  delete(key: string): Promise<void>;
}

const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/u;
const BUCKET = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/u;

function sha256(value: Uint8Array): Buffer {
  return createHash('sha256').update(value).digest();
}

function sha256Hex(value: Uint8Array): string {
  return sha256(value).toString('hex');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Owner backup object is invalid');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([name, nested]) => `${JSON.stringify(name)}:${canonicalJson(nested)}`).join(',')}}`;
  }
  throw new Error('Owner backup object is invalid');
}

function requireDate(value: string, label: string): number {
  const timestamp = Date.parse(value);
  if (!ISO.test(value) || !Number.isFinite(timestamp)) throw new Error(`Owner backup ${label} is invalid`);
  return timestamp;
}

function validateRetentionObject(value: StoredBackupObject, now: Date): number {
  const uploadedAt = requireDate(value.uploadedAt, 'retention timestamp');
  if (uploadedAt > now.getTime()) throw new Error('Owner backup retention timestamp is in the future');
  if (!value.key || !Number.isSafeInteger(value.size) || value.size < 0
    || !SHA256.test(value.ciphertextSha256)
    || value.metadata.ciphertextSha256 !== value.ciphertextSha256) {
    throw new Error('Owner backup retention object is invalid');
  }
  return uploadedAt;
}

export function planBackupRetention(
  objects: readonly StoredBackupObject[],
  now: Date
): BackupRetentionPlan {
  if (!Number.isFinite(now.getTime())) throw new Error('Owner backup retention time is invalid');
  const keys = new Set<string>();
  const timestampByKey = new Map<string, number>();
  for (const object of objects) {
    if (keys.has(object.key)) throw new Error('Owner backup retention contains duplicate keys');
    keys.add(object.key);
    timestampByKey.set(object.key, validateRetentionObject(object, now));
  }
  const sorted = [...objects].sort((left, right) =>
    (timestampByKey.get(right.key) ?? 0) - (timestampByKey.get(left.key) ?? 0)
    || left.key.localeCompare(right.key));
  const daily = new Set<string>();
  const monthly = new Set<string>();
  const retainedKeys = new Set<string>();
  for (const object of sorted) {
    const timestamp = timestampByKey.get(object.key) ?? 0;
    const iso = new Date(timestamp).toISOString();
    const day = iso.slice(0, 10);
    const month = iso.slice(0, 7);
    if (daily.size < 30 && !daily.has(day)) {
      daily.add(day);
      retainedKeys.add(object.key);
    }
    if (monthly.size < 12 && !monthly.has(month)) {
      monthly.add(month);
      retainedKeys.add(object.key);
    }
  }
  const keep = sorted.filter((object) => retainedKeys.has(object.key));
  const remove = sorted.filter((object) => !retainedKeys.has(object.key));
  return { keep, remove, projectedBytes: keep.reduce((total, object) => total + object.size, 0) };
}

function storedMetadata(envelope: EncryptedOwnerBackupV1): StoredBackupMetadata {
  return {
    environment: envelope.authenticatedMetadata.environment,
    ownerProfileId: envelope.authenticatedMetadata.ownerProfileId,
    exportedAt: envelope.authenticatedMetadata.exportedAt,
    backupSchemaVersion: envelope.authenticatedMetadata.backupSchemaVersion,
    keyId: envelope.keyId,
    plaintextSha256: envelope.authenticatedMetadata.plaintextSha256,
    ciphertextSha256: envelope.ciphertextSha256
  };
}

function rawMetadata(metadata: StoredBackupMetadata, uploadedAt: string): Record<string, string> {
  return {
    environment: metadata.environment,
    'owner-profile-id': metadata.ownerProfileId,
    'exported-at': metadata.exportedAt,
    'backup-schema-version': metadata.backupSchemaVersion,
    'key-id': metadata.keyId,
    'plaintext-sha256': metadata.plaintextSha256,
    'ciphertext-sha256': metadata.ciphertextSha256,
    'uploaded-at': uploadedAt
  };
}

function parseMetadata(value: Record<string, string> | undefined): { metadata: StoredBackupMetadata; uploadedAt: string } {
  if (!value) throw new Error('Owner backup storage metadata mismatch');
  const expectedKeys = [
    'backup-schema-version', 'ciphertext-sha256', 'environment', 'exported-at',
    'key-id', 'owner-profile-id', 'plaintext-sha256', 'uploaded-at'
  ];
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error('Owner backup storage metadata mismatch');
  }
  const environment = value.environment;
  const backupSchemaVersion = value['backup-schema-version'];
  const ownerProfileId = value['owner-profile-id'];
  const exportedAt = value['exported-at'];
  const keyId = value['key-id'];
  const plaintextSha256 = value['plaintext-sha256'];
  const ciphertextSha256 = value['ciphertext-sha256'];
  const uploadedAt = value['uploaded-at'];
  if ((environment !== 'staging' && environment !== 'production')
    || backupSchemaVersion !== 'miraichi.cloud-backup.v3'
    || !ownerProfileId || !SAFE_SEGMENT.test(ownerProfileId)
    || !keyId || !SAFE_SEGMENT.test(keyId)
    || !exportedAt || !ISO.test(exportedAt)
    || !uploadedAt || !ISO.test(uploadedAt)
    || !plaintextSha256 || !SHA256.test(plaintextSha256)
    || !ciphertextSha256 || !SHA256.test(ciphertextSha256)) {
    throw new Error('Owner backup storage metadata mismatch');
  }
  return {
    metadata: {
      environment, ownerProfileId, exportedAt, backupSchemaVersion, keyId,
      plaintextSha256, ciphertextSha256
    },
    uploadedAt
  };
}

function parseEncryptedBackup(value: unknown): EncryptedOwnerBackupV1 {
  if (!isRecord(value)
    || value.envelopeVersion !== 'miraichi.owner-backup.aes-gcm.v1'
    || value.algorithm !== 'AES-256-GCM'
    || typeof value.keyId !== 'string' || !SAFE_SEGMENT.test(value.keyId)
    || typeof value.nonceBase64 !== 'string' || typeof value.tagBase64 !== 'string'
    || typeof value.ciphertextBase64 !== 'string'
    || typeof value.ciphertextSha256 !== 'string' || !SHA256.test(value.ciphertextSha256)
    || !isRecord(value.authenticatedMetadata)) throw new Error('Owner backup object is invalid');
  const metadata = value.authenticatedMetadata;
  if ((metadata.environment !== 'staging' && metadata.environment !== 'production')
    || metadata.backupSchemaVersion !== 'miraichi.cloud-backup.v3'
    || typeof metadata.ownerProfileId !== 'string'
    || typeof metadata.exportedAt !== 'string'
    || typeof metadata.plaintextSha256 !== 'string' || !SHA256.test(metadata.plaintextSha256)) {
    throw new Error('Owner backup object is invalid');
  }
  const ciphertext = Buffer.from(value.ciphertextBase64, 'base64');
  const expectedHash = Buffer.from(value.ciphertextSha256, 'hex');
  if (ciphertext.byteLength === 0 || !timingSafeEqual(sha256(ciphertext), expectedHash)) {
    throw new Error('Owner backup object is invalid');
  }
  return value as unknown as EncryptedOwnerBackupV1;
}

async function bodyBytes(output: GetObjectCommandOutput): Promise<Buffer> {
  const body: unknown = output.Body;
  if (body instanceof Uint8Array) return Buffer.from(body);
  if (isRecord(body) && typeof body.transformToByteArray === 'function') {
    return Buffer.from(await (body.transformToByteArray as () => Promise<Uint8Array>)());
  }
  throw new Error('Owner backup storage readback verification failed');
}

function assertConfig(config: R2OwnerBackupStoreConfig): void {
  let endpoint: URL;
  try { endpoint = new URL(config.endpoint); } catch { throw new Error('Owner backup storage configuration is invalid'); }
  if (endpoint.protocol !== 'https:' || !endpoint.hostname.endsWith('.r2.cloudflarestorage.com')
    || endpoint.port || endpoint.username || endpoint.password || (endpoint.pathname !== '/' && endpoint.pathname !== '')
    || endpoint.search || endpoint.hash || config.region !== 'auto' || !BUCKET.test(config.bucket)
    || !config.accessKeyId || !config.secretAccessKey || !SAFE_SEGMENT.test(config.ownerProfileId)
    || (config.environment !== 'staging' && config.environment !== 'production')
    || (config.prefix !== undefined && !SAFE_SEGMENT.test(config.prefix))) {
    throw new Error('Owner backup storage configuration is invalid');
  }
}

export function createR2OwnerBackupStore(config: R2OwnerBackupStoreConfig): OwnerBackupStore {
  assertConfig(config);
  const now = config.now ?? (() => new Date());
  const basePrefix = config.prefix ?? 'owner-backups';
  const boundedPrefix = `${basePrefix}/${config.environment}/${config.ownerProfileId}/`;
  const client: OwnerBackupS3Client = config.client ?? new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey }
  });

  const send = async <Output>(command: OwnerBackupS3Command): Promise<Output> => {
    try {
      return await client.send(command) as Output;
    } catch {
      throw new Error('Owner backup storage operation failed');
    }
  };

  const assertBoundedKey = (key: string): void => {
    if (!key.startsWith(boundedPrefix) || key.includes('..') || key.includes('\\')) {
      throw new Error('Owner backup storage key is outside the configured prefix');
    }
  };

  const head = async (key: string): Promise<StoredBackupObject> => {
    assertBoundedKey(key);
    const output = await send<HeadObjectCommandOutput>(new HeadObjectCommand({ Bucket: config.bucket, Key: key }));
    const parsed = parseMetadata(output.Metadata);
    const size = output.ContentLength;
    const hashFromKey = key.match(/-([a-f0-9]{64})\.json$/u)?.[1];
    if (!Number.isSafeInteger(size) || size === undefined || size < 0
      || parsed.metadata.environment !== config.environment
      || parsed.metadata.ownerProfileId !== config.ownerProfileId
      || parsed.metadata.ciphertextSha256 !== hashFromKey) {
      throw new Error('Owner backup storage metadata mismatch');
    }
    return {
      key, size, uploadedAt: parsed.uploadedAt,
      ciphertextSha256: parsed.metadata.ciphertextSha256,
      metadata: parsed.metadata
    };
  };

  const list = async (): Promise<StoredBackupObject[]> => {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const output = await send<ListObjectsV2CommandOutput>(new ListObjectsV2Command({
        Bucket: config.bucket, Prefix: boundedPrefix,
        ...(continuationToken ? { ContinuationToken: continuationToken } : {})
      }));
      for (const object of output.Contents ?? []) {
        if (!object.Key) throw new Error('Owner backup storage listing is invalid');
        assertBoundedKey(object.Key);
        keys.push(object.Key);
      }
      continuationToken = output.IsTruncated ? output.NextContinuationToken : undefined;
      if (output.IsTruncated && !continuationToken) throw new Error('Owner backup storage listing is invalid');
    } while (continuationToken);
    return Promise.all(keys.sort().map(head));
  };

  const get = async (objectKey: string): Promise<EncryptedOwnerBackupV1> => {
    assertBoundedKey(objectKey);
    const stored = await head(objectKey);
    const output = await send<GetObjectCommandOutput>(new GetObjectCommand({ Bucket: config.bucket, Key: objectKey }));
    const bytes = await bodyBytes(output);
    if (bytes.byteLength !== stored.size) throw new Error('Owner backup storage readback verification failed');
    let parsed: unknown;
    try { parsed = JSON.parse(bytes.toString('utf8')); } catch { throw new Error('Owner backup storage readback verification failed'); }
    const envelope = parseEncryptedBackup(parsed);
    const metadata = storedMetadata(envelope);
    if (canonicalJson(metadata) !== canonicalJson(stored.metadata)
      || envelope.ciphertextSha256 !== stored.ciphertextSha256) {
      throw new Error('Owner backup storage readback verification failed');
    }
    return envelope;
  };

  const remove = async (objectKey: string): Promise<void> => {
    assertBoundedKey(objectKey);
    await send(new DeleteObjectCommand({ Bucket: config.bucket, Key: objectKey }));
  };

  const put = async (envelope: EncryptedOwnerBackupV1): Promise<StoredBackupObject> => {
    const parsedEnvelope = parseEncryptedBackup(envelope);
    if (parsedEnvelope.authenticatedMetadata.environment !== config.environment
      || parsedEnvelope.authenticatedMetadata.ownerProfileId !== config.ownerProfileId) {
      throw new Error('Owner backup storage metadata mismatch');
    }
    const uploadedAt = now().toISOString();
    requireDate(uploadedAt, 'upload timestamp');
    const exportedAt = parsedEnvelope.authenticatedMetadata.exportedAt;
    requireDate(exportedAt, 'export timestamp');
    const date = exportedAt.slice(0, 10).split('-');
    const safeTimestamp = exportedAt.replace(/[:.]/gu, '-');
    const objectKey = `${boundedPrefix}${date[0]}/${date[1]}/${date[2]}/${safeTimestamp}-${parsedEnvelope.ciphertextSha256}.json`;
    const payload = Buffer.from(canonicalJson(parsedEnvelope), 'utf8');
    const metadata = storedMetadata(parsedEnvelope);
    const candidate: StoredBackupObject = {
      key: objectKey, size: payload.byteLength, uploadedAt,
      ciphertextSha256: parsedEnvelope.ciphertextSha256, metadata
    };
    const existing = await list();
    const exact = existing.find((object) => object.key === objectKey);
    if (exact) {
      const existingEnvelope = await get(objectKey);
      if (canonicalJson(existingEnvelope) !== canonicalJson(parsedEnvelope)) {
        throw new Error('Owner backup storage idempotency mismatch');
      }
      return exact;
    }
    const retention = planBackupRetention([...existing, candidate], now());
    if (retention.projectedBytes > OWNER_BACKUP_BYTE_CEILING) {
      throw new Error('Owner backup required retention exceeds the 1 GB safety ceiling');
    }
    await send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: objectKey,
      Body: payload,
      ContentType: 'application/json',
      Metadata: rawMetadata(metadata, uploadedAt)
    }));
    const verified = await head(objectKey);
    const readback = await get(objectKey);
    if (canonicalJson(verified) !== canonicalJson(candidate)
      || canonicalJson(readback) !== canonicalJson(parsedEnvelope)
      || sha256Hex(Buffer.from(readback.ciphertextBase64, 'base64')) !== candidate.ciphertextSha256) {
      throw new Error('Owner backup storage readback verification failed');
    }
    for (const object of retention.remove) await remove(object.key);
    return verified;
  };

  return { list, put, head, get, delete: remove };
}
