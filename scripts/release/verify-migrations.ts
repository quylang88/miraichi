import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyCloudBackupEnvelopeV3 } from '../../packages/shared/src/contracts/index.js';
import { createSupabaseCloudPersistenceAdapter } from '../../apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.js';
import {
  createPostgresQueryClient,
  type CloseablePostgresQueryClient,
  type PostgresQueryClient
} from '../../apps/api/src/persistence/supabase/postgres-query-client.js';
import {
  verifyMigrationSet,
  type MigrationFile,
  type MigrationReport
} from './migration-policy.js';

export interface MigrationRepository {
  diffNameStatus(baseSha: string, headSha: string): string;
  listHeadMigrationPaths(headSha: string): string[];
  readHeadFile(path: string, headSha: string): string;
  readBaseFile(path: string, baseSha: string): string;
}

export interface ParsedMigrationChange {
  readonly status: 'added' | 'modified' | 'deleted';
  readonly path: string;
}

export interface MigrationExecutionResult {
  readonly mode: 'empty' | 'prior';
  readonly appliedMigrationCount: number;
  readonly ownerDataPreserved: boolean;
  readonly currentReaderCompatible: boolean;
  readonly previousReaderCompatible: boolean;
}

export interface MigrationRunner {
  verifyEmptyDatabase(migrations: readonly MigrationFile[]): Promise<MigrationExecutionResult>;
  verifyPriorSchema(migrations: readonly MigrationFile[]): Promise<MigrationExecutionResult>;
}

export interface MigrationVerificationResult {
  readonly report: MigrationReport;
  readonly emptyDatabase?: MigrationExecutionResult;
  readonly priorSchema?: MigrationExecutionResult;
}

const MIGRATION_PATH = /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/u;

export function parseMigrationNameStatus(output: string): ParsedMigrationChange[] {
  const changes: ParsedMigrationChange[] = [];
  for (const line of output.split(/\r?\n/u)) {
    if (!line.trim()) continue;
    const fields = line.split('\t');
    const code = fields[0] ?? '';
    if ((code.startsWith('R') || code.startsWith('C')) && fields[1] && fields[2]) {
      changes.push({ status: 'deleted', path: fields[1].replace(/\\/gu, '/') });
      changes.push({ status: 'added', path: fields[2].replace(/\\/gu, '/') });
      continue;
    }
    const file = fields[1]?.replace(/\\/gu, '/');
    if (!file) throw new Error('Git migration diff output is invalid');
    if (code === 'A') changes.push({ status: 'added', path: file });
    else if (code === 'M') changes.push({ status: 'modified', path: file });
    else if (code === 'D') changes.push({ status: 'deleted', path: file });
    else throw new Error('Git migration diff contains an unsupported change type');
  }
  return changes;
}

export function discoverMigrationSet(input: {
  readonly repository: MigrationRepository;
  readonly baseSha: string;
  readonly headSha: string;
}): MigrationFile[] {
  const changes = parseMigrationNameStatus(input.repository.diffNameStatus(input.baseSha, input.headSha));
  const changeByPath = new Map(changes.map((change) => [change.path, change.status]));
  const headPaths = input.repository.listHeadMigrationPaths(input.headSha)
    .map((file) => file.replace(/\\/gu, '/'))
    .filter((file) => MIGRATION_PATH.test(file))
    .sort();
  const migrations: MigrationFile[] = headPaths.map((file) => ({
    path: file,
    sql: input.repository.readHeadFile(file, input.headSha),
    change: changeByPath.get(file) ?? 'unchanged'
  }));
  const headSet = new Set(headPaths);
  for (const change of changes) {
    if (change.status !== 'deleted' || headSet.has(change.path)) continue;
    migrations.push({
      path: change.path,
      sql: input.repository.readBaseFile(change.path, input.baseSha),
      change: 'deleted'
    });
  }
  return migrations.sort((left, right) => left.path.localeCompare(right.path));
}

