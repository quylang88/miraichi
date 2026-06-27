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
