# Phase 9 Cloud Persistence for Four Non-AI Tabs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add owner-only Supabase Postgres persistence behind `apps/api` so Today, Matches, Bets, and Bankroll work with durable records while the Miraichi AI tab, public auth, betting formulas, live data, and AI training remain disabled.

**Architecture:** The browser continues to call only `apps/api`. The API uses a tested persistence adapter with disabled, in-memory test, and Supabase Postgres implementations. Local national-team snapshots remain the manually updated source of truth; an explicit sync command copies them to Supabase, and API match reads may fall back to the cloud copy when the local snapshot is missing. Bets, bankroll, and backup workflows are server-mediated and owner-only.

**Tech Stack:** TypeScript, Node.js HTTP handlers, Vitest, pnpm workspaces, `pg` with parameterized SQL, Supabase hosted Postgres, private Postgres schema, JSON backup envelopes.

---

## Accepted Decisions

- ADR-0043 is accepted: Supabase hosted Postgres is the Phase 9 provider.
- Runtime path is `apps/web -> apps/api -> Supabase Postgres`.
- `apps/web` must not import `@supabase/supabase-js`, contain a database URL, or receive a service-role/secret key.
- Phase 9 remains owner-only. Public signup, login, sessions, and multi-user row ownership need a later ADR.
- Local national-team data remains manually updated. There is no live polling.
- World Cup and Euro remain the current match-data priority.
- The only bankroll arithmetic allowed in this phase is deterministic ledger balance reconciliation. ROI, yield, CLV, Kelly, risk sizing, recommended stake, expected return, and betting advice remain forbidden.
- The Miraichi AI tab remains honest-unavailable and receives no cloud model/runtime work.

## Required Runtime Modes

```text
CLOUD_PERSISTENCE_MODE=disabled
CLOUD_PERSISTENCE_MODE=memory
CLOUD_PERSISTENCE_MODE=supabase
```

- `disabled` is the default when cloud configuration is absent.
- `memory` is for unit and integration tests only.
- `supabase` requires `SUPABASE_DATABASE_URL`.
- `memory` must be rejected when `APP_ENV` is `staging` or `production`.
- Missing cloud configuration must return `cloud_persistence_unconfigured`; it must not silently return mock records.

## API Surface

```text
GET    /api/v1/cloud-persistence/status

GET    /api/v1/bet-drafts
POST   /api/v1/bet-drafts
PUT    /api/v1/bet-drafts?id=<draftId>
DELETE /api/v1/bet-drafts?id=<draftId>

GET    /api/v1/bets
POST   /api/v1/bets
PATCH  /api/v1/bets?id=<betId>

GET    /api/v1/bankroll/accounts
POST   /api/v1/bankroll/accounts
PATCH  /api/v1/bankroll/accounts?id=<accountId>
GET    /api/v1/bankroll/ledger?accountId=<accountId>
POST   /api/v1/bankroll/ledger

POST   /api/v1/backups/export
POST   /api/v1/backups/import
GET    /api/v1/backups/log
```

The existing match endpoints remain stable:

```text
GET /api/v1/matches
GET /api/v1/matches/detail?id=<matchId>
GET /api/v1/data-snapshot/status
```

## File Structure Map

```text
packages/shared/src/contracts/cloud-persistence-contracts.ts
packages/shared/src/contracts/cloud-persistence-contracts.test.ts
packages/shared/src/contracts/index.ts

apps/api/src/config/cloud-persistence-config.ts
apps/api/src/config/cloud-persistence-config.test.ts
apps/api/src/persistence/cloud-persistence-adapter.ts
apps/api/src/persistence/memory-cloud-persistence-adapter.ts
apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts
apps/api/src/persistence/create-cloud-persistence-adapter.ts
apps/api/src/persistence/create-cloud-persistence-adapter.test.ts
apps/api/src/persistence/supabase/postgres-query-client.ts
apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.ts
apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts
apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.sql
apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.test.ts
apps/api/src/services/cloud-match-snapshot-sync.ts
apps/api/src/services/cloud-match-snapshot-sync.test.ts
apps/api/src/repositories/cloud-match-snapshot-repository.ts
apps/api/src/repositories/cloud-match-snapshot-repository.test.ts
apps/api/src/repositories/fallback-match-snapshot-repository.ts
apps/api/src/repositories/fallback-match-snapshot-repository.test.ts
apps/api/src/routes/cloud-persistence-status.ts
apps/api/src/routes/cloud-persistence-status.test.ts
apps/api/src/routes/bet-drafts.ts
apps/api/src/routes/bet-drafts.test.ts
apps/api/src/routes/bets.ts
apps/api/src/routes/bets.test.ts
apps/api/src/routes/bankroll.ts
apps/api/src/routes/bankroll.test.ts
apps/api/src/routes/backups.ts
apps/api/src/routes/backups.test.ts
apps/api/src/index.ts
apps/api/package.json

apps/web/src/services/cloud-persistence-service.ts
apps/web/src/services/cloud-persistence-service.test.ts
apps/web/src/services/bet-record-service.ts
apps/web/src/services/bet-record-service.test.ts
apps/web/src/services/bankroll-service.ts
apps/web/src/services/bankroll-service.test.ts
apps/web/src/services/backup-service.ts
apps/web/src/services/backup-service.test.ts
apps/web/src/components/app-shell.ts
apps/web/src/production-shell.test.ts
apps/web/src/shell-entry.ts

scripts/sync-national-team-data-to-cloud.ts
scripts/sync-national-team-data-to-cloud.test.ts
scripts/phase9-cloud-persistence-verify.ts
scripts/phase9-cloud-persistence-verify.test.ts
scripts/test-endpoints.ts

.env.example
package.json
pnpm-lock.yaml
PROJECT_PLAN.md
docs/decisions/ADR-0043-phase-9-cloud-database-provider.md
```

## Task 1: Shared Cloud Persistence Contracts

**Purpose:** Define exact owner-only records and validators before database or route work.

**Files:**

