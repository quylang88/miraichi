import { describe, expect, it } from 'vitest';
import {
  createBetEntryState,
  getLinePresets,
  getSelectionCodes,
  restoreBetEntryState,
  selectBetLinePreset,
  selectBetMarket,
  selectBetPeriod,
  selectBetSelection,
  setManualBetLine,
  setManualRunningContext,
  setRunningContext,
  selectRunningWindow,
  toStructuredBetSelection
} from './bet-entry-model.js';

const generatedAt = '2026-09-15T02:00:00.000Z';

describe('guided Add Bet entry model', () => {
  it('offers only valid selections and presets for the chosen market and period', () => {
    let state = selectBetMarket(createBetEntryState(), 'over_under');
    state = selectBetPeriod(state, 'full_time');
    expect(getSelectionCodes(state)).toEqual(['over', 'under']);
    expect(getLinePresets(state)).toEqual([1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5]);
    expect(getLinePresets(selectBetPeriod(state, 'first_half'))).toEqual([0.5, 0.75, 1, 1.25, 1.5]);

    const oneXTwo = selectBetPeriod(selectBetMarket(state, '1X2'), 'full_time');
    expect(getSelectionCodes(oneXTwo)).toEqual(['home', 'draw', 'away']);
    expect(getLinePresets(oneXTwo)).toEqual([]);
  });

  it('offers first-half corner presets instead of full-time totals and clears a stale FT choice', () => {
    let state = selectBetPeriod(selectBetMarket(createBetEntryState(), 'corners'), 'full_time');
    expect(getLinePresets(state)).toEqual([7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11]);
    state = selectBetLinePreset(selectBetSelection(state, 'over'), 9.5);
    state = selectBetPeriod(state, 'first_half');
    expect(state).toMatchObject({ selectionCode: '', lineValue: null });
    expect(getLinePresets(state)).toEqual([2.5, 3.5, 4.5, 5.5, 6.5]);
    expect(selectBetLinePreset(state, 9.5).lineValue).toBeNull();
    expect(selectBetLinePreset(state, 4.5).lineValue).toBe(4.5);
    state = selectBetSelection(state, 'over');
    expect(setManualBetLine(state, '5.6').lineValue).toBeNull();
  });

  it('clears dependent choices whenever market or period changes', () => {
    let state = selectBetPeriod(selectBetMarket(createBetEntryState(), 'handicap'), 'full_time');
    state = selectBetSelection(state, 'home');
    state = selectBetLinePreset(state, -0.75);
    expect(state).toMatchObject({ selectionCode: 'home', lineValue: -0.75 });

    state = selectBetPeriod(state, 'first_half');
    expect(state).toMatchObject({ selectionCode: '', lineValue: null, manualLineInput: '' });
    state = selectBetMarket({ ...state, selectionCode: 'away', lineValue: 0.5 }, 'corners');
    expect(state).toMatchObject({ marketType: 'corners', marketPeriod: '', selectionCode: '', lineValue: null });
  });

  it('normalizes comma manual lines and refuses arbitrary formats', () => {
    let state = selectBetSelection(
      selectBetPeriod(selectBetMarket(createBetEntryState(), 'over_under'), 'full_time'),
      'under'
    );
    state = setManualBetLine(state, '3,25');
    expect(state.lineValue).toBe(3.25);
    expect(toStructuredBetSelection(state)).toEqual({
      marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'under', lineValue: 3.25
    });
    expect(setManualBetLine(state, '3.2').lineValue).toBeNull();
    expect(setManualBetLine(state, 'anything').lineValue).toBeNull();
  });

  it('restores only normalized draft fields', () => {
    expect(restoreBetEntryState({
      marketType: 'handicap', marketPeriod: 'first_half', selectionCode: 'away', lineValue: 0.25
    })).toMatchObject({ marketType: 'handicap', marketPeriod: 'first_half', selectionCode: 'away', lineValue: 0.25 });
    expect(toStructuredBetSelection(restoreBetEntryState({ marketType: 'custom' as string }))).toBeNull();
  });

  it('builds a fixed-window Running Over 0.5 with snapshot context', () => {
    let state = selectBetMarket(createBetEntryState(), 'running');
    state = selectRunningWindow(state, 'fixed_15', { startMinute: 45, endMinute: 60 });
    state = selectBetLinePreset(state, 0.5);
    state = setRunningContext(state, {
      liveScoreHome: 2, liveScoreAway: 1, liveMinute: 58,
      liveContextSource: 'snapshot', liveContextObservedAt: generatedAt
    });
    expect(toStructuredBetSelection(state)).toEqual({
      marketType: 'running', runningWindow: 'fixed_15',
      windowStartMinute: 45, windowEndMinute: 60,
      runningGoalThreshold: 0.5,
      liveScoreHome: 2, liveScoreAway: 1, liveMinute: 58,
      liveContextSource: 'snapshot', liveContextObservedAt: generatedAt
    });
    state = setManualRunningContext(state, {
      liveScoreHome: state.liveScoreHome,
      liveScoreAway: state.liveScoreAway,
      liveMinute: state.liveMinute
    });
    expect(toStructuredBetSelection(state)).toMatchObject({
      runningGoalThreshold: 0.5, liveScoreHome: 2, liveScoreAway: 1, liveMinute: 58, liveContextSource: 'manual'
    });
  });

  it('derives Running Over 0.75 from score without asking for a line or minute',()=>{
    let state=selectBetMarket(createBetEntryState(),'running');
    state=selectRunningWindow(state,'to_full_time');
    state=selectBetLinePreset(state,0.75);
    state=setManualRunningContext(state,{liveScoreHome:1,liveScoreAway:1,liveMinute:null});
    expect(toStructuredBetSelection(state)).toEqual({marketType:'running',runningWindow:'to_full_time',runningGoalThreshold:0.75,liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual'});
    expect(getSelectionCodes(state)).toEqual(['over']);
    expect(getLinePresets(state)).toEqual([0.5,0.75]);
  });
});
