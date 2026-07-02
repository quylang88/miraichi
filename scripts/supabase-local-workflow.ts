import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCloudPersistenceConfig } from '../apps/api/src/config/cloud-persistence-config.js';
import { createCloudPersistenceAdapter } from '../apps/api/src/persistence/create-cloud-persistence-adapter.js';
import { createPostgresQueryClient, type PostgresQueryClient } from '../apps/api/src/persistence/supabase/postgres-query-client.js';
import { LocalMatchSnapshotRepository } from '../apps/api/src/repositories/local-match-snapshot-repository.js';
import { runNationalTeamCloudSync } from './sync-national-team-data-to-cloud.js';

export const LOCAL_SUPABASE_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
export const PHASE9_CLOUD_MIGRATION_VERSION = '20260702052851';
export const EXPECTED_MIRAICHI_TABLES = [
  'app_profile',
  'backup_export_log',
  'bankroll_account',
  'bankroll_ledger_entry',
  'bet_draft',
  'bet_record',
  'match_record',
  'match_snapshot'
] as const;

export interface CommandRunner {
  run(command: string, args: readonly string[], options?: { env?: NodeJS.ProcessEnv }): string;
}

export type QueryClientFactory = (databaseUrl: string) => Pick<PostgresQueryClient, 'query'>;
export type LocalSupabaseSyncOperation = (options: { env: NodeJS.ProcessEnv; log: (message: string) => void }) => Promise<void>;

export interface LocalSupabaseVerifyResult {
  databaseUrl: string;
  tableCount: number;
  matchCount: number;
  snapshotCount: number;
}

const forbiddenSupabaseEnv = /^(SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE.*|NEXT_PUBLIC_SUPABASE.*)$/;

class ExecCommandRunner implements CommandRunner {
  run(command: string, args: readonly string[], options: { env?: NodeJS.ProcessEnv } = {}): string {
    const needsWindowsCommandShell = process.platform === 'win32' && command.toLowerCase().endsWith('.cmd');
    const executable = needsWindowsCommandShell ? 'cmd.exe' : command;
    const executableArgs = needsWindowsCommandShell ? ['/d', '/s', '/c', command, ...args] : [...args];
    return execFileSync(executable, executableArgs, {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'inherit']
    });
  }
}

export function parseSupabaseStatusEnv(output: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = /^([A-Z0-9_]+)=(?:"([^"]*)"|(.*))$/.exec(line);
    if (!match) continue;
    env[match[1]!] = match[2] ?? match[3] ?? '';
  }
  return env;
}

export function buildLocalSupabaseEnv(baseEnv: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (value === undefined || forbiddenSupabaseEnv.test(key)) continue;
    env[key] = value;
  }
  env.APP_ENV = 'local';
  env.CLOUD_PERSISTENCE_MODE = 'supabase';
  env.SUPABASE_DATABASE_URL = LOCAL_SUPABASE_DATABASE_URL;
  env.MIRAICHI_OWNER_PROFILE_ID = baseEnv.MIRAICHI_OWNER_PROFILE_ID?.trim() || 'owner-primary';
  return env;
}

export function buildDbeaverConnectionInfo() {
  return {
    host: '127.0.0.1',
    port: 54322,
    database: 'postgres',
    username: 'postgres',
    password: 'postgres',
    ssl: 'disable'
  };
}

export function resolveSupabaseCliScriptPath(root: string = process.cwd()): string {
  return join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
}

