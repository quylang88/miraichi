import { describe, expect, it } from 'vitest';
import { readLiveDataMode } from './live-data-mode.js';
import { readLiveRefreshServiceAuthConfig } from '../auth/live-refresh-service-auth.js';
describe('explicit live data source selection', () => {
  it('selects daily LIVE while retaining explicit disabled and legacy widget compatibility', () => {
    expect(readLiveDataMode({ LIVE_DATA_MODE: 'fotmob-daily', SPORTSCORE_LIVE_MODE: 'widget' })).toBe('fotmob-daily');
    expect(readLiveDataMode({ LIVE_DATA_MODE: 'disabled', SPORTSCORE_LIVE_MODE: 'widget' })).toBe('disabled');
    expect(readLiveDataMode({ SPORTSCORE_LIVE_MODE: 'widget' })).toBe('sportscore-widget');
    expect(readLiveDataMode({})).toBe('disabled');
    expect(() => readLiveDataMode({ LIVE_DATA_MODE: 'unknown' })).toThrow();
  });
  it('requires service authentication for hosted daily LIVE', () => {
    expect(() => readLiveRefreshServiceAuthConfig({ APP_ENV: 'staging', LIVE_DATA_MODE: 'fotmob-daily' })).toThrow('MIRAICHI_REFRESH_TOKEN');
  });
});