- Create `packages/shared/src/contracts/cloud-persistence-contracts.ts`
- Create `packages/shared/src/contracts/cloud-persistence-contracts.test.ts`
- Modify `packages/shared/src/contracts/index.ts`

- [ ] **Step 1: Write the failing contract tests**

Add tests that construct valid cloud status, bet, bankroll, and backup records:

```ts
import { describe, expect, it } from 'vitest';
import {
  validateBankrollLedgerEntry,
  validateCloudBetRecord,
  validateCloudPersistenceStatus
} from './cloud-persistence-contracts.js';

describe('cloud persistence contracts', () => {
  it('accepts owner-entered pending bet records', () => {
    expect(validateCloudBetRecord({
      betId: 'bet-001',
      ownerProfileId: 'owner-primary',
      matchGroupId: 'match-group-001',
      homeTeamName: 'Japan',
      awayTeamName: 'Vietnam',
      marketType: '1X2',
      selectionLabel: 'Japan',
      oddsFormat: 'HK',
      oddsValue: 0.9,
      stakePoints: 10,
      status: 'pending',
      createdAt: '2026-07-02T00:00:00.000Z',
      updatedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('rejects forbidden formula and AI fields', () => {
    expect(validateCloudBetRecord({
      betId: 'bet-001',
      ownerProfileId: 'owner-primary',
      roi: 12,
      recommendedStake: 20,
      predictionTraceId: 'trace-001'
    })).toMatchObject({ ok: false });
  });

  it('accepts signed manual ledger amounts but no risk fields', () => {
    expect(validateBankrollLedgerEntry({
      entryId: 'entry-001',
      ownerProfileId: 'owner-primary',
      accountId: 'account-001',
      entryType: 'deposit',
      amountPoints: 1000,
      occurredAt: '2026-07-02T00:00:00.000Z',
      createdAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });

  it('represents missing cloud configuration honestly', () => {
    expect(validateCloudPersistenceStatus({
      provider: 'supabase-postgres',
      mode: 'disabled',
      state: 'unconfigured',
      checkedAt: '2026-07-02T00:00:00.000Z'
    })).toEqual({ ok: true });
  });
});
```

- [ ] **Step 2: Run the test and observe the required failure**

```powershell
pnpm exec vitest run packages/shared/src/contracts/cloud-persistence-contracts.test.ts
```

Expected: fail because `cloud-persistence-contracts.ts` does not exist.

- [ ] **Step 3: Implement exact TypeScript contracts**

Define:

```ts
export type CloudPersistenceMode = 'disabled' | 'memory' | 'supabase';
export type CloudPersistenceState = 'unconfigured' | 'ready' | 'unavailable';

export interface CloudPersistenceStatus {
  provider: 'supabase-postgres';
  mode: CloudPersistenceMode;
  state: CloudPersistenceState;
  checkedAt: string;
  message?: string;
}

export interface CloudBetRecord {
  betId: string;
  ownerProfileId: string;
  matchGroupId: string;
  matchId?: string | null;
  homeTeamName: string;
  awayTeamName: string;
  competitionLabel?: string;
  seasonLabel?: string;
  marketType: '1X2' | 'over_under' | 'handicap' | 'corners' | 'custom';
  customMarketLabel?: string;
  selectionLabel: string;
  lineValue?: number | null;
  oddsFormat: 'HK';
  oddsValue: number;
  stakePoints: number;
  status: 'pending' | 'settled' | 'void';
  settlementNote?: string;
  manualResultPoints?: number | null;
  notes?: string;
  tags?: readonly string[];
  createdAt: string;
  updatedAt: string;
}

export interface CloudMatchSnapshot {
  snapshotId: string;
  generatedAt: string;
  importedAt: string;
  sources: LocalMatchSourceRef[];
  matches: LocalMatch[];
}

export interface BankrollAccount {
  accountId: string;
  ownerProfileId: string;
  label: string;
  unit: 'points';
  openingBalancePoints: number;
  currentBalancePoints: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BankrollLedgerEntryType =
  | 'deposit'
  | 'withdrawal'
  | 'transfer_in'
  | 'transfer_out'
  | 'correction';

export interface BankrollLedgerEntry {
  entryId: string;
  ownerProfileId: string;
  accountId: string;
  entryType: BankrollLedgerEntryType;
  amountPoints: number;
  note?: string;
  occurredAt: string;
  createdAt: string;
}

export interface CreateBankrollAccountInput {
  accountId: string;
  ownerProfileId: string;
  label: string;
  openingBalancePoints: number;
}

export interface UpdateBankrollAccountInput {
  accountId: string;
  ownerProfileId: string;
  label?: string;
  archived?: boolean;
}

export interface CreateBankrollLedgerEntryInput {
  entryId: string;
  ownerProfileId: string;
  accountId: string;
  entryType: BankrollLedgerEntryType;
  amountPoints: number;
  note?: string;
  occurredAt: string;
}

export interface CloudBackupEnvelope {
  schemaVersion: 'miraichi.cloud-backup.v1';
  exportedAt: string;
  ownerProfileId: string;
  drafts: AddBetDraft[];
  bets: CloudBetRecord[];
  bankrollAccounts: BankrollAccount[];
  bankrollLedgerEntries: BankrollLedgerEntry[];
}

export interface BackupExportReceipt {
  exportId: string;
  ownerProfileId: string;
  schemaVersion: 'miraichi.cloud-backup.v1';
  exportedAt: string;
  sha256: string;
  recordCounts: {
    betDrafts: number;
    bets: number;
    bankrollAccounts: number;
    bankrollLedgerEntries: number;
  };
}
```

Add validators that reject these keys anywhere in accepted write payloads:

```ts
export const FORBIDDEN_CLOUD_FIELDS = [
  'roi',
  'yield',
  'clv',
  'kelly',
  'recommendedStake',
  'recommendedStakePoints',
  'riskLimit',
  'riskScore',
  'expectedReturn',
  'predictionTraceId',
  'recommendationId'
] as const;
```

Export existing `AddBetDraft`, `LocalMatch`, and the new cloud contracts through `packages/shared/src/contracts/index.ts`.