export async function verifyMigrations(input: {
  readonly repository: MigrationRepository;
  readonly runner: MigrationRunner;
  readonly baseSha: string;
  readonly headSha: string;
}): Promise<MigrationVerificationResult> {
  const migrations = discoverMigrationSet(input);
  const report = verifyMigrationSet({
    baseSha: input.baseSha,
    headSha: input.headSha,
    migrations
  });
  if (!report.ok) return { report };
  const executableMigrations = migrations.filter((migration) => migration.change !== 'deleted');
  const emptyDatabase = await input.runner.verifyEmptyDatabase(executableMigrations);
  const priorSchema = await input.runner.verifyPriorSchema(executableMigrations);
  for (const result of [emptyDatabase, priorSchema]) {
    if (!result.ownerDataPreserved || !result.currentReaderCompatible || !result.previousReaderCompatible) {
      throw new Error(`Executable migration verification failed in ${result.mode} mode`);
    }
  }
  return { report, emptyDatabase, priorSchema };
}

export class GitMigrationRepository implements MigrationRepository {
  constructor(private readonly root: string = process.cwd()) {}

  private git(args: readonly string[]): string {
    return execFileSync('git', [...args], {
      cwd: this.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });
  }

  diffNameStatus(baseSha: string, headSha: string): string {
    return this.git(['diff', '--name-status', `${baseSha}...${headSha}`, '--', 'supabase/migrations']);
  }

  listHeadMigrationPaths(headSha: string): string[] {
    return this.git(['ls-tree', '-r', '--name-only', headSha, '--', 'supabase/migrations'])
      .split(/\r?\n/u).filter(Boolean);
  }

  readHeadFile(file: string, headSha: string): string {
    return this.git(['show', `${headSha}:${file}`]);
  }

  readBaseFile(file: string, baseSha: string): string {
    return this.git(['show', `${baseSha}:${file}`]);
  }
}

export interface MigrationCommandRunner {
  run(command: string, args: readonly string[]): string;
}

class ExecMigrationCommandRunner implements MigrationCommandRunner {
  run(command: string, args: readonly string[]): string {
    return execFileSync(command, [...args], {
      cwd: process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'inherit']
    });
  }
}

function parseStatusEnv(output: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of output.split(/\r?\n/u)) {
    const match = /^([A-Z0-9_]+)=(?:"([^"]*)"|(.*))$/u.exec(line.trim());
    if (match) values[match[1]!] = match[2] ?? match[3] ?? '';
  }
  return values;
}

function migrationVersion(file: MigrationFile): string {
  const version = path.basename(file.path).match(/^(\d{14})_/u)?.[1];
  if (!version) throw new Error('Migration filename has no version');
  return version;
}

async function ownerSnapshot(client: PostgresQueryClient, owner: string): Promise<string> {
  const tables: Array<[string, string]> = [
    ['app_profile', 'id'], ['bet_draft', 'draft_id'], ['bet_record', 'bet_id'],
    ['bankroll_account', 'account_id'], ['bankroll_ledger_entry', 'entry_id'],
    ['discipline_config', 'owner_profile_id'], ['bet_settlement_event', 'settlement_event_id']
  ];
  const snapshot: Record<string, string[]> = {};
  for (const [table, orderColumn] of tables) {
    const ownerColumn = table === 'app_profile' ? 'id' : 'owner_profile_id';
    const result = await client.query<{ value: string }>(
      `select to_jsonb(value)::text as value from miraichi_app.${table} value where ${ownerColumn}=$1 order by ${orderColumn}`,
      [owner]
    );
    snapshot[table] = result.rows.map((row) => row.value);
  }
  return JSON.stringify(snapshot);
}

