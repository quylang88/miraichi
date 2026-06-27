# Phase 5.11 Local-First Add Bet Draft Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first local-first Add Bet draft persistence boundary without formulas, APIs, cloud sync, auth, production schemas, or real betting-history settlement behavior.

**Architecture:** Phase 5.11 starts with shared TypeScript contracts, then adds web-local form state, an in-memory adapter for deterministic tests, an IndexedDB adapter for browser persistence, and JSON backup/import helpers for draft payloads. Storage remains behind an adapter boundary so future storage changes do not leak into UI or domain logic.

**Tech Stack:** TypeScript, Vitest, pnpm workspaces, browser IndexedDB, `fake-indexeddb` for unit tests.

---

## 1. Source Decisions

This plan is based on:

* `docs/betting/PHASE-5-10-ADD-BET-DRAFT-PERSISTENCE-PLAN.md`
* `docs/betting/PHASE-5-10-READINESS-REVIEW.md`
* `docs/decisions/ADR-0023-user-entered-real-bet-record-boundary.md`
* `docs/decisions/ADR-0024-match-centric-betting-history-grouping.md`
* `docs/decisions/ADR-0025-market-catalog-and-line-preset-registry.md`
* `docs/decisions/ADR-0026-odds-format-strategy-boundary.md`
* `docs/decisions/ADR-0033-local-first-betting-data-persistence-and-backup-boundary.md`
* `docs/decisions/ADR-0034-typescript-adoption-and-typed-domain-contracts-boundary.md`

Owner-approved Phase 5.10 decisions:

* Draft fields are type/structure only.
* Form-state fields are UI and structural completeness only.
* Persistence starts behind an adapter boundary.
* IndexedDB is the implementation storage direction.
* `localStorage` must not store real betting history.
* Backup/import uses versioned JSON and rejects malformed or unsupported schema data.

This plan does not authorize formulas, odds conversion, settlement math, bankroll/risk logic, API routes, cloud sync, auth, production databases, provider integrations, prediction logic, or AI recommendation behavior.

---

## 2. File Structure

Create:

* `packages/shared/src/contracts/add-bet-draft-contracts.ts` - Shared draft, form-state, backup, adapter, and structural readiness contracts.
* `packages/shared/src/contracts/add-bet-draft-contracts.test.ts` - Runtime tests for structural readiness and safe cloning.
* `apps/web/src/features/add-bet-draft/add-bet-form-state.ts` - Web form-state helpers.
* `apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts` - Form-state unit tests.
* `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.ts` - In-memory adapter for deterministic adapter behavior.
* `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts` - Memory adapter tests.
* `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.ts` - IndexedDB adapter.
* `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts` - IndexedDB adapter tests with `fake-indexeddb`.
* `apps/web/src/features/add-bet-draft/add-bet-draft-backup.ts` - Versioned JSON export, parse, and conflict-safe import helpers for draft backups.
* `apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts` - Backup/import helper tests.

Modify:

* `package.json` - Add `fake-indexeddb` dev dependency for IndexedDB unit tests.
* `pnpm-lock.yaml` - Updated by `pnpm add -D fake-indexeddb@^6.2.5`.
* `CHANGELOG.md` - Record Phase 5.11 implementation plan creation.
* `PROJECT_PLAN.md` - Record Phase 5.11 implementation plan as created and gate code slices behind owner approval.
* `ROADMAP.md` - Same phase status update.

---

## 3. Task 1: Shared Add Bet Draft Contracts

**Files:**

* Create: `packages/shared/src/contracts/add-bet-draft-contracts.ts`
* Create: `packages/shared/src/contracts/add-bet-draft-contracts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/src/contracts/add-bet-draft-contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ADD_BET_BACKUP_SCHEMA_VERSION,
  cloneAddBetDraft,
  isAddBetDraftReviewReady,
  type AddBetDraft
} from './add-bet-draft-contracts.js';

function createCompleteDraft(overrides: Partial<AddBetDraft> = {}): AddBetDraft {
  return {
    draftId: 'draft-001',
    matchGroupId: 'match-group-001',
    marketType: 'over_under',
    lineValue: 2.5,
    oddsFormat: 'HK',
    oddsValue: 0.92,
    stakePoints: 10,
    notes: 'Manual note',
    tags: ['watchlist'],
    createdAt: '2026-06-27T09:00:00.000Z',
    updatedAt: '2026-06-27T09:05:00.000Z',
    ...overrides
  };
}

describe('add bet draft contracts', () => {
  it('marks structurally complete non-custom drafts as review-ready', () => {
    expect(isAddBetDraftReviewReady(createCompleteDraft())).toBe(true);
  });

  it('rejects review readiness when required draft fields are missing', () => {
    const draft = createCompleteDraft({ stakePoints: undefined });

    expect(isAddBetDraftReviewReady(draft)).toBe(false);
  });

  it('requires a custom market label only for custom market drafts', () => {
    expect(
      isAddBetDraftReviewReady(
        createCompleteDraft({
          marketType: 'custom',
          customMarketLabel: 'Player shots'
        })
      )
    ).toBe(true);

    expect(
      isAddBetDraftReviewReady(
        createCompleteDraft({
          marketType: 'custom',
          customMarketLabel: '   '
        })
      )
    ).toBe(false);
  });

  it('clones draft arrays so adapter callers cannot mutate stored tags', () => {
    const draft = createCompleteDraft();
    const cloned = cloneAddBetDraft(draft);

    expect(cloned).toEqual(draft);
    expect(cloned.tags).toEqual(['watchlist']);
    expect(cloned.tags).not.toBe(draft.tags);
  });

  it('uses one explicit backup schema version for Phase 5.11', () => {
    expect(ADD_BET_BACKUP_SCHEMA_VERSION).toBe('miraichi.add-bet-backup.v1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run packages/shared/src/contracts/add-bet-draft-contracts.test.ts
```

