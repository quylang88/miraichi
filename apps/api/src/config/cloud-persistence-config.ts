import type { CloudPersistenceMode } from '@miraichi/shared/src/contracts/cloud-persistence-contracts.js';

export interface CloudPersistenceConfig {
  mode: CloudPersistenceMode;
  appEnv: string;
  ownerProfileId: string;
  databaseUrl?: string;
  databaseCa?: string;
}

function isRemoteDatabaseUrl(databaseUrl: string): boolean {
  const hostname = new URL(databaseUrl).hostname;
  return !['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function decodeDatabaseCa(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  const certificate = Buffer.from(value.trim(), 'base64').toString('utf8');
  if (!certificate.includes('-----BEGIN CERTIFICATE-----')
    || !certificate.includes('-----END CERTIFICATE-----')) {
    throw new Error('SUPABASE_DATABASE_CA_BASE64 must contain a base64-encoded PEM certificate');
  }
  return certificate;
}

export function readCloudPersistenceConfig(env: NodeJS.ProcessEnv = process.env): CloudPersistenceConfig {
  const mode = env.CLOUD_PERSISTENCE_MODE?.trim() || 'disabled';
  if (!['disabled', 'memory', 'supabase'].includes(mode)) {
    throw new Error('CLOUD_PERSISTENCE_MODE must be disabled, memory, or supabase');
  }
  const appEnv = env.APP_ENV?.trim() || 'local';
  if (mode === 'memory' && !['local', 'test'].includes(appEnv)) {
    throw new Error('memory cloud persistence is test-only');
  }
  if (env.HOSTED_WEB_MODE?.trim() === 'required' && !['local', 'test'].includes(appEnv) && mode !== 'supabase') {
    throw new Error('Hosted production requires CLOUD_PERSISTENCE_MODE=supabase');
  }
  const databaseUrl = env.SUPABASE_DATABASE_URL?.trim();
  if (mode === 'supabase' && !databaseUrl) throw new Error('SUPABASE_DATABASE_URL is required');
  const databaseCa = decodeDatabaseCa(env.SUPABASE_DATABASE_CA_BASE64);
  if (mode === 'supabase' && databaseUrl && isRemoteDatabaseUrl(databaseUrl) && !databaseCa) {
    throw new Error('SUPABASE_DATABASE_CA_BASE64 is required for remote Supabase connections');
  }
  return {
    mode: mode as CloudPersistenceMode,
    appEnv,
    ownerProfileId: env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary',
    ...(databaseUrl ? { databaseUrl } : {}),
    ...(databaseCa ? { databaseCa } : {})
  };
}