- [ ] **Step 4: Run focused verification**

```powershell
pnpm exec vitest run packages/shared/src/contracts/cloud-persistence-contracts.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit the slice**

```powershell
git add packages/shared/src/contracts/cloud-persistence-contracts.ts packages/shared/src/contracts/cloud-persistence-contracts.test.ts packages/shared/src/contracts/index.ts
git commit -m "feat(shared): add phase 9 cloud persistence contracts"
```

## Task 2: Server-Only Configuration and Adapter Factory

**Purpose:** Make runtime selection explicit and prevent cloud secrets from entering browser code.

**Files:**

- Create `apps/api/src/config/cloud-persistence-config.ts`
- Create `apps/api/src/config/cloud-persistence-config.test.ts`
- Create `apps/api/src/persistence/cloud-persistence-adapter.ts`
- Create `apps/api/src/persistence/create-cloud-persistence-adapter.ts`
- Create `apps/api/src/persistence/create-cloud-persistence-adapter.test.ts`
- Modify `.env.example`

- [ ] **Step 1: Write failing configuration tests**

```ts
import { describe, expect, it } from 'vitest';
import { readCloudPersistenceConfig } from './cloud-persistence-config.js';

describe('cloud persistence config', () => {
  it('defaults to disabled without a database URL', () => {
    expect(readCloudPersistenceConfig({ APP_ENV: 'local' })).toMatchObject({
      mode: 'disabled',
      ownerProfileId: 'owner-primary'
    });
  });

  it('requires a database URL in supabase mode', () => {
    expect(() => readCloudPersistenceConfig({
      APP_ENV: 'local',
      CLOUD_PERSISTENCE_MODE: 'supabase'
    })).toThrow('SUPABASE_DATABASE_URL is required');
  });

  it('rejects memory mode outside local and test', () => {
    expect(() => readCloudPersistenceConfig({
      APP_ENV: 'staging',
      CLOUD_PERSISTENCE_MODE: 'memory'
    })).toThrow('memory cloud persistence is test-only');
  });
});
```

Add a source audit test to `create-cloud-persistence-adapter.test.ts`:

```ts
expect(webSource).not.toMatch(
  /SUPABASE_DATABASE_URL|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_SUPABASE|VITE_SUPABASE/
);
```

- [ ] **Step 2: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/config/cloud-persistence-config.test.ts apps/api/src/persistence/create-cloud-persistence-adapter.test.ts
```

Expected: fail because config and factory modules do not exist.

- [ ] **Step 3: Implement configuration**

```ts
export interface CloudPersistenceConfig {
  mode: 'disabled' | 'memory' | 'supabase';
  appEnv: string;
  ownerProfileId: string;
  databaseUrl?: string;
}

export function readCloudPersistenceConfig(
  env: NodeJS.ProcessEnv = process.env
): CloudPersistenceConfig;
```

Rules:

- Default `ownerProfileId` is `owner-primary`.
- Default mode is `disabled`.
- `supabase` requires `SUPABASE_DATABASE_URL`.
- Database URLs must not be returned by status endpoints or error messages.
- Factory accepts config and returns a disabled, memory, or Supabase adapter.

- [ ] **Step 4: Update `.env.example`**

Replace the generic active database placeholder with:

```dotenv
# Phase 9 owner-only cloud persistence. Keep this URL server-side.
CLOUD_PERSISTENCE_MODE=disabled
SUPABASE_DATABASE_URL=
MIRAICHI_OWNER_PROFILE_ID=owner-primary
```

Do not add:

```text
VITE_SUPABASE_*
NEXT_PUBLIC_SUPABASE_*
SUPABASE_SERVICE_ROLE_KEY
```

- [ ] **Step 5: Verify**

```powershell
pnpm exec vitest run apps/api/src/config/cloud-persistence-config.test.ts apps/api/src/persistence/create-cloud-persistence-adapter.test.ts
rg "SUPABASE_DATABASE_URL|SUPABASE_SERVICE_ROLE|NEXT_PUBLIC_SUPABASE|VITE_SUPABASE" apps/web public
```

Expected: tests pass and `rg` returns no browser/runtime hits.

- [ ] **Step 6: Commit the slice**

```powershell
git add .env.example apps/api/src/config apps/api/src/persistence/cloud-persistence-adapter.ts apps/api/src/persistence/create-cloud-persistence-adapter.ts apps/api/src/persistence/create-cloud-persistence-adapter.test.ts
git commit -m "feat(api): add server-only cloud persistence boundary"
```

## Task 3: In-Memory Persistence Adapter

**Purpose:** Prove CRUD and bookkeeping behavior without a remote database.

**Files:**

- Create `apps/api/src/persistence/memory-cloud-persistence-adapter.ts`
- Create `apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts`

- [ ] **Step 1: Write failing adapter tests**

Cover:

- Draft save/list/update/delete.
- Bet create/list/update.
- Account create/update/archive.
- Ledger entry creation updates only the target account balance.
- Duplicate IDs are rejected.
- Returned arrays and tags are cloned.
- No ROI, CLV, Kelly, risk, or stake recommendation value is produced.

Use the required balance test:

```ts
it('reconciles signed manual ledger entries without betting advice', async () => {
  const adapter = createMemoryCloudPersistenceAdapter({ now: fixedNow });
  await adapter.createBankrollAccount({
    accountId: 'account-001',
    ownerProfileId: 'owner-primary',
    label: 'Main',
    unit: 'points',
    openingBalancePoints: 1000
  });

  await adapter.createBankrollLedgerEntry({
    entryId: 'entry-001',
    ownerProfileId: 'owner-primary',
    accountId: 'account-001',
    entryType: 'withdrawal',
    amountPoints: -100,
    occurredAt: '2026-07-02T00:00:00.000Z'
  });

  expect(await adapter.listBankrollAccounts('owner-primary')).toMatchObject([
    { accountId: 'account-001', currentBalancePoints: 900 }
  ]);
});
```

