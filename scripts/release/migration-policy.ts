import { createHash } from 'node:crypto';

export type MigrationChange = 'added' | 'modified' | 'deleted' | 'unchanged';

export interface MigrationFile {
  readonly path: string;
  readonly sql: string;
  readonly change: MigrationChange;
}

export interface MigrationFinding {
  readonly path: string;
  readonly rule: string;
  readonly severity: 'error';
  readonly line: number;
  readonly message: string;
}

export interface MigrationReport {
  readonly baseSha: string;
  readonly headSha: string;
  readonly migrationHash: string;
  readonly checkedPaths: string[];
  readonly findings: MigrationFinding[];
  readonly ok: boolean;
}

const GIT_ID = /^[a-f0-9]{40}$/u;
const MIGRATION_PATH = /^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/u;
const OWNER_TABLE = '(?:app_profile|bet_draft|bet_record|bankroll_account|bankroll_ledger_entry|discipline_config|bet_settlement_event)';
const OWNER_TABLE_REF = `miraichi_app\\.${OWNER_TABLE}`;
const COMPATIBILITY_DECLARATION = /--\s*miraichi:compatibility\s+[A-Za-z0-9._-]+/iu;

function lineAt(sql: string, index: number): number {
  return sql.slice(0, Math.max(0, index)).split(/\r?\n/u).length;
}

function stripCommentsAndStrings(sql: string): string {
  return sql
    .replace(/\/\*[\s\S]*?\*\//gu, (value) => value.replace(/[^\n]/gu, ' '))
    .replace(/--[^\r\n]*/gu, (value) => ' '.repeat(value.length))
    .replace(/'(?:''|[^'])*'/gu, (value) => value.replace(/[^\n]/gu, ' '));
}

function finding(path: string, sql: string, rule: string, message: string, index = 0): MigrationFinding {
  return { path, rule, severity: 'error', line: lineAt(sql, index), message };
}

function addMatches(
  target: MigrationFinding[],
  path: string,
  originalSql: string,
  searchableSql: string,
  pattern: RegExp,
  rule: string,
  message: string
): void {
  for (const match of searchableSql.matchAll(pattern)) {
    target.push(finding(path, originalSql, rule, message, match.index ?? 0));
  }
}

function droppedConstraints(sql: string): string[] {
  return [...sql.matchAll(/\bdrop\s+constraint\s+(?:if\s+exists\s+)?([a-z_][a-z0-9_]*)/giu)]
    .map((match) => match[1]!.toLowerCase());
}

function addedConstraints(sql: string): Set<string> {
  return new Set([...sql.matchAll(/\badd\s+constraint\s+([a-z_][a-z0-9_]*)/giu)]
    .map((match) => match[1]!.toLowerCase()));
}

