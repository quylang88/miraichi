import { describe, expect, it } from 'vitest';
import {
  formatStructuredSelectionLabel,
  parseQuarterLineInput,
  validateStructuredBetSelection,
  type StructuredBetSelection
} from './structured-bet-selection.js';

const teams = { homeTeamName: 'Japan', awayTeamName: 'Vietnam' };

function valid(selection: StructuredBetSelection): void {
  expect(validateStructuredBetSelection(selection)).toEqual({ ok: true });
}

function invalid(selection: unknown, message: string): void {
  const result = validateStructuredBetSelection(selection);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join('; ')).toContain(message);
}

describe('structured bet selection contract', () => {
  it('accepts only home, draw, or away without a line for 1X2', () => {
    for (const selectionCode of ['home', 'draw', 'away'] as const) {
      valid({ marketType: '1X2', marketPeriod: 'full_time', selectionCode });
    }
    invalid({ marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'over' }, 'selectionCode');
    invalid({ marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'home', lineValue: 0.5 }, 'lineValue');
  });

  it('requires over or under and a bounded quarter line for totals markets', () => {
    valid({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 3.25 });
    valid({ marketType: 'corners', marketPeriod: 'first_half', selectionCode: 'under', lineValue: 9.5 });
    invalid({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'home', lineValue: 2.5 }, 'selectionCode');
    invalid({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'over' }, 'lineValue');
    invalid({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 2.1 }, 'quarter-step');
    invalid({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 20.25 }, 'range');
    invalid({ marketType: 'corners', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 40.25 }, 'range');
  });

  it.each(['full_time', 'first_half'] as const)('accepts signed corner handicaps for %s', (marketPeriod) => {
    valid({ marketType: 'corners', marketPeriod, selectionCode: 'home', lineValue: -2.25 });
    valid({ marketType: 'corners', marketPeriod, selectionCode: 'away', lineValue: 2.25 });
    valid({ marketType: 'corners', marketPeriod, selectionCode: 'home', lineValue: 0 });
    invalid({ marketType: 'corners', marketPeriod, selectionCode: 'draw', lineValue: 0 }, 'selectionCode');
    invalid({ marketType: 'corners', marketPeriod, selectionCode: 'home', lineValue: -40.25 }, 'range');
    invalid({ marketType: 'corners', marketPeriod, selectionCode: 'away', lineValue: 1.1 }, 'quarter-step');
    invalid({ marketType: 'corners', marketPeriod, selectionCode: 'over', lineValue: -1 }, 'range');
    expect(formatStructuredSelectionLabel({ marketType: 'corners', marketPeriod, selectionCode: 'away', lineValue: 2.25 }, teams))
      .toBe(`Vietnam +2.25 corners · ${marketPeriod === 'full_time' ? 'FT' : 'HT'}`);
  });

  it('requires a side and signed quarter line for handicap', () => {
    valid({ marketType: 'handicap', marketPeriod: 'first_half', selectionCode: 'away', lineValue: -0.75 });
    valid({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'home', lineValue: 0 });
    invalid({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'draw', lineValue: 0 }, 'selectionCode');
    invalid({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'home', lineValue: 10.25 }, 'range');
  });

  it('requires a valid live context and target for running bets', () => {
    valid({ marketType: 'running', selectionCode: 'over', lineValue: 1.75, runningGoalThreshold: 0.75, runningWindow: 'to_half_time',
      liveScoreHome: 1, liveScoreAway: 0, liveMinute: 37, liveContextSource: 'snapshot',
      liveContextObservedAt: '2026-09-15T00:00:00.000Z' });
    valid({ marketType: 'running', selectionCode: 'over', lineValue: 0.5, runningWindow: 'fixed_15',
      windowStartMinute: 45, windowEndMinute: 60, liveScoreHome: 1, liveScoreAway: 1,
      liveMinute: 52, liveContextSource: 'manual' });
    invalid({ marketType: 'running', selectionCode: 'over', runningGoalThreshold: 0.5, runningWindow: 'to_full_time' }, 'score');
    invalid({ marketType: 'running', selectionCode: 'over', runningGoalThreshold: 0.5, runningWindow: 'to_half_time',
      liveScoreHome: 0, liveScoreAway: 0, liveMinute: 45, liveContextSource: 'manual' }, 'half-time');
    invalid({ marketType: 'running', selectionCode: 'over', runningWindow: 'fixed_15',
      windowStartMinute: 30, windowEndMinute: 45, liveScoreHome: 0, liveScoreAway: 0,
      liveMinute: 52, liveContextSource: 'manual' }, 'ended');
  });

  it('derives Running Over from score and goal threshold while allowing an omitted minute', () => {
    const running = {marketType:'running',runningWindow:'to_full_time',runningGoalThreshold:0.75,
      liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual'};
    expect(validateStructuredBetSelection(running)).toEqual({ok:true});
    expect(formatStructuredSelectionLabel(running as StructuredBetSelection,teams)).toBe('Over 2.75 · Running FT · 1-1');
    invalid({...running,selectionCode:'under',lineValue:2.75},'selectionCode');
    invalid({...running,selectionCode:'over',lineValue:0.75},'lineValue');
    invalid({...running,runningGoalThreshold:0.25},'runningGoalThreshold');
    invalid({...running,liveScoreHome:-1},'score');
    invalid({...running,liveMinute:90},'liveMinute');
  });

  it('forces 0.5 on a fixed 15-minute interval and does not invent an entry minute', () => {
    const fixed = {marketType:'running',runningWindow:'fixed_15',windowStartMinute:60,windowEndMinute:75,
      liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual'};
    expect(validateStructuredBetSelection(fixed)).toEqual({ok:true});
    expect(formatStructuredSelectionLabel(fixed as StructuredBetSelection,teams)).toBe('Over 0.5 · Running 60-75 · 1-1');
    invalid({...fixed,runningGoalThreshold:0.75},'runningGoalThreshold');
    invalid({...fixed,liveMinute:75},'ended');
  });

  it('rejects custom and unsupported market values', () => {
    invalid({ marketType: 'custom', selectionCode: 'home' }, 'marketType');
  });

  it('rejects fields that belong to another market shape', () => {
    invalid({ marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'home', runningWindow: 'to_full_time' }, 'running fields');
    invalid({ marketType: 'running', marketPeriod: 'full_time', selectionCode: 'over', runningGoalThreshold: 0.5,
      runningWindow: 'to_full_time', liveScoreHome: 0, liveScoreAway: 0, liveMinute: 20,
      liveContextSource: 'manual' }, 'marketPeriod');
    invalid({ marketType: 'running', selectionCode: 'over', runningGoalThreshold: 0.5, runningWindow: 'to_full_time',
      liveScoreHome: 0, liveScoreAway: 0, liveMinute: 20, liveContextSource: 'manual',
      liveContextObservedAt: '2026-09-15T00:00:00.000Z' }, 'manual context');
  });

  it('parses dot or comma quarter lines and rejects arbitrary text', () => {
    expect(parseQuarterLineInput('3.25')).toBe(3.25);
    expect(parseQuarterLineInput('3,25')).toBe(3.25);
    expect(parseQuarterLineInput('  -0,75 ')).toBe(-0.75);
    expect(parseQuarterLineInput('2.1')).toBeNull();
    expect(parseQuarterLineInput('over 2.5')).toBeNull();
  });

  it('creates stable canonical labels from codes instead of user text', () => {
    expect(formatStructuredSelectionLabel({ marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'home' }, teams)).toBe('Japan · FT');
    expect(formatStructuredSelectionLabel({ marketType: 'over_under', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 3.25 }, teams)).toBe('Over 3.25 · FT');
    expect(formatStructuredSelectionLabel({ marketType: 'handicap', marketPeriod: 'first_half', selectionCode: 'away', lineValue: 0.5 }, teams)).toBe('Vietnam +0.5 · HT');
    expect(formatStructuredSelectionLabel({ marketType: 'corners', marketPeriod: 'full_time', selectionCode: 'under', lineValue: 9.5 }, teams)).toBe('Under 9.5 corners · FT');
    expect(formatStructuredSelectionLabel({ marketType: 'running', selectionCode: 'over', lineValue: 1.75, runningGoalThreshold: 0.75,
      runningWindow: 'to_full_time', liveScoreHome: 1, liveScoreAway: 0, liveMinute: 67,
      liveContextSource: 'manual' }, teams)).toBe("Over 1.75 · Running FT · 1-0 @ 67'");
  });
});
