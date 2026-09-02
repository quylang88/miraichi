import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  isAuthorizedHourlyLiveRefresh,
  readLiveRefreshServiceAuthConfig
} from './live-refresh-service-auth.js';

function request(method: string, url: string, authorization?: string) {
  const req = Readable.from([]) as Readable & {
    method: string;
    url: string;
    headers: Record<string, string>;
  };
  req.method = method;
  req.url = url;
  req.headers = authorization ? { authorization } : {};
  return req;
}

describe('hourly live refresh service authentication', () => {
  const token = 'hourly-refresh-token-with-at-least-32-bytes';

  it('requires a strong token when the hosted SportScore widget flow is enabled', () => {
    expect(() => readLiveRefreshServiceAuthConfig({
      APP_ENV: 'production',
      SPORTSCORE_LIVE_MODE: 'widget'
    })).toThrow(/MIRAICHI_REFRESH_TOKEN/);
    expect(() => readLiveRefreshServiceAuthConfig({
      APP_ENV: 'production',
      SPORTSCORE_LIVE_MODE: 'widget',
      MIRAICHI_REFRESH_TOKEN: 'too-short'
    })).toThrow(/at least 32 bytes/);
    expect(readLiveRefreshServiceAuthConfig({
      APP_ENV: 'production',
      SPORTSCORE_LIVE_MODE: 'widget',
      MIRAICHI_REFRESH_TOKEN: token
    })).toEqual({ token });
  });

  it('allows the bearer token only for the exact POST hourly refresh operation', () => {
    const config = { token };
    expect(isAuthorizedHourlyLiveRefresh(
      request('POST', '/api/v1/live/refresh?reason=hourly', `Bearer ${token}`) as never,
      config
    )).toBe(true);

    for (const req of [
      request('GET', '/api/v1/live/refresh?reason=hourly', `Bearer ${token}`),
      request('POST', '/api/v1/live/refresh?reason=visible', `Bearer ${token}`),
      request('POST', '/api/v1/live/refresh?reason=hourly&extra=1', `Bearer ${token}`),
      request('GET', '/api/v1/bankroll/accounts', `Bearer ${token}`),
      request('POST', '/api/v1/live/refresh?reason=hourly', `Bearer ${token}x`),
      request('POST', '/api/v1/live/refresh?reason=hourly')
    ]) {
      expect(isAuthorizedHourlyLiveRefresh(req as never, config)).toBe(false);
    }
  });

  it('stays disabled when live widget refresh is disabled', () => {
    const config = readLiveRefreshServiceAuthConfig({ APP_ENV: 'production', SPORTSCORE_LIVE_MODE: 'disabled' });
    expect(config).toEqual({ token: undefined });
    expect(isAuthorizedHourlyLiveRefresh(
      request('POST', '/api/v1/live/refresh?reason=hourly', `Bearer ${token}`) as never,
      config
    )).toBe(false);
  });
});