- [ ] **Step 2: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts
```

Expected: fail because the adapter does not exist.

- [ ] **Step 3: Implement the adapter contract**

The interface must include:

```ts
export interface CloudPersistenceAdapter {
  getStatus(): Promise<CloudPersistenceStatus>;
  saveBetDraft(ownerProfileId: string, draft: AddBetDraft): Promise<AddBetDraft>;
  listBetDrafts(ownerProfileId: string): Promise<readonly AddBetDraft[]>;
  deleteBetDraft(ownerProfileId: string, draftId: string): Promise<boolean>;
  createBetRecord(record: CloudBetRecord): Promise<CloudBetRecord>;
  listBetRecords(ownerProfileId: string): Promise<readonly CloudBetRecord[]>;
  updateBetRecord(record: CloudBetRecord): Promise<CloudBetRecord>;
  createBankrollAccount(input: CreateBankrollAccountInput): Promise<BankrollAccount>;
  listBankrollAccounts(ownerProfileId: string): Promise<readonly BankrollAccount[]>;
  updateBankrollAccount(input: UpdateBankrollAccountInput): Promise<BankrollAccount>;
  createBankrollLedgerEntry(input: CreateBankrollLedgerEntryInput): Promise<BankrollLedgerEntry>;
  listBankrollLedgerEntries(ownerProfileId: string, accountId: string): Promise<readonly BankrollLedgerEntry[]>;
  upsertMatchSnapshot(ownerProfileId: string, snapshot: CloudMatchSnapshot): Promise<void>;
  listCloudMatches(ownerProfileId: string, query: LocalMatchSnapshotQuery): Promise<LocalMatchFeedResponse>;
  findCloudMatchById(ownerProfileId: string, matchId: string): Promise<LocalMatch | null>;
  getCloudMatchSnapshotStatus(ownerProfileId: string): Promise<LocalDataSnapshotStatus>;
  exportOwnerData(ownerProfileId: string, exportedAt: string): Promise<CloudBackupEnvelope>;
  importOwnerData(ownerProfileId: string, envelope: CloudBackupEnvelope): Promise<void>;
  recordBackupExport(receipt: BackupExportReceipt): Promise<void>;
  listBackupExports(ownerProfileId: string): Promise<readonly BackupExportReceipt[]>;
}
```

The memory adapter must be deterministic and dependency-injected. It must not be imported directly by production routes; routes receive the interface.

- [ ] **Step 4: Verify**

```powershell
pnpm exec vitest run apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit the slice**

```powershell
git add apps/api/src/persistence/cloud-persistence-adapter.ts apps/api/src/persistence/memory-cloud-persistence-adapter.ts apps/api/src/persistence/memory-cloud-persistence-adapter.test.ts
git commit -m "feat(api): add memory cloud persistence adapter"
```

## Task 4: Private Supabase Postgres Schema

**Purpose:** Define a private, server-only relational schema with explicit constraints and no Data API exposure.

**Files:**

- Create `apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.sql`
- Create `apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.test.ts`

- [ ] **Step 1: Write the failing SQL contract test**

The test reads the SQL file and asserts:

```ts
expect(sql).toContain('create schema if not exists miraichi_app');
expect(sql).toContain('enable row level security');
expect(sql).toContain('revoke all on schema miraichi_app from anon, authenticated');
expect(sql).not.toMatch(/grant\s+.+\s+to\s+(anon|authenticated)/i);
expect(sql).not.toMatch(/security\s+definer/i);
expect(sql).not.toMatch(/\b(roi|yield|clv|kelly|recommended_stake|risk_score)\b/i);
```

Also assert all seven ADR categories plus the separate draft implementation table exist:

```text
app_profile
match_snapshot
match_record
bet_draft
bet_record
bankroll_account
bankroll_ledger_entry
backup_export_log
```

`bet_draft` is an implementation detail under the ADR-approved `bet_record` draft/history category.

- [ ] **Step 2: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.test.ts
```

Expected: fail because the SQL file does not exist.

- [ ] **Step 3: Create the schema SQL**

The SQL must:

- Create private schema `miraichi_app`.
- Create the eight tables listed above.
- Use text IDs because local snapshot and draft IDs are already stable text identifiers.
- Use `numeric(18,4)` for points and odds values.
- Use `timestamptz` for all timestamps.
- Use `jsonb` only for source refs, tags, settings, and backup counts.
- Add foreign keys from owner records to `app_profile`.
- Add foreign keys from ledger entries to accounts.
- Add unique `(owner_profile_id, entry_id)` and equivalent identity constraints.
- Add status checks matching shared contracts.
- Add `amount_points <> 0` on ledger entries.
- Add indexes:

```sql
create index if not exists bet_record_owner_status_updated_idx
  on miraichi_app.bet_record (owner_profile_id, status, updated_at desc);

create index if not exists bankroll_ledger_owner_account_occurred_idx
  on miraichi_app.bankroll_ledger_entry
  (owner_profile_id, account_id, occurred_at desc);

create index if not exists match_record_kickoff_status_idx
  on miraichi_app.match_record (kickoff_utc, status);
