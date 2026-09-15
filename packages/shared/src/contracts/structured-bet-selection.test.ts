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

  it('requires a side and signed quarter line for handicap', () => {
    valid({ marketType: 'handicap', marketPeriod: 'first_half', selectionCode: 'away', lineValue: -0.75 });
    valid({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'home', lineValue: 0 });
    invalid({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'draw', lineValue: 0 }, 'selectionCode');
    invalid({ marketType: 'handicap', marketPeriod: 'full_time', selectionCode: 'home', lineValue: 10.25 }, 'range');
  });

  it('requires a valid live context and target for running bets', () => {
    valid({ marketType: 'running', selectionCode: 'over', lineValue: 0.75, runningWindow: 'to_half_time',
      liveScoreHome: 1, liveScoreAway: 0, liveMinute: 37, liveContextSource: 'snapshot',
      liveContextObservedAt: '2026-09-15T00:00:00.000Z' });
    valid({ marketType: 'running', selectionCode: 'under', lineValue: 1.5, runningWindow: 'fixed_15',
      windowStartMinute: 45, windowEndMinute: 60, liveScoreHome: 1, liveScoreAway: 1,
      liveMinute: 52, liveContextSource: 'manual' });
    invalid({ marketType: 'running', selectionCode: 'over', lineValue: 1, runningWindow: 'to_full_time' }, 'live context');
    invalid({ marketType: 'running', selectionCode: 'over', lineValue: 1, runningWindow: 'to_half_time',
      liveScoreHome: 0, liveScoreAway: 0, liveMinute: 45, liveContextSource: 'manual' }, 'half-time');
    invalid({ marketType: 'running', selectionCode: 'over', lineValue: 1, runningWindow: 'fixed_15',
      windowStartMinute: 30, windowEndMinute: 45, liveScoreHome: 0, liveScoreAway: 0,
      liveMinute: 52, liveContextSource: 'manual' }, 'ended');
  });

  it('rejects custom and unsupported market values', () => {
    invalid({ marketType: 'custom', selectionCode: 'home' }, 'marketType');
  });

  it('rejects fields that belong to another market shape', () => {
    invalid({ marketType: '1X2', marketPeriod: 'full_time', selectionCode: 'home', runningWindow: 'to_full_time' }, 'running fields');
    invalid({ marketType: 'running', marketPeriod: 'full_time', selectionCode: 'over', lineValue: 1,
      runningWindow: 'to_full_time', liveScoreHome: 0, liveScoreAway: 0, liveMinute: 20,
      liveContextSource: 'manual' }, 'marketPeriod');
    invalid({ marketType: 'running', selectionCode: 'over', lineValue: 1, runningWindow: 'to_full_time',
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
    expect(formatStructuredSelectionLabel({ marketType: 'running', selectionCode: 'over', lineValue: 0.75,
      runningWindow: 'to_full_time', liveScoreHome: 1, liveScoreAway: 0, liveMinute: 67,
      liveContextSource: 'manual' }, teams)).toBe("Over 0.75 · Running FT · 1-0 @ 67'");
  });
});