export function auditMigrationSql(path: string, sql: string): MigrationFinding[] {
  const findings: MigrationFinding[] = [];
  const searchable = stripCommentsAndStrings(sql);
  const ownerTable = new RegExp(OWNER_TABLE_REF, 'iu');

  const linkedReset = /\bsupabase\s+db\s+reset\b[^\r\n;]*--linked\b|--linked\b[^\r\n;]*\bsupabase\s+db\s+reset\b/giu;
  addMatches(findings, path, sql, sql, linkedReset, 'linked_reset', 'Linked database reset is forbidden in release automation');
  addMatches(findings, path, sql, searchable, /\btruncate(?:\s+table)?\b/giu, 'truncate', 'TRUNCATE is forbidden in production migrations');
  addMatches(findings, path, sql, searchable,
    new RegExp(`\\bdrop\\s+table(?:\\s+if\\s+exists)?\\s+${OWNER_TABLE_REF}\\b`, 'giu'),
    'owner_table_drop', 'Dropping a durable owner table is forbidden');
  addMatches(findings, path, sql, searchable,
    new RegExp(`\\balter\\s+table\\s+${OWNER_TABLE_REF}[\\s\\S]*?\\bdrop\\s+column\\b`, 'giu'),
    'owner_column_drop', 'Dropping a durable owner column is forbidden');
  addMatches(findings, path, sql, searchable,
    new RegExp(`\\balter\\s+table\\s+${OWNER_TABLE_REF}[\\s\\S]*?\\balter\\s+column\\s+[a-z_][a-z0-9_]*\\s+(?:set\\s+data\\s+)?type\\b`, 'giu'),
    'lossy_type_change', 'Owner column type changes require a separately reviewed compatibility migration');

  for (const statement of searchable.split(';')) {
    const normalized = statement.trim();
    if (!normalized) continue;
    const statementIndex = searchable.indexOf(statement);
    if (/^update\s+/iu.test(normalized) && ownerTable.test(normalized) && !/\bwhere\b/iu.test(normalized)) {
      findings.push(finding(path, sql, 'unbounded_owner_update', 'Owner-data UPDATE must have a bounded WHERE clause', statementIndex));
    }
    ownerTable.lastIndex = 0;
    if (/^delete\s+from\s+/iu.test(normalized) && ownerTable.test(normalized) && !/\bwhere\b/iu.test(normalized)) {
      findings.push(finding(path, sql, 'unbounded_owner_delete', 'Owner-data DELETE must have a bounded WHERE clause', statementIndex));
    }
    ownerTable.lastIndex = 0;
    const mutatesDurableTable = new RegExp(`\\b(?:create|alter)\\s+table(?:\\s+if\\s+not\\s+exists)?\\s+${OWNER_TABLE_REF}\\b`, 'iu').test(normalized);
    const cascadesFromOwnerData = new RegExp(`\\breferences\\s+${OWNER_TABLE_REF}\\s*\\([^)]*\\)[\\s\\S]*?\\bon\\s+delete\\s+cascade\\b`, 'iu').test(normalized);
    if (mutatesDurableTable && cascadesFromOwnerData) {
      findings.push(finding(path, sql, 'owner_delete_cascade', 'ON DELETE CASCADE in a durable owner table is forbidden', statementIndex));
    }
  }

  if (/\bexecute\b/iu.test(searchable) && !COMPATIBILITY_DECLARATION.test(sql)) {
    findings.push(finding(path, sql, 'dynamic_sql', 'Dynamic SQL requires an explicit compatibility declaration', searchable.search(/\bexecute\b/iu)));
  }

  if (!COMPATIBILITY_DECLARATION.test(sql)) {
    const added = addedConstraints(searchable);
    for (const dropped of droppedConstraints(searchable)) {
      if (!added.has(dropped)) {
        const index = searchable.search(new RegExp(`\\bdrop\\s+constraint\\s+(?:if\\s+exists\\s+)?${dropped}\\b`, 'iu'));
        findings.push(finding(path, sql, 'contract_removal', 'Constraint removal requires same-migration replacement or a compatibility declaration', index));
      }
    }
  }

  return findings.filter((item, index, all) =>
    all.findIndex((candidate) => candidate.rule === item.rule && candidate.line === item.line) === index);
}

export function migrationSetHash(migrations: readonly MigrationFile[]): string {
  const digest = createHash('sha256');
  for (const migration of [...migrations].filter((item) => item.change !== 'deleted').sort((a, b) => a.path.localeCompare(b.path))) {
    digest.update(migration.path, 'utf8');
    digest.update('\0');
    digest.update(migration.sql, 'utf8');
    digest.update('\0');
  }
  return digest.digest('hex');
}

export function verifyMigrationSet(input: {
  readonly baseSha: string;
  readonly headSha: string;
  readonly migrations: readonly MigrationFile[];
}): MigrationReport {
  if (!GIT_ID.test(input.baseSha) || !GIT_ID.test(input.headSha)) {
    throw new Error('Migration verification requires immutable lowercase Git SHAs');
  }
  const findings: MigrationFinding[] = [];
  for (const migration of input.migrations) {
    if (!MIGRATION_PATH.test(migration.path)) {
      findings.push(finding(migration.path, migration.sql, 'invalid_migration_path', 'Migration path must use a timestamped immutable filename'));
      continue;
    }
    if (migration.change === 'modified' || migration.change === 'deleted') {
      findings.push(finding(migration.path, migration.sql, 'historical_migration_changed', 'Historical migration files are immutable'));
    }
    if (migration.change === 'added' || migration.change === 'modified') {
      findings.push(...auditMigrationSql(migration.path, migration.sql));
    }
  }
  return {
    baseSha: input.baseSha,
    headSha: input.headSha,
    migrationHash: migrationSetHash(input.migrations),
    checkedPaths: input.migrations.filter((migration) => migration.change !== 'unchanged').map((migration) => migration.path).sort(),
    findings,
    ok: findings.length === 0
  };
}