```

- Enable RLS on every table.
- Create no public policies in Phase 9.
- Revoke schema/table privileges from `anon` and `authenticated`.
- Create no view, function, trigger, or `security definer` block.

- [ ] **Step 4: Verify the SQL contract**

```powershell
pnpm exec vitest run apps/api/src/persistence/supabase/sql/phase9-cloud-persistence.test.ts
```

Expected: pass.

- [ ] **Step 5: Create the Supabase migration only when CLI execution begins**

At execution time:

```powershell
pnpm exec supabase --version
pnpm exec supabase migration new phase9_cloud_persistence
```

Copy the reviewed SQL into the CLI-generated migration file. Do not invent the timestamped migration filename in advance.

Before committing a remote-ready migration:

```powershell
pnpm exec supabase db advisors --help
pnpm exec supabase migration list --local
```

If the installed CLI does not support advisors, use the Supabase MCP advisor tool or record the exact missing capability. Do not report an advisor pass without running one.

- [ ] **Step 6: Commit the slice**

```powershell
git add apps/api/src/persistence/supabase/sql
git commit -m "feat(db): define private phase 9 persistence schema"
```

## Task 5: Supabase Postgres Adapter

**Purpose:** Implement parameterized database access behind the adapter interface.

**Files:**

- Create `apps/api/src/persistence/supabase/postgres-query-client.ts`
- Create `apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.ts`
- Create `apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts`
- Modify `apps/api/package.json`
- Modify `pnpm-lock.yaml`

- [ ] **Step 1: Write failing query tests with a fake client**

Define the injectable boundary:

```ts
export interface PostgresQueryClient {
  query<T extends Record<string, unknown>>(
    text: string,
    values?: readonly unknown[]
  ): Promise<{ rows: T[]; rowCount: number }>;
}
```

Tests must assert:

- SQL uses `$1`, `$2`, and values arrays.
- User values never appear interpolated in SQL text.
- Owner profile ID is included in every owner-data query.
- Ledger insertion and account balance update use one transaction callback.
- Database error messages are mapped without including the connection string.
- Match upsert is idempotent on `id`.
- Snapshot upsert is idempotent on `snapshot_id`.

- [ ] **Step 2: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts
```

Expected: fail because the adapter does not exist.

- [ ] **Step 3: Install the server-only dependency**

```powershell
pnpm --filter api add pg
pnpm --filter api add -D @types/pg
```

Do not install `@supabase/supabase-js` in `apps/web`.

- [ ] **Step 4: Implement the pool and adapter**

`postgres-query-client.ts` must:

- Create a `pg.Pool` only in `supabase` mode.
- Set `max: 5`.
- Set `idleTimeoutMillis: 30000`.
- Set `connectionTimeoutMillis: 10000`.
- Accept Supabase's TLS connection string and never set `rejectUnauthorized: false`.
- Expose a transaction helper that always releases the client in `finally`.

`supabase-cloud-persistence-adapter.ts` must:

- Map snake_case rows to shared camelCase contracts.
- Use parameterized queries only.
- Use `insert ... on conflict ... do update` for snapshots and matches.
- Sort drafts and records by `updated_at desc`.
- Apply ledger entry insertion and account balance reconciliation in one transaction.
- Reject owner mismatch before querying.
- Return `state: 'unavailable'` on connectivity failure without returning credentials.

- [ ] **Step 5: Verify**

```powershell
pnpm exec vitest run apps/api/src/persistence/supabase/supabase-cloud-persistence-adapter.test.ts
pnpm run typecheck
rg "@supabase/supabase-js|SUPABASE_DATABASE_URL|SUPABASE_SERVICE_ROLE" apps/web
```

Expected: tests pass and browser search returns no matches.

- [ ] **Step 6: Commit the slice**

```powershell
git add apps/api/package.json pnpm-lock.yaml apps/api/src/persistence/supabase
git commit -m "feat(api): add supabase postgres persistence adapter"
```

## Task 6: Cloud Status, Bets, and Draft API Routes

**Purpose:** Replace mock bet history with real owner-only CRUD and honest cloud status.

**Files:**

- Create `apps/api/src/routes/cloud-persistence-status.ts`
- Create `apps/api/src/routes/cloud-persistence-status.test.ts`
- Create `apps/api/src/routes/bet-drafts.ts`
- Create `apps/api/src/routes/bet-drafts.test.ts`
- Create `apps/api/src/routes/bets.ts`
- Create `apps/api/src/routes/bets.test.ts`
- Modify `apps/api/src/index.ts`
- Delete `apps/api/src/routes/bet-history.mock.ts`

- [ ] **Step 1: Write failing route tests**

Test:

- Disabled status returns `200` with `state: 'unconfigured'`.
- Draft and bet mutations return `503 cloud_persistence_unconfigured` when disabled.
- Memory-injected routes create/list/update/delete drafts.
- Bet creation rejects formula/AI fields.
- Settled records can be read but only explicit allowed fields can be patched.
- Unknown IDs return `404`.
- Invalid JSON returns the existing `invalid_json_body` contract.

- [ ] **Step 2: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/routes/cloud-persistence-status.test.ts apps/api/src/routes/bet-drafts.test.ts apps/api/src/routes/bets.test.ts
```

Expected: fail because handlers do not exist and `/api/v1/bets` still uses mock data.

- [ ] **Step 3: Implement handlers**

Use dependency injection:

```ts
export interface CloudRouteDependencies {
  adapter: CloudPersistenceAdapter;
  ownerProfileId: string;
  now?: () => Date;
}
```

Every write handler must:

1. Parse JSON through `apps/api/src/routes/json-body.ts`.
2. Add the configured owner profile ID server-side.
3. Validate the shared contract.
4. Reject client-supplied `ownerProfileId` when it differs.
5. Return stable errors:

```text
cloud_persistence_unconfigured
cloud_persistence_unavailable
invalid_cloud_record
bet_draft_not_found
bet_record_not_found
```

- [ ] **Step 4: Register routes**

Update `apps/api/src/index.ts` method/path routing for the API surface in this plan. Expand CORS methods to:

```text
GET, POST, PUT, PATCH, DELETE, OPTIONS
```

Create the adapter once at process startup after env loading and inject it into route calls.

- [ ] **Step 5: Remove mock bet history**

Delete `apps/api/src/routes/bet-history.mock.ts` only after route tests pass and `apps/api/src/index.ts` no longer imports it.

- [ ] **Step 6: Verify**

```powershell
pnpm exec vitest run apps/api/src/routes/cloud-persistence-status.test.ts apps/api/src/routes/bet-drafts.test.ts apps/api/src/routes/bets.test.ts apps/api/src/routes/json-body.test.ts
rg "bet-history.mock|MOCK_BETS" apps/api/src
```

Expected: tests pass and runtime search returns no matches.

- [ ] **Step 7: Commit the slice**

```powershell
git add apps/api/src/index.ts apps/api/src/routes
git commit -m "feat(api): add cloud bet and draft routes"
```

## Task 7: Bankroll and Backup API Routes

**Purpose:** Add real capital management and recoverable exports without betting recommendations.

**Files:**

- Create `apps/api/src/routes/bankroll.ts`
- Create `apps/api/src/routes/bankroll.test.ts`
- Create `apps/api/src/routes/backups.ts`
- Create `apps/api/src/routes/backups.test.ts`
- Modify `apps/api/src/index.ts`

- [ ] **Step 1: Write failing bankroll tests**

Required cases:

- Create a points-only account.
- Reject non-points units.
- Create positive deposit and negative withdrawal entries.
- Reject zero amount.
- Return ledger newest-first.
- Archive an account.
- Reject ledger writes to archived accounts.
- Verify no response contains ROI, risk, Kelly, expected return, or recommended stake fields.

- [ ] **Step 2: Write failing backup tests**

Required cases:

- Export returns `miraichi.cloud-backup.v1`.
- Export contains drafts, bets, accounts, and ledger entries.
- Export SHA-256 is deterministic for canonical JSON.
- Export writes `backup_export_log`.
- Import validates the complete envelope before writing.
- Duplicate IDs return `backup_import_conflict`.
- Import never partially writes a malformed envelope.

- [ ] **Step 3: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/routes/bankroll.test.ts apps/api/src/routes/backups.test.ts
```

