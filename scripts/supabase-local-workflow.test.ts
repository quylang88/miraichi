import { describe, expect, it } from 'vitest';
import {
  EXPECTED_MIRAICHI_TABLES,
  LOCAL_SUPABASE_DATABASE_URL,
  buildDbeaverConnectionInfo,
  buildLocalSupabaseEnv,
  parseSupabaseStatusEnv,
  syncLocalSupabaseSnapshot,
  verifyLocalSupabaseWorkflow
} from './supabase-local-workflow.js';
import type { CommandRunner, QueryClientFactory } from './supabase-local-workflow.js';

describe('supabase local developer workflow', () => {
  it('parses the local DB URL from Supabase status env output', () => {
    const env = parseSupabaseStatusEnv('DB_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"\n');

    expect(env.DB_URL).toBe(LOCAL_SUPABASE_DATABASE_URL);
  });

  it('builds a server-only local Supabase environment', () => {
    const env = buildLocalSupabaseEnv({ MIRAICHI_OWNER_PROFILE_ID: 'owner-local' });

    expect(env).toMatchObject({
      APP_ENV: 'local',
      CLOUD_PERSISTENCE_MODE: 'supabase',
      SUPABASE_DATABASE_URL: LOCAL_SUPABASE_DATABASE_URL,
      MIRAICHI_OWNER_PROFILE_ID: 'owner-local'
    });
    expect(Object.keys(env).some((key) => key.startsWith('VITE_SUPABASE'))).toBe(false);
    expect(Object.keys(env).some((key) => key.startsWith('NEXT_PUBLIC_SUPABASE'))).toBe(false);
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });

  it('documents the exact DBeaver connection fields for the local DB', () => {
    expect(buildDbeaverConnectionInfo()).toEqual({
      host: '127.0.0.1',
      port: 54322,
      database: 'postgres',
      username: 'postgres',
      password: 'postgres',
      ssl: 'disable'
    });
  });

  it('verifies status, migration, schema, snapshot data, lint, and advisors', async () => {
    const calls: string[] = [];
    const runner: CommandRunner = {
      run(command, args) {
        calls.push([command, ...args].join(' '));
        if (args.includes('status')) return `DB_URL="${LOCAL_SUPABASE_DATABASE_URL}"`;
        if (args.includes('migration')) return '20260702052851';
        return 'No issues found';
      }
    };
    const queryFactory: QueryClientFactory = () => ({
      async query<T extends Record<string, unknown>>(text: string) {
        if (text.includes('information_schema.tables')) {
          return { rowCount: EXPECTED_MIRAICHI_TABLES.length, rows: EXPECTED_MIRAICHI_TABLES.map((table_name) => ({ table_name })) as unknown as T[] };
        }
        if (text.includes('supabase_migrations.schema_migrations')) {
          return { rowCount: 1, rows: [{ version: '20260702052851' }] as unknown as T[] };
        }
        if (text.includes('miraichi_app.match_record')) {
          return { rowCount: 1, rows: [{ match_count: 2, snapshot_count: 1 }] as unknown as T[] };
        }
        return { rowCount: 0, rows: [] as T[] };
      }
    });

    const result = await verifyLocalSupabaseWorkflow({ runner, queryFactory, supabaseCommand: 'supabase', log: () => undefined });

    expect(result).toEqual({
      databaseUrl: LOCAL_SUPABASE_DATABASE_URL,
      tableCount: EXPECTED_MIRAICHI_TABLES.length,
      matchCount: 2,
      snapshotCount: 1
    });
    expect(calls).toContain('supabase status -o env');
    expect(calls).toContain('supabase migration list --local');
    expect(calls).toContain('supabase db lint --local --schema miraichi_app --level warning --fail-on error');
    expect(calls).toContain('supabase db advisors --local --type security --fail-on error');
  });

  it('syncs through the TypeScript sync operation without spawning nested pnpm', async () => {
    const logs: string[] = [];
    let receivedEnv: NodeJS.ProcessEnv | undefined;

    await syncLocalSupabaseSnapshot({
      env: { MIRAICHI_OWNER_PROFILE_ID: 'owner-local' },
      log: (message) => logs.push(message),
      syncOperation: async ({ env }) => {
        receivedEnv = env;
      }
    });

    expect(receivedEnv).toMatchObject({
      APP_ENV: 'local',
      CLOUD_PERSISTENCE_MODE: 'supabase',
      SUPABASE_DATABASE_URL: LOCAL_SUPABASE_DATABASE_URL,
      MIRAICHI_OWNER_PROFILE_ID: 'owner-local'
    });
    expect(logs).toContain('[Supabase Local] Synced national-team snapshot into local Supabase.');
  });
});
