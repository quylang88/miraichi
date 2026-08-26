import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_PHASE_5_12_CACHE_MARKER,
  buildStagingSmokeChecks,
  normalizeBaseUrl,
  resolveCliBaseUrl,
  resolveStagingApiBaseUrl,
  runStagingSmokeCheck
} from './staging-smoke-check.js';

type TestResponse = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
};

function createResponse(body: string, status = 200): TestResponse {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

function createFetchStub(responsesByUrl: Record<string, TestResponse>) {
  const calls: string[] = [];

  async function fetchStub(url: string) {
    calls.push(url);
    const response = responsesByUrl[url];

    if (!response) {
      return createResponse('not found', 404);
    }

    return response;
  }

  fetchStub.calls = calls;
  return fetchStub;
}

describe('staging smoke check helpers', () => {
  it('normalizes base URLs and rejects empty URLs', () => {
    expect(normalizeBaseUrl('https://example.pages.dev/')).toBe('https://example.pages.dev');
    expect(() => normalizeBaseUrl('   ')).toThrow('Staging URL is required');
  });

  it('resolves pnpm pass-through CLI arguments without treating -- as the URL', () => {
    expect(resolveCliBaseUrl(['node', 'script.js', '--', 'https://example.pages.dev'], {})).toBe(
      'https://example.pages.dev'
    );
    expect(resolveCliBaseUrl(['node', 'script.js'], { STAGING_URL: 'https://env.pages.dev' })).toBe(
      'https://env.pages.dev'
    );
  });

  it('resolves a remote runtime API URL and rejects missing or loopback configuration', () => {
    expect(resolveStagingApiBaseUrl(
      '<script>window.MIRAICHI_ENV={API_URL:"https://api.example.com/"}</script>',
      'https://example.pages.dev'
    )).toBe('https://api.example.com');
    expect(() => resolveStagingApiBaseUrl('<div>Miraichi</div>', 'https://example.pages.dev')).toThrow(
      'root shell does not expose API_URL'
    );
    expect(() => resolveStagingApiBaseUrl(
      '<script>window.MIRAICHI_ENV={API_URL:"http://localhost:3001"}</script>',
      'https://example.pages.dev'
    )).toThrow('API_URL points to a loopback host');
  });

  it('builds Phase 5.12 smoke targets from a base URL', () => {
    expect(buildStagingSmokeChecks('https://example.pages.dev')).toEqual([
      {
        label: 'root shell',
        url: 'https://example.pages.dev/',
        markers: ['Miraichi', 'shell-entry', 'app-root', 'type="importmap"', 'window.MIRAICHI_ENV', 'API_URL'],
        forbiddenMarkers: ['API_URL: "http://localhost', 'API_URL: "http://127.0.0.1']
      },
      {
        label: 'manifest',
        url: 'https://example.pages.dev/manifest.webmanifest',
        json: {
          name: 'Miraichi'
        }
      },
      {
        label: 'service worker',
        url: 'https://example.pages.dev/service-worker.js',
        markers: [DEFAULT_PHASE_5_12_CACHE_MARKER]
      },
      {
        label: 'shell entry',
        url: 'https://example.pages.dev/apps/web/src/shell-entry.js',
        markers: ['renderAppShell'],
        forbiddenMarkers: ['<!DOCTYPE html>']
      },
      {
        label: 'client environment',
        url: 'https://example.pages.dev/apps/web/src/config/client-env.js',
        markers: ['getApiBaseUrl'],
        forbiddenMarkers: ['<!DOCTYPE html>']
      },
      {
        label: 'match feed service',
        url: 'https://example.pages.dev/apps/web/src/services/match-feed-service.js',
        markers: ['/api/v1/matches'],
        forbiddenMarkers: ['<!DOCTYPE html>']
      },
      {
        label: 'ui css',
        url: 'https://example.pages.dev/packages/ui/src/index.css',
        markers: ['main-scroll'],
        forbiddenMarkers: ['<!DOCTYPE html>']
      }
    ]);
  });

  it('passes when every staging endpoint returns expected markers', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<script type="importmap"></script><script>window.MIRAICHI_ENV={API_URL:"https://api.example.com"}</script><div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/apps/web/src/config/client-env.js`]: createResponse('export function getApiBaseUrl() {}'),
      [`${baseUrl}/apps/web/src/services/match-feed-service.js`]: createResponse('fetch("/api/v1/matches")'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }'),
      'https://api.example.com/api/v1/health': createResponse(JSON.stringify({ status: 'ok' }))
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(true);
    expect(result.results.map((entry) => entry.ok)).toEqual([true, true, true, true, true, true, true, true, true]);
    expect(fetchStub.calls).toEqual([
      ...buildStagingSmokeChecks(baseUrl).map((check) => check.url),
      `${baseUrl}/`,
      'https://api.example.com/api/v1/health'
    ]);
  });

  it('reports missing markers without leaking response bodies', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<script type="importmap"></script><script>window.MIRAICHI_ENV={API_URL:"https://api.example.com"}</script><div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse('old-cache-marker-secret-like-text'),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/apps/web/src/config/client-env.js`]: createResponse('export function getApiBaseUrl() {}'),
      [`${baseUrl}/apps/web/src/services/match-feed-service.js`]: createResponse('fetch("/api/v1/matches")'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }'),
      'https://api.example.com/api/v1/health': createResponse(JSON.stringify({ status: 'ok' }))
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(false);
    expect(result.results.find((entry) => entry.label === 'service worker')).toEqual({
      label: 'service worker',
      url: 'https://example.pages.dev/service-worker.js',
      ok: false,
      status: 200,
      message: `missing marker: ${DEFAULT_PHASE_5_12_CACHE_MARKER}`
    });
  });

  it('reports malformed manifest JSON', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<script type="importmap"></script><script>window.MIRAICHI_ENV={API_URL:"https://api.example.com"}</script><div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse('{bad-json'),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/apps/web/src/config/client-env.js`]: createResponse('export function getApiBaseUrl() {}'),
      [`${baseUrl}/apps/web/src/services/match-feed-service.js`]: createResponse('fetch("/api/v1/matches")'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }'),
      'https://api.example.com/api/v1/health': createResponse(JSON.stringify({ status: 'ok' }))
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(false);
    expect(result.results.find((entry) => entry.label === 'manifest')?.message).toBe(
      'invalid JSON response'
    );
  });

  it('rejects a Pages SPA fallback returned for a missing JavaScript module', async () => {
    const baseUrl = 'https://example.pages.dev';
    const shellHtml = '<!DOCTYPE html><div id="app-root">Miraichi shell-entry</div>';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<script type="importmap"></script><script>window.MIRAICHI_ENV={API_URL:"https://api.example.com"}</script><div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/apps/web/src/config/client-env.js`]: createResponse(shellHtml),
      [`${baseUrl}/apps/web/src/services/match-feed-service.js`]: createResponse('fetch("/api/v1/matches")'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }'),
      'https://api.example.com/api/v1/health': createResponse(JSON.stringify({ status: 'ok' }))
    });

    const result = await runStagingSmokeCheck({ baseUrl, fetchImpl: fetchStub });

    expect(result.ok).toBe(false);
    expect(result.results.find((entry) => entry.label === 'client environment')?.message).toBe(
      'missing marker: getApiBaseUrl'
    );
  });

  it('fails when the configured staging API health route returns Pages fallback HTML', async () => {
    const baseUrl = 'https://example.pages.dev';
    const rootHtml = '<script type="importmap"></script><script>window.MIRAICHI_ENV={API_URL:"https://api.example.com"}</script><div id="app-root">Miraichi shell-entry</div>';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse(rootHtml),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/apps/web/src/config/client-env.js`]: createResponse('export function getApiBaseUrl() {}'),
      [`${baseUrl}/apps/web/src/services/match-feed-service.js`]: createResponse('fetch("/api/v1/matches")'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }'),
      'https://api.example.com/api/v1/health': createResponse('<!DOCTYPE html><div>Miraichi</div>')
    });

    const result = await runStagingSmokeCheck({ baseUrl, fetchImpl: fetchStub });

    expect(result.ok).toBe(false);
    expect(result.results.find((entry) => entry.label === 'API health')?.message).toBe(
      'forbidden marker: <!DOCTYPE html>'
    );
  });

  it('wires the root package smoke:staging script to the smoke checker', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

    expect(packageJson.scripts['smoke:staging']).toBe('tsx scripts/staging-smoke-check.ts');
  });
});