async function defaultSyncOperation(options: { env: NodeJS.ProcessEnv; log: (message: string) => void }): Promise<void> {
  const config = readCloudPersistenceConfig(options.env);
  await runNationalTeamCloudSync({
    localRepository: new LocalMatchSnapshotRepository(),
    adapter: createCloudPersistenceAdapter(config),
    ownerProfileId: config.ownerProfileId,
    log: options.log
  });
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function defaultQueryFactory(databaseUrl: string): Pick<PostgresQueryClient, 'query'> {
  return createPostgresQueryClient(databaseUrl);
}

export async function verifyLocalSupabaseWorkflow(options: {
  runner?: CommandRunner;
  queryFactory?: QueryClientFactory;
  supabaseCommand?: string;
  log?: (message: string) => void;
} = {}): Promise<LocalSupabaseVerifyResult> {
  const runner = options.runner ?? new ExecCommandRunner();
  const queryFactory = options.queryFactory ?? defaultQueryFactory;
  const supabaseCommand = options.supabaseCommand ?? process.execPath;
  const supabaseArgsPrefix = options.supabaseCommand ? [] : [resolveSupabaseCliScriptPath()];
  const log = options.log ?? console.log;
  const runSupabase = (args: readonly string[]) => runner.run(supabaseCommand, [...supabaseArgsPrefix, ...args]);

  const statusEnv = parseSupabaseStatusEnv(runSupabase(['status', '-o', 'env']));
  const databaseUrl = statusEnv.DB_URL;
  assert(databaseUrl === LOCAL_SUPABASE_DATABASE_URL, `Supabase local DB_URL mismatch. Expected ${LOCAL_SUPABASE_DATABASE_URL}, received ${databaseUrl || 'missing'}.`);
  log(`[Supabase Local] DB is reachable at ${databaseUrl}`);

  const migrationList = runSupabase(['migration', 'list', '--local']);
  assert(migrationList.includes(PHASE9_CLOUD_MIGRATION_VERSION), `Missing local migration ${PHASE9_CLOUD_MIGRATION_VERSION}. Run: pnpm exec supabase db reset --local`);
  log(`[Supabase Local] Migration ${PHASE9_CLOUD_MIGRATION_VERSION} is present in local history.`);

  const client = queryFactory(databaseUrl);
  const migrationRows = await client.query<{ version: string }>(
    'select version from supabase_migrations.schema_migrations where version = $1',
    [PHASE9_CLOUD_MIGRATION_VERSION]
  );
  assert(migrationRows.rowCount === 1, `Migration ${PHASE9_CLOUD_MIGRATION_VERSION} is not applied in supabase_migrations.schema_migrations.`);

  const tableRows = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'miraichi_app' order by table_name"
  );
  const actualTables = new Set(tableRows.rows.map((row) => row.table_name));
  const missingTables = EXPECTED_MIRAICHI_TABLES.filter((table) => !actualTables.has(table));
  assert(missingTables.length === 0, `Missing miraichi_app tables: ${missingTables.join(', ')}`);
  log(`[Supabase Local] miraichi_app has ${EXPECTED_MIRAICHI_TABLES.length} expected tables.`);

  const countRows = await client.query<{ match_count: number; snapshot_count: number }>(
    'select (select count(*)::int from miraichi_app.match_record) as match_count, (select count(*)::int from miraichi_app.match_snapshot) as snapshot_count'
  );
  const counts = countRows.rows[0];
  assert(counts, 'Could not read local Supabase snapshot counts.');
  assert(Number(counts.snapshot_count) > 0, 'No local cloud match snapshot found. Run: pnpm run supabase:local:sync');
  assert(Number(counts.match_count) > 0, 'No local cloud match records found. Run: pnpm run supabase:local:sync');
  log(`[Supabase Local] Snapshot data exists: ${counts.match_count} matches / ${counts.snapshot_count} snapshots.`);

  runSupabase(['db', 'lint', '--local', '--schema', 'miraichi_app', '--level', 'warning', '--fail-on', 'error']);
  runSupabase(['db', 'advisors', '--local', '--type', 'security', '--fail-on', 'error']);
  log('[Supabase Local] db lint and security advisors passed.');

  return {
    databaseUrl,
    tableCount: EXPECTED_MIRAICHI_TABLES.length,
    matchCount: Number(counts.match_count),
    snapshotCount: Number(counts.snapshot_count)
  };
}

export async function syncLocalSupabaseSnapshot(options: {
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
  syncOperation?: LocalSupabaseSyncOperation;
} = {}): Promise<void> {
  const env = buildLocalSupabaseEnv(options.env ?? process.env);
  const log = options.log ?? console.log;
  const syncOperation = options.syncOperation ?? defaultSyncOperation;
  await syncOperation({ env, log });
  log('[Supabase Local] Synced national-team snapshot into local Supabase.');
}

function printStatus(): void {
  const info = buildDbeaverConnectionInfo();
  console.log('[Supabase Local] DBeaver connection');
  console.log(`Host: ${info.host}`);
  console.log(`Port: ${info.port}`);
  console.log(`Database: ${info.database}`);
  console.log(`Username: ${info.username}`);
  console.log(`Password: ${info.password}`);
  console.log(`SSL: ${info.ssl}`);
  console.log(`URL: ${LOCAL_SUPABASE_DATABASE_URL}`);
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'help';
  if (command === 'status') {
    printStatus();
    return;
  }
  if (command === 'verify') {
    await verifyLocalSupabaseWorkflow();
    return;
  }
  if (command === 'sync') {
    await syncLocalSupabaseSnapshot();
    return;
  }
  console.log('Usage: tsx scripts/supabase-local-workflow.ts <status|verify|sync>');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
