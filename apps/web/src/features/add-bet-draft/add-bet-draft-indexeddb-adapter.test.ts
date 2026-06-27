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

  it('deletes drafts without relying on method this binding', async () => {
    const adapter = createIndexedDbAddBetDraftAdapter({ databaseName: DB_NAME });
    await adapter.saveDraft(createDraft());

    const { deleteDraft } = adapter;

    expect(await deleteDraft('draft-001')).toEqual({ ok: true });
  });

  it('reports unavailable storage when IndexedDB is not supplied', async () => {
    const adapter = createIndexedDbAddBetDraftAdapter({
      databaseName: DB_NAME,
      indexedDb: null
    });

    await expect(adapter.saveDraft(createDraft())).rejects.toThrow('IndexedDB is unavailable');
  });
});