Expected: fail because handlers do not exist.

- [ ] **Step 4: Implement bankroll handlers**

The server accepts signed `amountPoints`. The API must not infer stake size, affordability, risk, or recommended allocation.

Return:

```ts
{
  account: BankrollAccount,
  ledgerEntry: BankrollLedgerEntry
}
```

after a successful ledger write.

- [ ] **Step 5: Implement backup handlers**

Canonical export order:

1. Drafts by `draftId`.
2. Bets by `betId`.
3. Accounts by `accountId`.
4. Ledger by `entryId`.

Hash the UTF-8 canonical JSON using Node `crypto.createHash('sha256')`.

Import must call one adapter transaction method so validation and writes are atomic in Supabase mode.

- [ ] **Step 6: Verify**

```powershell
pnpm exec vitest run apps/api/src/routes/bankroll.test.ts apps/api/src/routes/backups.test.ts
pnpm run typecheck
```

Expected: pass.

- [ ] **Step 7: Commit the slice**

```powershell
git add apps/api/src/index.ts apps/api/src/routes/bankroll.ts apps/api/src/routes/bankroll.test.ts apps/api/src/routes/backups.ts apps/api/src/routes/backups.test.ts
git commit -m "feat(api): add bankroll ledger and backup routes"
```

## Task 8: Manual Match Snapshot Cloud Sync and Fallback

**Purpose:** Preserve manual local updates while making Today and Matches resilient to a missing local file.

**Files:**

- Create `apps/api/src/services/cloud-match-snapshot-sync.ts`
- Create `apps/api/src/services/cloud-match-snapshot-sync.test.ts`
- Create `apps/api/src/repositories/cloud-match-snapshot-repository.ts`
- Create `apps/api/src/repositories/cloud-match-snapshot-repository.test.ts`
- Create `apps/api/src/repositories/fallback-match-snapshot-repository.ts`
- Create `apps/api/src/repositories/fallback-match-snapshot-repository.test.ts`
- Modify `apps/api/src/routes/matches.ts`
- Modify `apps/api/src/routes/match-detail.ts`
- Modify `apps/api/src/routes/data-snapshot-status.ts`
- Create `scripts/sync-national-team-data-to-cloud.ts`
- Create `scripts/sync-national-team-data-to-cloud.test.ts`
- Modify `package.json`

- [ ] **Step 1: Write failing sync tests**

Test that:

- The service reads the validated local snapshot.
- It upserts one snapshot plus all matches.
- Running it twice produces the same cloud record count.
- It refuses `in_play` status.
- It refuses club competition type.
- Disabled cloud mode fails with `cloud_persistence_unconfigured`.

- [ ] **Step 2: Write failing fallback tests**

Required behavior:

- Local repository success wins.
- Local missing plus cloud ready returns cloud data.
- Local invalid does not silently fall back; it returns the validation failure.
- Local missing plus cloud unavailable returns the local missing error with a cloud warning.
- Cloud fallback response adds `cloud_snapshot_fallback` to `snapshot.warnings`.

- [ ] **Step 3: Observe failure**

```powershell
pnpm exec vitest run apps/api/src/services/cloud-match-snapshot-sync.test.ts apps/api/src/repositories/cloud-match-snapshot-repository.test.ts apps/api/src/repositories/fallback-match-snapshot-repository.test.ts scripts/sync-national-team-data-to-cloud.test.ts
```

Expected: fail because the services and repositories do not exist.

- [ ] **Step 4: Implement the sync command**

Add root script:

```json
{
  "scripts": {
    "data:sync:national-teams:cloud": "tsx scripts/sync-national-team-data-to-cloud.ts"
  }
}
```

CLI output:

```text
Synced national-team snapshot <snapshotId>: <matchCount> matches to supabase-postgres
```

Do not run automatically on API startup. The owner requested manual daily updates.

- [ ] **Step 5: Implement local-first fallback**

Create a small repository interface shared by the three match routes. The fallback repository catches only `local_snapshot_missing`; it must not hide malformed local data.

Update route tests so existing endpoint contracts remain stable.

- [ ] **Step 6: Verify**

```powershell
pnpm exec vitest run apps/api/src/services/cloud-match-snapshot-sync.test.ts apps/api/src/repositories/cloud-match-snapshot-repository.test.ts apps/api/src/repositories/fallback-match-snapshot-repository.test.ts apps/api/src/routes/matches.test.ts apps/api/src/routes/match-detail.test.ts apps/api/src/routes/data-snapshot-status.test.ts scripts/sync-national-team-data-to-cloud.test.ts
```

Expected: pass.

- [ ] **Step 7: Commit the slice**

