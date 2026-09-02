import { describe, expect, it } from 'vitest';
import {
  normalizePostgresConnectionString,
  resolvePostgresSslConfig
} from './postgres-query-client.js';

const CA = '-----BEGIN CERTIFICATE-----\nfixture-ca\n-----END CERTIFICATE-----';

describe('postgres query client SSL configuration', () => {
  it('disables SSL for local Supabase database URLs', () => {
    expect(resolvePostgresSslConfig('postgresql://postgres:postgres@127.0.0.1:54322/postgres')).toBe(false);
    expect(resolvePostgresSslConfig('postgresql://postgres:postgres@localhost:54322/postgres')).toBe(false);
  });

  it('honors explicit sslmode=disable', () => {
    expect(resolvePostgresSslConfig('postgresql://postgres:postgres@db.internal:5432/postgres?sslmode=disable')).toBe(false);
  });

  it('keeps SSL enabled for remote Supabase database URLs', () => {
    expect(
      resolvePostgresSslConfig(
        'postgresql://postgres.example:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=verify-full',
        CA
      )
    ).toEqual({ rejectUnauthorized: true, ca: CA });
  });

  it('fails closed when a remote database CA is missing', () => {
    expect(() => resolvePostgresSslConfig(
      'postgresql://postgres.example:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres'
    )).toThrow('SUPABASE_DATABASE_CA_BASE64 is required');
  });

  it('removes URI SSL options so they cannot override the verified client configuration', () => {
    const normalized = new URL(normalizePostgresConnectionString(
      'postgresql://postgres.example:secret@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres?sslmode=require&uselibpqcompat=true'
    ));
    expect(normalized.searchParams.has('sslmode')).toBe(false);
    expect(normalized.searchParams.has('uselibpqcompat')).toBe(false);
    expect(normalized.hostname).toBe('aws-0-ap-southeast-1.pooler.supabase.com');
  });
});
