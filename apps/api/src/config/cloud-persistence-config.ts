import type { CloudPersistenceMode } from '@miraichi/shared/src/contracts/cloud-persistence-contracts.js';

export interface CloudPersistenceConfig {
  mode: CloudPersistenceMode;
  appEnv: string;
  ownerProfileId: string;
  databaseUrl?: string;
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
  return {
    mode: mode as CloudPersistenceMode,
    appEnv,
    ownerProfileId: env.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary',
    ...(databaseUrl ? { databaseUrl } : {})
  };
}
