import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { getReleaseTarget, type ReleaseEnvironment } from '../../packages/config/src/release-targets.js';
import { verifyCloudBackupEnvelopeV3 } from '../../packages/shared/src/contracts/index.js';
import { readCloudPersistenceConfig } from '../../apps/api/src/config/cloud-persistence-config.js';
import { createCloudPersistenceAdapter } from '../../apps/api/src/persistence/create-cloud-persistence-adapter.js';
import { decryptOwnerBackup, parseBackupKey } from './owner-backup-crypto.js';
import {
  createAndVerifyOwnerBackup,
  restoreOwnerBackupToDisposableDatabase,
  verifyLatestOwnerBackup,
  type BackupReceipt,
  type BackupVerificationReport,
  type RestoreReport
} from './owner-backup-runtime.js';
import { createR2OwnerBackupStore, type OwnerBackupStore } from './r2-owner-backup-store.js';

export type OwnerBackupCliCommand = 'create' | 'verify-latest' | 'restore-local';

export interface OwnerBackupCliOperations {
  readonly create?: () => Promise<BackupReceipt>;
  readonly verifyLatest?: () => Promise<BackupVerificationReport>;
  readonly restoreLocal?: () => Promise<RestoreReport>;
}

export interface OwnerBackupCliOptions {
  readonly env?: NodeJS.ProcessEnv;
  readonly operations?: OwnerBackupCliOperations;
  readonly write?: (line: string) => void;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (!value) throw new Error(`Missing required owner backup configuration: ${name}`);
  return value;
}

function environmentFrom(env: NodeJS.ProcessEnv): ReleaseEnvironment {
  const value = required(env, 'OWNER_BACKUP_ENVIRONMENT');
  if (value !== 'staging' && value !== 'production') {
    throw new Error('OWNER_BACKUP_ENVIRONMENT must be staging or production');
  }
  return value;
}

function createStore(env: NodeJS.ProcessEnv): OwnerBackupStore {
  return createR2OwnerBackupStore({
    endpoint: required(env, 'OWNER_BACKUP_R2_ENDPOINT'),
    region: 'auto',
    bucket: required(env, 'OWNER_BACKUP_R2_BUCKET'),
    accessKeyId: required(env, 'OWNER_BACKUP_R2_ACCESS_KEY_ID'),
    secretAccessKey: required(env, 'OWNER_BACKUP_R2_SECRET_ACCESS_KEY'),
    environment: environmentFrom(env),
    ownerProfileId: env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary'
  });
}

function encryptionKeyFrom(env: NodeJS.ProcessEnv) {
  return {
    keyId: required(env, 'OWNER_BACKUP_KEY_ID'),
    material: parseBackupKey(required(env, 'OWNER_BACKUP_KEY_BASE64'))
  };
}

export function assertLocalRestoreDatabaseUrl(databaseUrl: string): void {
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error('restore-local requires a local database URL'); }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)
    || !['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
    throw new Error('restore-local requires a local database URL');
  }
}

function cloudAdapter(env: NodeJS.ProcessEnv, appEnv: string) {
  const config = readCloudPersistenceConfig({
    ...env,
    APP_ENV: appEnv,
    CLOUD_PERSISTENCE_MODE: 'supabase'
  });
  return createCloudPersistenceAdapter(config);
}

async function latestVerifiedBackup(env: NodeJS.ProcessEnv): Promise<{
  store: OwnerBackupStore;
  report: BackupVerificationReport;
  envelope: ReturnType<typeof decryptOwnerBackup>;
}> {
  const store = createStore(env);
  const expectedOwner = env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary';
  const environment = environmentFrom(env);
  const key = encryptionKeyFrom(env);
  const report = await verifyLatestOwnerBackup({
    store, key, environment, ownerProfileId: expectedOwner
  });
  const encrypted = await store.get(report.objectKey);
  const envelope = decryptOwnerBackup(encrypted, key.material);
  if (!await verifyCloudBackupEnvelopeV3(envelope)) throw new Error('Latest owner backup verification failed');
  return {
    store,
    envelope,
    report
  };
}

async function defaultCreate(env: NodeJS.ProcessEnv): Promise<BackupReceipt> {
  const environment = environmentFrom(env);
  const ownerProfileId = env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary';
  return createAndVerifyOwnerBackup({
    adapter: cloudAdapter(env, environment),
    store: createStore(env),
    key: encryptionKeyFrom(env),
    target: getReleaseTarget(environment),
    ownerProfileId,
    now: () => new Date()
  });
}

async function defaultRestoreLocal(env: NodeJS.ProcessEnv): Promise<RestoreReport> {
  const databaseUrl = required(env, 'SUPABASE_DATABASE_URL');
  assertLocalRestoreDatabaseUrl(databaseUrl);
  const latest = await latestVerifiedBackup(env);
  return restoreOwnerBackupToDisposableDatabase({
    envelope: latest.envelope,
    adapter: cloudAdapter(env, 'local'),
    expectedOwner: env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary'
  });
}

export async function runOwnerBackupCli(
  args: readonly string[],
  options: OwnerBackupCliOptions = {}
): Promise<void> {
  const command = args[0];
  if (command !== 'create' && command !== 'verify-latest' && command !== 'restore-local') {
    throw new Error('Unsupported owner backup command');
  }
  if (args.length !== 1) throw new Error(`${command} does not accept arguments`);
  const env = options.env ?? process.env;
  if (command === 'restore-local') {
    assertLocalRestoreDatabaseUrl(required(env, 'SUPABASE_DATABASE_URL'));
  }
  const result = command === 'create'
    ? await (options.operations?.create ?? (() => defaultCreate(env)))()
    : command === 'verify-latest'
      ? await (options.operations?.verifyLatest ?? (() => latestVerifiedBackup(env).then((value) => value.report)))()
      : await (options.operations?.restoreLocal ?? (() => defaultRestoreLocal(env)))();
  (options.write ?? console.log)(JSON.stringify({ status: 'ok', command, ...result }));
}

async function main(): Promise<void> {
  try {
    await runOwnerBackupCli(process.argv.slice(2));
  } catch {
    console.error(JSON.stringify({ status: 'failed', code: 'owner_backup_command_failed' }));
    process.exitCode = 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  void main();
}