Expected: FAIL because `packages/shared/src/contracts/add-bet-draft-contracts.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `packages/shared/src/contracts/add-bet-draft-contracts.ts`:

```ts
import type {
  BetRecordEnvelope,
  IsoDateTimeString,
  LineValue,
  MarketType,
  MatchGroupId,
  OddsFormat
} from './betting-domain-contracts.js';

export type { IsoDateTimeString, MatchGroupId } from './betting-domain-contracts.js';

export const ADD_BET_BACKUP_SCHEMA_VERSION = 'miraichi.add-bet-backup.v1' as const;
export const ADD_BET_BACKUP_SOURCE_APP = 'miraichi' as const;

export type AddBetDraftId = string;

export interface AddBetDraft {
  readonly draftId: AddBetDraftId;
  readonly matchGroupId: MatchGroupId;
  readonly marketType: MarketType;
  readonly customMarketLabel?: string;
  readonly lineValue?: LineValue | null;
  readonly oddsFormat: OddsFormat;
  readonly oddsValue: number;
  readonly stakePoints: number;
  readonly notes?: string;
  readonly tags?: readonly string[];
  readonly createdAt: IsoDateTimeString;
  readonly updatedAt: IsoDateTimeString;
}

export type AddBetDraftFieldName = keyof AddBetDraft;
export type AddBetFormStep = 'add' | 'edit' | 'review';

export interface AddBetFormState {
  readonly activeStep: AddBetFormStep;
  readonly dirtyFields: readonly AddBetDraftFieldName[];
  readonly touchedFields: readonly AddBetDraftFieldName[];
  readonly warnings: Readonly<Partial<Record<AddBetDraftFieldName, string>>>;
  readonly blockingErrors: Readonly<Partial<Record<AddBetDraftFieldName, string>>>;
  readonly reviewReady: boolean;
  readonly lastSavedAt?: IsoDateTimeString | null;
}

export type AddBetDraftPersistenceErrorCode =
  | 'draft_not_found'
  | 'storage_unavailable'
  | 'quota_exceeded'
  | 'unsupported_schema'
  | 'malformed_backup'
  | 'duplicate_record_identity'
  | 'partial_import_conflict'
  | 'user_cancelled';

export interface AddBetDraftPersistenceResult {
  readonly ok: boolean;
  readonly errorCode?: AddBetDraftPersistenceErrorCode;
}

export interface AddBetDraftPersistenceAdapter {
  saveDraft(draft: AddBetDraft): Promise<AddBetDraft>;
  loadDraft(draftId: AddBetDraftId): Promise<AddBetDraft | null>;
  listDraftsByMatch(matchGroupId: MatchGroupId): Promise<readonly AddBetDraft[]>;
  deleteDraft(draftId: AddBetDraftId): Promise<AddBetDraftPersistenceResult>;
}

export interface AddBetBackupEnvelope {
  readonly schemaVersion: typeof ADD_BET_BACKUP_SCHEMA_VERSION;
  readonly exportedAt: IsoDateTimeString;
  readonly sourceApp: typeof ADD_BET_BACKUP_SOURCE_APP;
  readonly records: readonly BetRecordEnvelope[];
  readonly drafts?: readonly AddBetDraft[];
  readonly settings?: Readonly<Record<string, unknown>>;
}

const REQUIRED_REVIEW_FIELDS = [
  'draftId',
  'matchGroupId',
  'marketType',
  'oddsFormat',
  'oddsValue',
  'stakePoints',
  'createdAt',
  'updatedAt'
] as const satisfies readonly AddBetDraftFieldName[];

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function cloneAddBetDraft(draft: AddBetDraft): AddBetDraft {
  return {
    ...draft,
    tags: draft.tags ? [...draft.tags] : undefined
  };
}