```powershell
git add apps/api/src/services apps/api/src/repositories apps/api/src/routes scripts/sync-national-team-data-to-cloud.ts scripts/sync-national-team-data-to-cloud.test.ts package.json
git commit -m "feat(data): sync local match snapshots to cloud"
```

## Task 9: Bets Tab Cloud Workflow

**Purpose:** Replace static Bets rows and shell-only forms with real draft/history behavior.

**Files:**

- Create `apps/web/src/services/cloud-persistence-service.ts`
- Create `apps/web/src/services/cloud-persistence-service.test.ts`
- Create `apps/web/src/services/bet-record-service.ts`
- Create `apps/web/src/services/bet-record-service.test.ts`
- Modify `apps/web/src/components/app-shell.ts`
- Modify `apps/web/src/production-shell.test.ts`
- Modify `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Write failing service tests**

Test:

- Cloud status maps ready/unconfigured/unavailable.
- Draft list maps loading/empty/ready/unavailable.
- Draft save sends only allowed fields.
- Bet list separates pending and settled.
- Formula fields in responses are rejected.
- HTTP 503 displays cloud setup/unavailable state rather than mock rows.

- [ ] **Step 2: Write failing shell tests**

Required UI:

- Bets has loading, empty, unavailable, drafts, pending, and settled states.
- Save Draft submits the current form.
- Edit works for drafts and pending records.
- Settled records are review-only.
- Delete requires an explicit confirmation control.
- No visible `Team Alpha`, `Team Beta`, `Shell only`, or `no data saved` placeholder remains.
- No ROI, yield, CLV, Kelly, recommended stake, risk score, or expected return label exists.

- [ ] **Step 3: Observe failure**

```powershell
pnpm exec vitest run apps/web/src/services/cloud-persistence-service.test.ts apps/web/src/services/bet-record-service.test.ts apps/web/src/production-shell.test.ts
```

Expected: fail because services do not exist and the shell still renders placeholders.

- [ ] **Step 4: Implement services**

Use browser `fetch` against relative `/api/v1` URLs. Do not add Supabase packages or keys.

State:

```ts
export type BetRecordsViewState =
  | { status: 'loading' }
  | { status: 'ready'; drafts: AddBetDraft[]; pending: CloudBetRecord[]; settled: CloudBetRecord[] }
  | { status: 'empty' }
  | { status: 'unavailable'; reason: string };
```

- [ ] **Step 5: Wire the Bets UI**

`renderAppShell` receives `betRecordsState`. `shell-entry.ts` loads it on startup and after each mutation.

The Add Bet form must:

- Derive `matchGroupId` from the selected local match.
- Validate market, odds, and stake points.
- Save a draft through `/api/v1/bet-drafts`.
- Show a stable success or error message.

No automatic odds lookup, settlement, or recommendation is allowed.

- [ ] **Step 6: Verify**

```powershell
pnpm exec vitest run apps/web/src/services/cloud-persistence-service.test.ts apps/web/src/services/bet-record-service.test.ts apps/web/src/production-shell.test.ts
rg "Team Alpha|Team Beta|Shell only: draft|no data saved|ROI|CLV|Kelly|recommended stake|risk score" apps/web/src
```

Expected: tests pass; placeholder and forbidden runtime copy is absent.

- [ ] **Step 7: Commit the slice**

```powershell
git add apps/web/src/services apps/web/src/components/app-shell.ts apps/web/src/production-shell.test.ts apps/web/src/shell-entry.ts
git commit -m "feat(web): connect bets tab to cloud persistence"
```

## Task 10: Bankroll and Backup Web Workflows

**Purpose:** Replace the static points shell with real account, ledger, export, and import actions.

**Files:**

- Create `apps/web/src/services/bankroll-service.ts`
- Create `apps/web/src/services/bankroll-service.test.ts`
- Create `apps/web/src/services/backup-service.ts`
- Create `apps/web/src/services/backup-service.test.ts`
- Modify `apps/web/src/components/app-shell.ts`
- Modify `apps/web/src/production-shell.test.ts`
- Modify `apps/web/src/shell-entry.ts`

- [ ] **Step 1: Write failing service tests**

Test:

- Account list loading/empty/ready/unavailable.
- Create account posts points-only input.
- Ledger entry posts signed manual amount.
- Export downloads validated JSON.
- Import rejects malformed or unsupported schema before POST.
- No service computes ROI, Kelly, stake size, risk, or expected return.

- [ ] **Step 2: Write failing shell tests**

Required UI:

- Account selector.
- Current points from persisted account.
- Add deposit, withdrawal, transfer, and correction controls.
- Ledger list with date, type, amount, and note.
- Empty and unavailable states.
- Export and import controls with visible result status.
- No chart and no betting recommendation.
- Static `24,500 pts` and `Formula status` placeholders are removed.

- [ ] **Step 3: Observe failure**

```powershell
pnpm exec vitest run apps/web/src/services/bankroll-service.test.ts apps/web/src/services/backup-service.test.ts apps/web/src/production-shell.test.ts
```

Expected: fail because services do not exist and Bankroll is static.

- [ ] **Step 4: Implement services and state**

```ts
export type BankrollViewState =
  | { status: 'loading' }
  | { status: 'ready'; accounts: BankrollAccount[]; selectedAccountId: string; ledger: BankrollLedgerEntry[] }
  | { status: 'empty' }
  | { status: 'unavailable'; reason: string };
