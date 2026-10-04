import { describe, expect, it } from 'vitest';
import { structuredBetMarketCatalog } from './betting-market-catalog.js';

describe('structured betting market catalog', () => {
  it('offers the approved creatable markets without Custom', () => {
    expect(structuredBetMarketCatalog.markets.map((market) => market.marketType)).toEqual([
      '1X2', 'over_under', 'handicap', 'corners', 'running'
    ]);
    expect(structuredBetMarketCatalog.markets.find((market)=>market.marketType==='running')?.selections).toEqual(['over']);
  });

  it('contains the approved common line presets', () => {
    expect(structuredBetMarketCatalog.linePresets.goalsFullTime).toEqual([1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5]);
    expect(structuredBetMarketCatalog.linePresets.halfTimeAndRunning).toEqual([0.5, 0.75, 1, 1.25, 1.5]);
    expect(structuredBetMarketCatalog.linePresets.handicap).toEqual([
      -1.5, -1.25, -1, -0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75, 1, 1.25, 1.5
    ]);
    expect(structuredBetMarketCatalog.linePresets.corners).toEqual([7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11]);
    expect(structuredBetMarketCatalog.linePresets.cornersFirstHalf).toEqual([2.5, 3.5, 4.5, 5.5, 6.5]);
    expect(structuredBetMarketCatalog.linePresets.cornersFirstHalf).not.toContain(5.6);
    expect(structuredBetMarketCatalog.runningWindows).toEqual([
      { startMinute: 0, endMinute: 15 }, { startMinute: 15, endMinute: 30 },
      { startMinute: 30, endMinute: 45 }, { startMinute: 45, endMinute: 60 },
      { startMinute: 60, endMinute: 75 }, { startMinute: 75, endMinute: 90 }
    ]);
  });
});