export function isAddBetDraftReviewReady(draft: Partial<AddBetDraft>): boolean {
  const requiredFieldsPresent = REQUIRED_REVIEW_FIELDS.every((fieldName) => {
    return draft[fieldName] !== undefined && draft[fieldName] !== null;
  });

  if (!requiredFieldsPresent) {
    return false;
  }

  if (!hasText(draft.draftId) || !hasText(draft.matchGroupId)) {
    return false;
  }

  if (!hasFiniteNumber(draft.oddsValue) || !hasFiniteNumber(draft.stakePoints)) {
    return false;
  }

  if (draft.marketType === 'custom') {
    return hasText(draft.customMarketLabel);
  }

  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run packages/shared/src/contracts/add-bet-draft-contracts.test.ts
pnpm run typecheck
```

Expected: PASS. Typecheck exits with code 0.

- [ ] **Step 5: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add packages/shared/src/contracts/add-bet-draft-contracts.ts packages/shared/src/contracts/add-bet-draft-contracts.test.ts
git commit -m "feat: add add bet draft contracts"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

---

## 4. Task 2: Add Bet Form-State Helpers

**Files:**

* Create: `apps/web/src/features/add-bet-draft/add-bet-form-state.ts`
* Create: `apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  clearDraftBlockingError,
  createInitialAddBetFormState,
  markDraftFieldDirty,
  markDraftFieldTouched,
  setDraftBlockingError,
  setDraftLastSavedAt,
  setDraftReviewReady,
  setDraftWarning
} from './add-bet-form-state.js';