```

Client-side code may format signed points but must not calculate betting performance.

- [ ] **Step 5: Wire Bankroll and backup controls**

After ledger mutation:

1. Refresh accounts.
2. Refresh selected account ledger.
3. Render the persisted `currentBalancePoints`.

Export creates a browser download from the server envelope. Import requires owner confirmation and shows conflict errors without clearing existing state.

- [ ] **Step 6: Verify**

```powershell
pnpm exec vitest run apps/web/src/services/bankroll-service.test.ts apps/web/src/services/backup-service.test.ts apps/web/src/production-shell.test.ts
rg "24,500 pts|Formula status|ROI|CLV|Kelly|recommended stake|risk score|expected return" apps/web/src
```

Expected: tests pass and placeholder/forbidden copy is absent.

- [ ] **Step 7: Commit the slice**

```powershell
git add apps/web/src/services apps/web/src/components/app-shell.ts apps/web/src/production-shell.test.ts apps/web/src/shell-entry.ts
git commit -m "feat(web): add bankroll ledger and backup workflows"
```

## Task 11: Phase 9 Verification and Closeout Preparation

**Purpose:** Prove all four non-AI tabs work across shared contracts, API, web, local data, and cloud persistence.

**Files:**

- Create `scripts/phase9-cloud-persistence-verify.ts`
- Create `scripts/phase9-cloud-persistence-verify.test.ts`
- Modify `scripts/test-endpoints.ts`
- Modify `package.json`
- Modify `PROJECT_PLAN.md`
- Modify `docs/decisions/ADR-0043-phase-9-cloud-database-provider.md`

- [ ] **Step 1: Write the failing verifier test**

The verifier must fail when:

- `apps/web` contains Supabase database/service secrets.
- `apps/api/src/routes/bet-history.mock.ts` exists.
- Cloud route tests are missing.
- SQL lacks RLS or private-schema revokes.
- Forbidden formula terms appear in new persistence/runtime files.
- `Miraichi AI` becomes a functional prediction/training surface.

- [ ] **Step 2: Add package scripts**

```json
{
  "scripts": {
    "phase9:cloud-persistence-verify": "tsx scripts/phase9-cloud-persistence-verify.ts",
    "phase9:non-ai-app-verify": "pnpm run phase9:local-data-api-verify && pnpm run phase9:cloud-persistence-verify"
  }
}
```

- [ ] **Step 3: Extend endpoint integration checks**

In memory integration mode, verify:

- Cloud status endpoint.
- Draft create/list/update/delete.
- Bet create/list/patch.
- Account create.
- Ledger create/list.
- Backup export.
- Match endpoints still work.

For Supabase staging mode, require:

```text
CLOUD_PERSISTENCE_MODE=supabase
SUPABASE_DATABASE_URL=<staging secret>
```

and verify a disposable owner-prefixed record set. Cleanup must delete only records created by the smoke run.

- [ ] **Step 4: Run focused verification**

```powershell
pnpm run phase9:non-ai-app-verify
```

Expected: pass.

- [ ] **Step 5: Run repository local verification**

```powershell
pnpm run verify:local
```

Expected: pass.

- [ ] **Step 6: Run integration only after all four tab boundaries are complete**

```powershell
pnpm run test:integration
```

Expected: pass.

- [ ] **Step 7: Update tracking documents**

Mark implementation items complete only after the commands above pass. ADR-0043 implementation status becomes:

```text
Implemented locally; staging verification pending
```

Do not mark Phase 9 complete before `phase:staging Phase 9 Non-AI App Completion` passes.

- [ ] **Step 8: Commit closeout evidence**

```powershell
git add package.json scripts/phase9-cloud-persistence-verify.ts scripts/phase9-cloud-persistence-verify.test.ts scripts/test-endpoints.ts PROJECT_PLAN.md docs/decisions/ADR-0043-phase-9-cloud-database-provider.md
git commit -m "test(phase9): verify non-ai cloud persistence boundary"
```

## Slice Execution Order

Execute one lifecycle slice at a time:

1. `phase:code-slice Phase 9 Cloud Persistence Contracts and Server-Only Configuration`
2. `phase:code-slice Phase 9 Memory Persistence Adapter`
3. `phase:code-slice Phase 9 Private Supabase Schema`
4. `phase:code-slice Phase 9 Supabase Postgres Adapter`
5. `phase:code-slice Phase 9 Bets and Draft API Routes`
6. `phase:code-slice Phase 9 Bankroll and Backup API Routes`
7. `phase:code-slice Phase 9 Match Snapshot Cloud Sync and Fallback`
8. `phase:code-slice Phase 9 Bets Tab Cloud Workflow`
9. `phase:code-slice Phase 9 Bankroll and Backup Web Workflows`
10. `phase:code-slice Phase 9 Non-AI App Closeout Verifier`
11. `phase:integration-test Phase 9 Non-AI App Completion`
12. `phase:staging Phase 9 Non-AI App Completion`

## Staging Decision Required Later

Before staging:

- Create or select the Supabase staging project.
- Apply the reviewed migration.
- Store `SUPABASE_DATABASE_URL` only in the API/staging secret environment.
- Decide whether Supabase Free limitations are acceptable for owner testing.
- Run database advisors and record results.

Before production:

- Explicitly decide Free versus Pro.
- Confirm backup/download expectations.
- Confirm inactivity pause is acceptable or upgrade.
- Record rollback and export evidence.

## Explicitly Forbidden Scope

- Direct browser-to-Supabase calls.
- Supabase secret, service-role key, or database URL in web code.
- Public auth or multi-user sharing.
- Live scores, live polling, or live odds.
- API-Football restoration.
- Club-competition expansion.
- ROI, yield, CLV, Kelly, expected-return, stake-sizing, bankroll-risk, or recommendation formulas.
- Prediction tables, model registry, AI runtime, prompts, embeddings, or training.
- Production promotion before staging evidence and explicit owner approval.

## Definition of Done

- ADR-0043 remains accepted and implemented according to its boundary.
- Supabase Postgres is reachable only from `apps/api`.
- Today and Matches use local data first and cloud fallback only when local data is missing.
- Bets supports durable drafts, pending records, settled history, editing, and deletion rules.
- Bankroll supports durable points-only accounts and manual ledger entries.
- Backup export/import is validated, hashed, logged, and conflict-safe.
- UI has loading, empty, unavailable, success, and error states.
- No static mock rows remain in the four non-AI workflows.
- Miraichi AI remains disabled or honest-unavailable.
- `pnpm run phase9:non-ai-app-verify` passes.
- `pnpm run verify:local` passes.
- `pnpm run test:integration` passes after the feature boundary is complete.
- Staging is a separate lifecycle command and gate.
