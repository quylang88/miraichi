import { describe, expect, it } from 'vitest';
import { readCloudPersistenceConfig } from './cloud-persistence-config.js';

describe('cloud persistence config', () => {
  it('defaults to disabled without a database URL', () => {
    expect(readCloudPersistenceConfig({ APP_ENV: 'local' })).toMatchObject({ mode: 'disabled', ownerProfileId: 'owner-primary' });
  });
  it('requires a database URL in supabase mode', () => {
    expect(() => readCloudPersistenceConfig({ APP_ENV: 'local', CLOUD_PERSISTENCE_MODE: 'supabase' })).toThrow('SUPABASE_DATABASE_URL is required');
  });
  it('requires and decodes the project CA for a remote Supabase connection', () => {
    const databaseUrl = 'postgresql://postgres.example:secret@aws-0-eu-central-1.pooler.supabase.com:5432/postgres';
    expect(() => readCloudPersistenceConfig({ APP_ENV: 'local', CLOUD_PERSISTENCE_MODE: 'supabase', SUPABASE_DATABASE_URL: databaseUrl }))
      .toThrow('SUPABASE_DATABASE_CA_BASE64 is required');
    const certificate = '-----BEGIN CERTIFICATE-----\nfixture-ca\n-----END CERTIFICATE-----';
    expect(readCloudPersistenceConfig({
      APP_ENV: 'local', CLOUD_PERSISTENCE_MODE: 'supabase', SUPABASE_DATABASE_URL: databaseUrl,
      SUPABASE_DATABASE_CA_BASE64: Buffer.from(certificate).toString('base64')
    })).toMatchObject({ databaseCa: certificate });
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
