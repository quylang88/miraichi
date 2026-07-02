import { describe, expect, it } from 'vitest';
import { resolvePostgresSslConfig } from './postgres-query-client.js';

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
      resolvePostgresSslConfig('postgresql://postgres.example:secret@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres?sslmode=require')
    ).toEqual({ rejectUnauthorized: false });
  });
});
