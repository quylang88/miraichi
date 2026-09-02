import { describe, expect, it } from 'vitest';
import { readCloudPersistenceConfig } from './cloud-persistence-config.js';

describe('cloud persistence config', () => {
  it('defaults to disabled without a database URL', () => {
    expect(readCloudPersistenceConfig({ APP_ENV: 'local' })).toMatchObject({ mode: 'disabled', ownerProfileId: 'owner-primary' });
  });
  it('requires a database URL in supabase mode', () => {
    expect(() => readCloudPersistenceConfig({ APP_ENV: 'local', CLOUD_PERSISTENCE_MODE: 'supabase' })).toThrow('SUPABASE_DATABASE_URL is required');
  });
  it('rejects memory mode outside local and test', () => {
    expect(() => readCloudPersistenceConfig({ APP_ENV: 'staging', CLOUD_PERSISTENCE_MODE: 'memory' })).toThrow('memory cloud persistence is test-only');
  });
  it('fails closed when hosted production is not backed by Supabase', () => {
    expect(() => readCloudPersistenceConfig({
      APP_ENV: 'production',
      HOSTED_WEB_MODE: 'required',
      CLOUD_PERSISTENCE_MODE: 'disabled'
    })).toThrow('Hosted production requires CLOUD_PERSISTENCE_MODE=supabase');
  });
  it('rejects unknown modes', () => {
    expect(() => readCloudPersistenceConfig({ CLOUD_PERSISTENCE_MODE: 'mock' })).toThrow('CLOUD_PERSISTENCE_MODE must be');
  });
});