async function seedPriorOwnerData(client: PostgresQueryClient, owner: string): Promise<void> {
  const timestamp = '2026-09-16T12:00:00.000Z';
  await client.transaction(async (tx) => {
    await tx.query('insert into miraichi_app.app_profile (id,label,settings,created_at,updated_at) values ($1,$2,$3::jsonb,$4,$4)',
      [owner, 'Migration Owner', '{"locale":"vi","theme":"dark"}', timestamp]);
    await tx.query("insert into miraichi_app.bankroll_account (account_id,owner_profile_id,label,unit,opening_balance_points,current_balance_points,archived,created_at,updated_at) values ('account-preserve',$1,'Main','points',100,109,false,$2,$2)", [owner, timestamp]);
    await tx.query("insert into miraichi_app.bet_draft (draft_id,owner_profile_id,match_group_id,home_team_name,away_team_name,selection_label,market_type,odds_format,odds_value,stake_points,tags,created_at,updated_at) values ('draft-preserve',$1,'match-preserve','A','B','A','1X2','HK',0.9,10,'[]'::jsonb,$2,$2)", [owner, timestamp]);
    await tx.query("insert into miraichi_app.bet_record (bet_id,owner_profile_id,match_group_id,home_team_name,away_team_name,market_type,selection_label,odds_format,odds_value,stake_points,status,bankroll_account_id,settlement_type,profit_loss_points,settled_at,settlement_review_status,settlement_evidence_at,tags,created_at,updated_at) values ('bet-preserve',$1,'match-preserve','A','B','1X2','A','HK',0.9,10,'settled','account-preserve','full_win',9,$2,'auto_settled',$2,'[]'::jsonb,$2,$2)", [owner, timestamp]);
    await tx.query("insert into miraichi_app.discipline_config (owner_profile_id,daily_stop_loss_points,weekly_stop_loss_points,big_bet_threshold_points,time_zone,week_start_day,cooldown_seconds,version,updated_at) values ($1,10,30,20,'Asia/Tokyo','monday',15,1,$2)", [owner, timestamp]);
    await tx.query("insert into miraichi_app.bet_settlement_event (settlement_event_id,owner_profile_id,bet_id,bankroll_account_id,settlement_type,plan_adherence,calculated_profit_loss_points,ledger_delta_points,effective_at,occurred_at) values ('event-preserve',$1,'bet-preserve','account-preserve','full_win','yes',9,9,$2,$2)", [owner, timestamp]);
    await tx.query("insert into miraichi_app.bankroll_ledger_entry (entry_id,owner_profile_id,account_id,entry_type,amount_points,bet_id,settlement_event_id,effective_at,occurred_at,created_at) values ('entry-preserve',$1,'account-preserve','bet_settlement',9,'bet-preserve','event-preserve',$2,$2,$2)", [owner, timestamp]);
  });
}

async function constraintSupportsV2(client: PostgresQueryClient): Promise<boolean> {
  const result = await client.query<{ definition: string }>(
    "select pg_get_constraintdef(oid) as definition from pg_constraint where conname='backup_export_log_schema_version_check'"
  );
  return result.rows[0]?.definition.includes('miraichi.cloud-backup.v2') ?? false;
}

async function currentReaderWorks(client: PostgresQueryClient, owner: string): Promise<boolean> {
  const adapter = createSupabaseCloudPersistenceAdapter({ client, ownerProfileId: owner });
  const envelope = await adapter.exportOwnerData(owner, '2026-09-27T12:00:00.000Z');
  return envelope.schemaVersion === 'miraichi.cloud-backup.v3'
    && await verifyCloudBackupEnvelopeV3(envelope);
}

