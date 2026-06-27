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
