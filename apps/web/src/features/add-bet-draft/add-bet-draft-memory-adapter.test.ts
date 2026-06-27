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