export function createLocalSupabaseMigrationRunner(options: {
  readonly runner?: MigrationCommandRunner;
  readonly root?: string;
} = {}): MigrationRunner {
  const root = options.root ?? process.cwd();
  const runner = options.runner ?? new ExecMigrationCommandRunner();
  const cliPath = path.join(root, 'node_modules', 'supabase', 'dist', 'supabase.js');
  const runSupabase = (args: readonly string[]): string => runner.run(process.execPath, [cliPath, ...args]);
  const databaseClient = (): CloseablePostgresQueryClient => {
    const databaseUrl = parseStatusEnv(runSupabase(['status', '-o', 'env'])).DB_URL;
    if (!databaseUrl) throw new Error('Local Supabase is unavailable; executable migration verification cannot pass');
    const parsed = new URL(databaseUrl);
    if (!['localhost', '127.0.0.1', '::1'].includes(parsed.hostname)) {
      throw new Error('Executable migration verification requires local Supabase');
    }
    return createPostgresQueryClient(databaseUrl);
  };
  return {
    verifyEmptyDatabase: async (migrations) => {
      runSupabase(['db', 'reset', '--local', '--no-seed']);
      const client = databaseClient();
      try {
        const applied = await client.query<{ count: number }>('select count(*)::int as count from supabase_migrations.schema_migrations');
        const ownerRows = await client.query<{ count: number }>('select count(*)::int as count from miraichi_app.app_profile');
        const currentReaderCompatible = await currentReaderWorks(client, 'migration-empty-owner');
        return {
          mode: 'empty',
          appliedMigrationCount: Number(applied.rows[0]?.count ?? 0),
          ownerDataPreserved: Number(ownerRows.rows[0]?.count ?? -1) === 0
            && Number(applied.rows[0]?.count ?? 0) === migrations.length,
          currentReaderCompatible,
          previousReaderCompatible: await constraintSupportsV2(client)
        };
      } finally {
        await client.close();
      }
    },
    verifyPriorSchema: async (migrations) => {
      const ordered = [...migrations].sort((left, right) => left.path.localeCompare(right.path));
      const firstAdded = ordered.findIndex((migration) => migration.change === 'added');
      if (firstAdded <= 0) throw new Error('Prior-schema verification requires at least one new migration');
      const priorVersion = migrationVersion(ordered[firstAdded - 1]!);
      runSupabase(['db', 'reset', '--local', '--no-seed', '--version', priorVersion]);
      const beforeClient = databaseClient();
      const owner = 'migration-preserve-owner';
      let before: string;
      try {
        await seedPriorOwnerData(beforeClient, owner);
        before = await ownerSnapshot(beforeClient, owner);
      } finally {
        await beforeClient.close();
      }
      runSupabase(['migration', 'up', '--local', '--include-all']);
      const afterClient = databaseClient();
      try {
        const after = await ownerSnapshot(afterClient, owner);
        const applied = await afterClient.query<{ count: number }>('select count(*)::int as count from supabase_migrations.schema_migrations');
        return {
          mode: 'prior',
          appliedMigrationCount: Number(applied.rows[0]?.count ?? 0),
          ownerDataPreserved: before === after && Number(applied.rows[0]?.count ?? 0) === migrations.length,
          currentReaderCompatible: await currentReaderWorks(afterClient, owner),
          previousReaderCompatible: await constraintSupportsV2(afterClient)
        };
      } finally {
        await afterClient.close();
      }
    }
  };
}

export function workingTreeMigrations(root: string = process.cwd(), addedSuffix = '_owner_backup_v3.sql'): MigrationFile[] {
  return readdirSync(path.join(root, 'supabase', 'migrations'))
    .filter((file) => /^\d{14}_[a-z0-9_]+\.sql$/u.test(file))
    .sort()
    .map((file) => ({
      path: `supabase/migrations/${file}`,
      sql: readFileSync(path.join(root, 'supabase', 'migrations', file), 'utf8'),
      change: file.endsWith(addedSuffix) ? 'added' as const : 'unchanged' as const
    }));
}

const isCli = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  const run = async (): Promise<void> => {
    const repository = new GitMigrationRepository();
    const git = (args: readonly string[]) => execFileSync('git', [...args], { encoding: 'utf8' }).trim();
    const headSha = process.env.GITHUB_SHA?.trim() || git(['rev-parse', 'HEAD']);
    const baseSha = process.env.MIGRATION_BASE_SHA?.trim()
      || process.env.GITHUB_BASE_SHA?.trim()
      || git(['merge-base', headSha, 'main']);
    const migrations = discoverMigrationSet({ repository, baseSha, headSha });
    const report = verifyMigrationSet({ baseSha, headSha, migrations });
    console.log(JSON.stringify({ status: report.ok ? 'passed' : 'failed', report }));
    process.exit(report.ok ? 0 : 1);
  };
  void run().catch(() => {
    console.error(JSON.stringify({ status: 'failed', code: 'migration_verification_failed' }));
    process.exit(1);
  });
}
