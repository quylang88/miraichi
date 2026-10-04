import { describe, expect, it } from 'vitest';
import { readCloudflareGatewayConfig } from './config.js';

const valid = {
  DEPLOYMENT_ENV: 'staging',
  MIRAICHI_EDGE_FUNCTION_URL: 'https://project-ref.supabase.co/functions/v1/miraichi-api',
  MIRAICHI_GATEWAY_TOKEN: 'gateway-token-with-at-least-thirty-two-bytes',
  MIRAICHI_PUBLIC_ORIGIN: 'https://miraichi-stage.workers.dev',
  MIRAICHI_EDGE_REGION: 'eu-central-1'
} as const;

const production = {
  ...valid,
  DEPLOYMENT_ENV: 'production',
  MIRAICHI_PUBLIC_ORIGIN: 'https://miraichi.example.com',
  MIRAICHI_EDGE_REGION: 'ap-southeast-1'
} as const;

describe('Cloudflare gateway config', () => {
  it('accepts the exact staging function, origin, and Frankfurt region', () => {
    expect(readCloudflareGatewayConfig(valid)).toEqual({
      deploymentEnv: 'staging',
      functionUrl: valid.MIRAICHI_EDGE_FUNCTION_URL,
      gatewayToken: valid.MIRAICHI_GATEWAY_TOKEN,
      publicOrigin: valid.MIRAICHI_PUBLIC_ORIGIN,
      region: 'eu-central-1'
    });
  });

  it('accepts the exact production function, origin, and Singapore region', () => {
    expect(readCloudflareGatewayConfig(production)).toEqual({
      deploymentEnv: 'production',
      functionUrl: production.MIRAICHI_EDGE_FUNCTION_URL,
      gatewayToken: production.MIRAICHI_GATEWAY_TOKEN,
      publicOrigin: production.MIRAICHI_PUBLIC_ORIGIN,
      region: 'ap-southeast-1'
    });
  });

  it.each([
    [{ ...production, MIRAICHI_EDGE_REGION: 'eu-central-1' }, 'ap-southeast-1'],
    [{ ...production, MIRAICHI_PUBLIC_ORIGIN: 'https://localhost' }, 'localhost'],
    [{ ...valid, DEPLOYMENT_ENV: 'production' }, 'ap-southeast-1']
  ])('rejects crossed or local production bindings', (environment, message) => {
    expect(() => readCloudflareGatewayConfig(environment)).toThrow(message);
  });

  it.each([
    [{ ...valid, MIRAICHI_EDGE_FUNCTION_URL: 'http://project-ref.supabase.co/functions/v1/miraichi-api' }, 'HTTPS'],
    [{ ...valid, MIRAICHI_EDGE_FUNCTION_URL: 'https://project-ref.supabase.co/functions/v1/other' }, 'miraichi-api'],
    [{ ...valid, MIRAICHI_PUBLIC_ORIGIN: 'https://miraichi-stage.workers.dev/path' }, 'origin'],
    [{ ...valid, MIRAICHI_EDGE_REGION: 'ap-northeast-1' }, 'eu-central-1'],
    [{ ...valid, MIRAICHI_GATEWAY_TOKEN: 'short' }, '32 bytes']
  ])('rejects an unsafe or inconsistent binding', (environment, message) => {
    expect(() => readCloudflareGatewayConfig(environment)).toThrow(message);
  });

  it('rejects database, provider, owner, session, and refresh credentials in Worker bindings', () => {
    for (const forbidden of [
      'SUPABASE_DB_URL', 'SPORTSCORE_API_KEY', 'MIRAICHI_OWNER_PASSWORD_HASH',
      'MIRAICHI_SESSION_SECRET', 'MIRAICHI_REFRESH_TOKEN'
    ]) {
      expect(() => readCloudflareGatewayConfig({ ...valid, [forbidden]: 'must-not-be-here' }))
        .toThrow('forbidden secret binding');
    }
  });
});