describe('add bet form state helpers', () => {
  it('creates an add-step state with empty interaction metadata', () => {
    expect(createInitialAddBetFormState()).toEqual({
      activeStep: 'add',
      dirtyFields: [],
      touchedFields: [],
      warnings: {},
      blockingErrors: {},
      reviewReady: false,
      lastSavedAt: null
    });
  });

  it('tracks touched and dirty fields without duplicates', () => {
    const initial = createInitialAddBetFormState();
    const touched = markDraftFieldTouched(markDraftFieldTouched(initial, 'marketType'), 'marketType');
    const dirty = markDraftFieldDirty(markDraftFieldDirty(touched, 'stakePoints'), 'stakePoints');

    expect(touched.touchedFields).toEqual(['marketType']);
    expect(dirty.dirtyFields).toEqual(['stakePoints']);
  });

  it('keeps warnings separate from blocking errors', () => {
    const state = setDraftWarning(createInitialAddBetFormState(), 'lineValue', 'Non-standard line');

    expect(state.warnings).toEqual({ lineValue: 'Non-standard line' });
    expect(state.blockingErrors).toEqual({});
    expect(state.reviewReady).toBe(false);
  });

  it('can set and clear structural blocking errors', () => {
    const blocked = setDraftBlockingError(
      createInitialAddBetFormState(),
      'matchGroupId',
      'Match group is required'
    );
    const cleared = clearDraftBlockingError(blocked, 'matchGroupId');

    expect(blocked.blockingErrors).toEqual({ matchGroupId: 'Match group is required' });
    expect(cleared.blockingErrors).toEqual({});
  });

  it('records review readiness and last saved timestamp explicitly', () => {
    const state = setDraftLastSavedAt(
      setDraftReviewReady(createInitialAddBetFormState(), true),
      '2026-06-27T10:00:00.000Z'
    );

    expect(state.reviewReady).toBe(true);
    expect(state.lastSavedAt).toBe('2026-06-27T10:00:00.000Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts
```

Expected: FAIL because `apps/web/src/features/add-bet-draft/add-bet-form-state.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/features/add-bet-draft/add-bet-form-state.ts`:

```ts
import type {
  AddBetDraftFieldName,
  AddBetFormState,
  IsoDateTimeString
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

function appendUnique<T extends string>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value) ? values : [...values, value];
}

function omitField<T extends string>(
  values: Readonly<Partial<Record<T, string>>>,
  fieldName: T
): Readonly<Partial<Record<T, string>>> {
  const nextValues = { ...values };
  delete nextValues[fieldName];
  return nextValues;
}

export function createInitialAddBetFormState(): AddBetFormState {
  return {
    activeStep: 'add',
    dirtyFields: [],
    touchedFields: [],
    warnings: {},
    blockingErrors: {},
    reviewReady: false,
    lastSavedAt: null
  };
}

export function markDraftFieldTouched(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName
): AddBetFormState {
  return {
    ...state,
    touchedFields: appendUnique(state.touchedFields, fieldName)
  };
}

export function markDraftFieldDirty(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName
): AddBetFormState {
  return {
    ...state,
    dirtyFields: appendUnique(state.dirtyFields, fieldName)
  };
}

export function setDraftWarning(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName,
  message: string
): AddBetFormState {
  return {
    ...state,
    warnings: {
      ...state.warnings,
      [fieldName]: message
    }
  };
}

export function setDraftBlockingError(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName,
  message: string
): AddBetFormState {
  return {
    ...state,
    blockingErrors: {
      ...state.blockingErrors,
      [fieldName]: message
    },
    reviewReady: false
  };
}

export function clearDraftBlockingError(
  state: AddBetFormState,
  fieldName: AddBetDraftFieldName
): AddBetFormState {
  return {
    ...state,
    blockingErrors: omitField(state.blockingErrors, fieldName)
  };
}

export function setDraftReviewReady(state: AddBetFormState, reviewReady: boolean): AddBetFormState {
  return {
    ...state,
    reviewReady
  };
}

export function setDraftLastSavedAt(
  state: AddBetFormState,
  lastSavedAt: IsoDateTimeString | null
): AddBetFormState {
  return {
    ...state,
    lastSavedAt
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts
pnpm run typecheck
```

Expected: PASS. Typecheck exits with code 0.

- [ ] **Step 5: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add apps/web/src/features/add-bet-draft/add-bet-form-state.ts apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts
git commit -m "feat: add add bet form state helpers"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

---

## 5. Task 3: Memory Draft Persistence Adapter

**Files:**

* Create: `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.ts`
* Create: `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { createMemoryAddBetDraftAdapter } from './add-bet-draft-memory-adapter.js';

function createDraft(overrides: Partial<AddBetDraft> = {}): AddBetDraft {
  return {
    draftId: 'draft-001',
    matchGroupId: 'match-group-001',
    marketType: '1X2',
    oddsFormat: 'HK',
    oddsValue: 0.86,
    stakePoints: 5,
    createdAt: '2026-06-27T10:00:00.000Z',
    updatedAt: '2026-06-27T10:01:00.000Z',
    ...overrides
  };
}

describe('memory add bet draft adapter', () => {
  it('saves and loads a defensive copy of one draft', async () => {
    const adapter = createMemoryAddBetDraftAdapter();
    const draft = createDraft({ tags: ['first'] });

    await adapter.saveDraft(draft);
    const loaded = await adapter.loadDraft('draft-001');

    expect(loaded).toEqual(draft);
    expect(loaded?.tags).not.toBe(draft.tags);
  });

  it('lists drafts for one match group in updatedAt descending order', async () => {
    const adapter = createMemoryAddBetDraftAdapter();

    await adapter.saveDraft(createDraft({ draftId: 'older', updatedAt: '2026-06-27T10:01:00.000Z' }));
    await adapter.saveDraft(createDraft({ draftId: 'newer', updatedAt: '2026-06-27T10:03:00.000Z' }));
    await adapter.saveDraft(
      createDraft({
        draftId: 'other-match',
        matchGroupId: 'match-group-002',
        updatedAt: '2026-06-27T10:04:00.000Z'
      })
    );

    const drafts = await adapter.listDraftsByMatch('match-group-001');

    expect(drafts.map((draft) => draft.draftId)).toEqual(['newer', 'older']);
  });

  it('deletes drafts by draft ID and reports missing draft deletion', async () => {
    const adapter = createMemoryAddBetDraftAdapter([createDraft()]);

    expect(await adapter.deleteDraft('draft-001')).toEqual({ ok: true });
    expect(await adapter.loadDraft('draft-001')).toBeNull();
    expect(await adapter.deleteDraft('draft-001')).toEqual({
      ok: false,
      errorCode: 'draft_not_found'
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts
```

Expected: FAIL because `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.ts`:

```ts
import type {
  AddBetDraft,
  AddBetDraftId,
  AddBetDraftPersistenceAdapter,
  AddBetDraftPersistenceResult,
  MatchGroupId
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { cloneAddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

function sortByUpdatedAtDescending(a: AddBetDraft, b: AddBetDraft): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function createMemoryAddBetDraftAdapter(
  initialDrafts: readonly AddBetDraft[] = []
): AddBetDraftPersistenceAdapter {
  const drafts = new Map<AddBetDraftId, AddBetDraft>();

  initialDrafts.forEach((draft) => {
    drafts.set(draft.draftId, cloneAddBetDraft(draft));
  });

  return {
    async saveDraft(draft: AddBetDraft): Promise<AddBetDraft> {
      const clonedDraft = cloneAddBetDraft(draft);
      drafts.set(clonedDraft.draftId, clonedDraft);
      return cloneAddBetDraft(clonedDraft);
    },

    async loadDraft(draftId: AddBetDraftId): Promise<AddBetDraft | null> {
      const draft = drafts.get(draftId);
      return draft ? cloneAddBetDraft(draft) : null;
    },

    async listDraftsByMatch(matchGroupId: MatchGroupId): Promise<readonly AddBetDraft[]> {
      return Array.from(drafts.values())
        .filter((draft) => draft.matchGroupId === matchGroupId)
        .sort(sortByUpdatedAtDescending)
        .map(cloneAddBetDraft);
    },

    async deleteDraft(draftId: AddBetDraftId): Promise<AddBetDraftPersistenceResult> {
      if (!drafts.has(draftId)) {
        return {
          ok: false,
          errorCode: 'draft_not_found'
        };
      }

      drafts.delete(draftId);
      return { ok: true };
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts
pnpm run typecheck
```

Expected: PASS. Typecheck exits with code 0.

- [ ] **Step 5: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.ts apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts
git commit -m "feat: add memory add bet draft adapter"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

---

## 6. Task 4: IndexedDB Draft Persistence Adapter

**Files:**

* Modify: `package.json`
* Modify: `pnpm-lock.yaml`
* Create: `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.ts`
* Create: `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts`

- [ ] **Step 1: Add deterministic IndexedDB test dependency**

Run:

```powershell
pnpm add -D fake-indexeddb@^6.2.5
```

Expected: `package.json` includes `fake-indexeddb` under `devDependencies`, and `pnpm-lock.yaml` changes.

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts`:

```ts
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import type { AddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { createIndexedDbAddBetDraftAdapter } from './add-bet-draft-indexeddb-adapter.js';

const DB_NAME = 'miraichi-add-bet-drafts-test';

function createDraft(overrides: Partial<AddBetDraft> = {}): AddBetDraft {
  return {
    draftId: 'draft-001',
    matchGroupId: 'match-group-001',
    marketType: 'handicap',
    lineValue: -0.5,
    oddsFormat: 'HK',
    oddsValue: 0.95,
    stakePoints: 8,
    createdAt: '2026-06-27T11:00:00.000Z',
    updatedAt: '2026-06-27T11:02:00.000Z',
    ...overrides
  };
}

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
    request.onblocked = () => reject(new Error(`Delete blocked for ${name}`));
  });
}

afterEach(async () => {
  await deleteDatabase(DB_NAME);
});

describe('indexeddb add bet draft adapter', () => {
  it('saves and loads one draft from IndexedDB', async () => {
    const adapter = createIndexedDbAddBetDraftAdapter({ databaseName: DB_NAME });
    const draft = createDraft({ tags: ['indexeddb'] });

    await adapter.saveDraft(draft);

    expect(await adapter.loadDraft('draft-001')).toEqual(draft);
  });

  it('lists drafts by match group using the matchGroupId index', async () => {
    const adapter = createIndexedDbAddBetDraftAdapter({ databaseName: DB_NAME });

    await adapter.saveDraft(createDraft({ draftId: 'older', updatedAt: '2026-06-27T11:01:00.000Z' }));
    await adapter.saveDraft(createDraft({ draftId: 'newer', updatedAt: '2026-06-27T11:05:00.000Z' }));
    await adapter.saveDraft(
      createDraft({
        draftId: 'other-match',
        matchGroupId: 'match-group-002',
        updatedAt: '2026-06-27T11:06:00.000Z'
      })
    );

    const drafts = await adapter.listDraftsByMatch('match-group-001');

    expect(drafts.map((draft) => draft.draftId)).toEqual(['newer', 'older']);
  });

  it('deletes stored drafts and reports missing IDs', async () => {
    const adapter = createIndexedDbAddBetDraftAdapter({ databaseName: DB_NAME });
    await adapter.saveDraft(createDraft());

    expect(await adapter.deleteDraft('draft-001')).toEqual({ ok: true });
    expect(await adapter.loadDraft('draft-001')).toBeNull();
    expect(await adapter.deleteDraft('draft-001')).toEqual({
      ok: false,
      errorCode: 'draft_not_found'
    });
  });

  it('reports unavailable storage when IndexedDB is not supplied', async () => {
    const adapter = createIndexedDbAddBetDraftAdapter({
      databaseName: DB_NAME,
      indexedDb: null
    });

    await expect(adapter.saveDraft(createDraft())).rejects.toThrow('IndexedDB is unavailable');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts
```

Expected: FAIL because `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.ts` does not exist.

- [ ] **Step 4: Write minimal implementation**

Create `apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.ts`:

```ts
import type {
  AddBetDraft,
  AddBetDraftId,
  AddBetDraftPersistenceAdapter,
  AddBetDraftPersistenceResult,
  MatchGroupId
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { cloneAddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

const DEFAULT_DATABASE_NAME = 'miraichi-add-bet-drafts';
const DEFAULT_DATABASE_VERSION = 1;
const DEFAULT_STORE_NAME = 'drafts';
const MATCH_GROUP_INDEX_NAME = 'matchGroupId';

export interface IndexedDbAddBetDraftAdapterOptions {
  readonly databaseName?: string;
  readonly databaseVersion?: number;
  readonly storeName?: string;
  readonly indexedDb?: IDBFactory | null;
}

function getIndexedDbFactory(indexedDb: IDBFactory | null | undefined): IDBFactory {
  if (indexedDb === null) {
    throw new Error('IndexedDB is unavailable');
  }

  if (indexedDb) {
    return indexedDb;
  }

  if (typeof globalThis.indexedDB === 'undefined') {
    throw new Error('IndexedDB is unavailable');
  }

  return globalThis.indexedDB;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
    transaction.oncomplete = () => resolve();
  });
}

function openDatabase({
  databaseName,
  databaseVersion,
  storeName,
  indexedDb
}: Required<IndexedDbAddBetDraftAdapterOptions>): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDb.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(storeName)
        ? request.transaction?.objectStore(storeName)
        : database.createObjectStore(storeName, { keyPath: 'draftId' });

      if (store && !store.indexNames.contains(MATCH_GROUP_INDEX_NAME)) {
        store.createIndex(MATCH_GROUP_INDEX_NAME, 'matchGroupId', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function sortByUpdatedAtDescending(a: AddBetDraft, b: AddBetDraft): number {
  return b.updatedAt.localeCompare(a.updatedAt);
}

export function createIndexedDbAddBetDraftAdapter(
  options: IndexedDbAddBetDraftAdapterOptions = {}
): AddBetDraftPersistenceAdapter {
  const databaseName = options.databaseName ?? DEFAULT_DATABASE_NAME;
  const databaseVersion = options.databaseVersion ?? DEFAULT_DATABASE_VERSION;
  const storeName = options.storeName ?? DEFAULT_STORE_NAME;

  async function withStore<T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const indexedDb = getIndexedDbFactory(options.indexedDb);
    const database = await openDatabase({
      databaseName,
      databaseVersion,
      storeName,
      indexedDb
    });

    try {
      const transaction = database.transaction(storeName, mode);
      const store = transaction.objectStore(storeName);
      const request = operation(store);
      const [result] = await Promise.all([requestToPromise(request), transactionDone(transaction)]);
      return result;
    } finally {
      database.close();
    }
  }

  return {
    async saveDraft(draft: AddBetDraft): Promise<AddBetDraft> {
      const clonedDraft = cloneAddBetDraft(draft);
      await withStore('readwrite', (store) => store.put(clonedDraft));
      return cloneAddBetDraft(clonedDraft);
    },

    async loadDraft(draftId: AddBetDraftId): Promise<AddBetDraft | null> {
      const draft = await withStore<AddBetDraft | undefined>('readonly', (store) => store.get(draftId));
      return draft ? cloneAddBetDraft(draft) : null;
    },

    async listDraftsByMatch(matchGroupId: MatchGroupId): Promise<readonly AddBetDraft[]> {
      const drafts = await withStore<AddBetDraft[]>('readonly', (store) => {
        return store.index(MATCH_GROUP_INDEX_NAME).getAll(matchGroupId);
      });

      return drafts.sort(sortByUpdatedAtDescending).map(cloneAddBetDraft);
    },

    async deleteDraft(draftId: AddBetDraftId): Promise<AddBetDraftPersistenceResult> {
      const existingDraft = await this.loadDraft(draftId);

      if (!existingDraft) {
        return {
          ok: false,
          errorCode: 'draft_not_found'
        };
      }

      await withStore('readwrite', (store) => store.delete(draftId));
      return { ok: true };
    }
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts
pnpm run typecheck
```

Expected: PASS. Typecheck exits with code 0.

- [ ] **Step 6: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add package.json pnpm-lock.yaml apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.ts apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts
git commit -m "feat: add indexeddb add bet draft adapter"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

---

## 7. Task 5: Draft Backup/Import JSON Helpers

**Files:**

* Create: `apps/web/src/features/add-bet-draft/add-bet-draft-backup.ts`
* Create: `apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { AddBetDraft } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { ADD_BET_BACKUP_SCHEMA_VERSION } from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import { createMemoryAddBetDraftAdapter } from './add-bet-draft-memory-adapter.js';
import { exportAddBetDraftBackup, parseAddBetDraftBackup } from './add-bet-draft-backup.js';

function createDraft(overrides: Partial<AddBetDraft> = {}): AddBetDraft {
  return {
    draftId: 'draft-001',
    matchGroupId: 'match-group-001',
    marketType: 'custom',
    customMarketLabel: 'Player shots',
    oddsFormat: 'HK',
    oddsValue: 0.88,
    stakePoints: 6,
    createdAt: '2026-06-27T12:00:00.000Z',
    updatedAt: '2026-06-27T12:01:00.000Z',
    ...overrides
  };
}

describe('add bet draft backup helpers', () => {
  it('exports versioned JSON for selected match groups', async () => {
    const adapter = createMemoryAddBetDraftAdapter([
      createDraft({ draftId: 'draft-a', matchGroupId: 'match-group-001' }),
      createDraft({ draftId: 'draft-b', matchGroupId: 'match-group-002' })
    ]);

    const backupJson = await exportAddBetDraftBackup({
      adapter,
      matchGroupIds: ['match-group-001', 'match-group-002'],
      exportedAt: '2026-06-27T12:30:00.000Z'
    });
    const parsed = JSON.parse(backupJson);

    expect(parsed).toMatchObject({
      schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
      exportedAt: '2026-06-27T12:30:00.000Z',
      sourceApp: 'miraichi',
      records: []
    });
    expect(parsed.drafts.map((draft: AddBetDraft) => draft.draftId)).toEqual(['draft-a', 'draft-b']);
  });

  it('parses valid backup JSON and rejects malformed JSON', () => {
    const backup = parseAddBetDraftBackup(
      JSON.stringify({
        schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
        exportedAt: '2026-06-27T12:30:00.000Z',
        sourceApp: 'miraichi',
        records: [],
        drafts: [createDraft()]
      })
    );

    expect(backup.ok).toBe(true);
    expect(backup.envelope?.drafts?.[0]?.draftId).toBe('draft-001');

    expect(parseAddBetDraftBackup('{bad-json')).toEqual({
      ok: false,
      errorCode: 'malformed_backup'
    });
  });

  it('rejects unsupported schema versions and missing envelope fields', () => {
    expect(
      parseAddBetDraftBackup(
        JSON.stringify({
          schemaVersion: 'old-version',
          exportedAt: '2026-06-27T12:30:00.000Z',
          sourceApp: 'miraichi',
          records: []
        })
      )
    ).toEqual({
      ok: false,
      errorCode: 'unsupported_schema'
    });

    expect(parseAddBetDraftBackup(JSON.stringify({ schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION }))).toEqual({
      ok: false,
      errorCode: 'malformed_backup'
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts
```

Expected: FAIL because `apps/web/src/features/add-bet-draft/add-bet-draft-backup.ts` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `apps/web/src/features/add-bet-draft/add-bet-draft-backup.ts`:

```ts
import type {
  AddBetBackupEnvelope,
  AddBetDraft,
  AddBetDraftPersistenceAdapter,
  AddBetDraftPersistenceErrorCode,
  MatchGroupId
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';
import {
  ADD_BET_BACKUP_SCHEMA_VERSION,
  ADD_BET_BACKUP_SOURCE_APP,
  cloneAddBetDraft
} from '../../../../../packages/shared/src/contracts/add-bet-draft-contracts.js';

export interface ExportAddBetDraftBackupInput {
  readonly adapter: AddBetDraftPersistenceAdapter;
  readonly matchGroupIds: readonly MatchGroupId[];
  readonly exportedAt: string;
}

export interface ParseAddBetDraftBackupResult {
  readonly ok: boolean;
  readonly envelope?: AddBetBackupEnvelope;
  readonly errorCode?: AddBetDraftPersistenceErrorCode;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isDraftArray(value: unknown): value is readonly AddBetDraft[] {
  return Array.isArray(value);
}

function isBackupEnvelope(value: unknown): value is AddBetBackupEnvelope {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.exportedAt === 'string' &&
    value.sourceApp === ADD_BET_BACKUP_SOURCE_APP &&
    Array.isArray(value.records) &&
    (value.drafts === undefined || isDraftArray(value.drafts))
  );
}

export async function exportAddBetDraftBackup({
  adapter,
  matchGroupIds,
  exportedAt
}: ExportAddBetDraftBackupInput): Promise<string> {
  const draftsByMatch = await Promise.all(
    matchGroupIds.map((matchGroupId) => adapter.listDraftsByMatch(matchGroupId))
  );
  const drafts = draftsByMatch.flat().map(cloneAddBetDraft);

  const envelope: AddBetBackupEnvelope = {
    schemaVersion: ADD_BET_BACKUP_SCHEMA_VERSION,
    exportedAt,
    sourceApp: ADD_BET_BACKUP_SOURCE_APP,
    records: [],
    drafts
  };

  return JSON.stringify(envelope);
}

export function parseAddBetDraftBackup(rawBackupJson: string): ParseAddBetDraftBackupResult {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawBackupJson);
  } catch {
    return {
      ok: false,
      errorCode: 'malformed_backup'
    };
  }

  if (!isObject(parsed) || parsed.schemaVersion !== ADD_BET_BACKUP_SCHEMA_VERSION) {
    return {
      ok: false,
      errorCode: 'unsupported_schema'
    };
  }

  if (!isBackupEnvelope(parsed)) {
    return {
      ok: false,
      errorCode: 'malformed_backup'
    };
  }

  return {
    ok: true,
    envelope: {
      ...parsed,
      drafts: parsed.drafts?.map(cloneAddBetDraft)
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
pnpm exec vitest run apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts
pnpm run typecheck
```

Expected: PASS. Typecheck exits with code 0.

- [ ] **Step 5: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add apps/web/src/features/add-bet-draft/add-bet-draft-backup.ts apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts
git commit -m "feat: add add bet draft backup helpers"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

---

## 8. Task 6: Documentation And Phase Status Updates

**Files:**

* Modify: `CHANGELOG.md`
* Modify: `PROJECT_PLAN.md`
* Modify: `ROADMAP.md`

- [ ] **Step 1: Write the documentation changes**

Apply these exact updates:

* In `CHANGELOG.md`, add under `Changed`:
  * `Added Phase 5.11 Local-First Add Bet Draft Persistence implementation plan with TDD slices for shared contracts, form state, memory adapter, IndexedDB adapter, and backup helpers.`
* In `PROJECT_PLAN.md`, update the Phase 5 checklist so Phase 5.11 implementation planning is complete and the next item is owner review before `phase:code-slice`.
* In `ROADMAP.md`, mirror the same Phase 5.11 status.

- [ ] **Step 2: Run documentation consistency checks**

Run:

```powershell
rg -n "Phase 5\\.11|PHASE-5-11|code-slice|owner review" PROJECT_PLAN.md ROADMAP.md CHANGELOG.md docs/betting/PHASE-5-11-LOCAL-FIRST-ADD-BET-DRAFT-PERSISTENCE-IMPLEMENTATION-PLAN.md
```

Expected: The output shows Phase 5.11 implementation planning references and still gates code slices behind owner review.

- [ ] **Step 3: Commit if auto commit is enabled**

Check `.agent/config.yml`:

```powershell
if (Test-Path '.agent/config.yml') { Get-Content '.agent/config.yml' } else { 'auto_commit config absent; default true.' }
```

If `auto_commit: true` or config is absent:

```powershell
git add CHANGELOG.md PROJECT_PLAN.md ROADMAP.md docs/betting/PHASE-5-11-LOCAL-FIRST-ADD-BET-DRAFT-PERSISTENCE-IMPLEMENTATION-PLAN.md
git commit -m "docs: add phase 5.11 implementation plan"
```

If `auto_commit: false`: skip commit and print `Skipping commit (auto_commit: false).`

---

## 9. Task 7: Full Local Verification

**Files:**

* No file changes.

- [ ] **Step 1: Run focused unit tests**

Run:

```powershell
pnpm exec vitest run packages/shared/src/contracts/add-bet-draft-contracts.test.ts apps/web/src/features/add-bet-draft/add-bet-form-state.test.ts apps/web/src/features/add-bet-draft/add-bet-draft-memory-adapter.test.ts apps/web/src/features/add-bet-draft/add-bet-draft-indexeddb-adapter.test.ts apps/web/src/features/add-bet-draft/add-bet-draft-backup.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full local verification**

Run:

```powershell
pnpm run verify:local
```

Expected: PASS for lifecycle verification, unit tests, syntax linting, typecheck, and guardrail audit.

- [ ] **Step 3: Check forbidden implementation categories**

Run:

```powershell
rg -n "Kelly|ROI|yield|CLV|stake-sizing|odds conversion|profitLoss|prediction algorithm|recommendation ranking|Prisma|ORM|CREATE TABLE|localStorage.*bet|World Cup|FIFA" apps packages
```

Expected: No hits that indicate new formulas, database schemas, prediction/recommendation logic, real competition hardcoding, or `localStorage` betting-history persistence.

- [ ] **Step 4: Commit verification docs if a report is added**

If a Phase 5.11 review/report doc is added after verification, check `.agent/config.yml` and commit that doc only when `auto_commit` allows it.

---

## 10. Execution Gate

Phase 5.11 code execution may start only after owner review approves this implementation plan.

Approved execution must start with Task 1 and must keep TDD order:

1. Write failing test.
2. Run failing test and read the failure.
3. Write minimal implementation.
4. Run focused passing test.
5. Run typecheck when TypeScript files changed.
6. Commit only if auto commit is enabled.

Do not start with IndexedDB runtime code. Do not combine all tasks into one large code slice.

---

## 11. Self-Review

Spec coverage:

* Draft fields: Task 1.
* Form-state fields: Task 2.
* Persistence adapter boundary: Tasks 3 and 4.
* IndexedDB implementation direction: Task 4.
* Backup/import JSON versioning, malformed/unsupported schema rejection, and conflict-safe import without silent overwrite: Task 5.
* No formulas, schemas, APIs, auth, cloud sync, or prediction logic: Sections 1, 10, and Task 7.

Placeholder scan:

* No placeholder markers are used in implementation steps.
* Every code-changing task includes exact paths, test command, expected failure, implementation code, passing command, and commit instruction.

Type consistency:

* `AddBetDraft`, `AddBetFormState`, `AddBetDraftPersistenceAdapter`, and `AddBetBackupEnvelope` originate in `packages/shared/src/contracts/add-bet-draft-contracts.ts`.
* Web feature modules import those contracts from the same source path.
* Adapter methods match the Phase 5.10 approved operations: `saveDraft`, `loadDraft`, `listDraftsByMatch`, and `deleteDraft`.
