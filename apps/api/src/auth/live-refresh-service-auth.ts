import { createHash, timingSafeEqual } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

const MIN_TOKEN_BYTES = 32;

export interface LiveRefreshServiceAuthConfig {
  readonly token: string | undefined;
}

function secureEqual(actual: string, expected: string): boolean {
  const actualDigest = createHash('sha256').update(actual, 'utf8').digest();
  const expectedDigest = createHash('sha256').update(expected, 'utf8').digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function readLiveRefreshServiceAuthConfig(
  env: NodeJS.ProcessEnv = process.env
): LiveRefreshServiceAuthConfig {
  const token = env.MIRAICHI_REFRESH_TOKEN?.trim();
  if (token && Buffer.byteLength(token, 'utf8') < MIN_TOKEN_BYTES) {
    throw new Error(`MIRAICHI_REFRESH_TOKEN must be at least ${MIN_TOKEN_BYTES} bytes`);
  }
  const hostedWidgetEnabled = env.APP_ENV?.trim() !== 'local'
    && env.APP_ENV?.trim() !== 'test'
    && env.SPORTSCORE_LIVE_MODE?.trim() === 'widget';
  if (hostedWidgetEnabled && !token) {
    throw new Error('MIRAICHI_REFRESH_TOKEN is required for hosted SportScore widget refresh');
  }
  return { token };
}

export function isAuthorizedHourlyLiveRefresh(
  req: IncomingMessage,
  config: LiveRefreshServiceAuthConfig
): boolean {
  if (!config.token || req.method !== 'POST') return false;
  const url = new URL(req.url || '/', 'http://localhost');
  if (url.pathname !== '/api/v1/live/refresh' || url.search !== '?reason=hourly') return false;
  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false;
  return secureEqual(authorization.slice('Bearer '.length), config.token);
}
