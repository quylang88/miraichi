import { describe, expect, it } from 'vitest';
import { assertReleaseTargetBindings, getReleaseTarget } from './release-targets.js';

describe('release targets', () => {
  it('maps staging only to the Frankfurt staging branch and Worker environment', () => {
    expect(getReleaseTarget('staging')).toEqual({
      environment: 'staging',
      branch: 'staging',
      edgeRegion: 'eu-central-1',
      cloudflareEnvironment: 'staging',
      requiresOwnerBackup: false
    });
  });

  it('maps production only to main, Singapore, and the production Worker environment', () => {
    expect(getReleaseTarget('production')).toEqual({
      environment: 'production',
      branch: 'main',
      edgeRegion: 'ap-southeast-1',
      cloudflareEnvironment: 'production',
      requiresOwnerBackup: true
    });
  });

  it('rejects unknown targets and crossed production bindings before deployment', () => {
    expect(() => getReleaseTarget('prod')).toThrow('Unknown release environment');
    expect(() => assertReleaseTargetBindings(getReleaseTarget('production'), {
      branch: 'staging',
      edgeRegion: 'eu-central-1',
      cloudflareEnvironment: 'staging',
      publicOrigin: 'http://localhost:8787',
      edgeFunctionUrl: 'http://localhost:54321/functions/v1/miraichi-api'
    })).toThrow('Production release bindings do not match');
  });

  it('accepts only exact production bindings with an HTTPS non-local origin', () => {
    expect(() => assertReleaseTargetBindings(getReleaseTarget('production'), {
      branch: 'main',
      edgeRegion: 'ap-southeast-1',
      cloudflareEnvironment: 'production',
      publicOrigin: 'https://miraichi.example.com',
      edgeFunctionUrl: 'https://project-ref.supabase.co/functions/v1/miraichi-api'
    })).not.toThrow();
  });
});
