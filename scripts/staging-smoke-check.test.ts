import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  DEFAULT_PHASE_5_12_CACHE_MARKER,
  buildStagingSmokeChecks,
  normalizeBaseUrl,
  resolveCliBaseUrl,
  runStagingSmokeCheck
} from './staging-smoke-check.js';

function createResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => body
  };
}

function createFetchStub(responsesByUrl) {
  const calls = [];

  async function fetchStub(url) {
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

  it('builds Phase 5.12 smoke targets from a base URL', () => {
    expect(buildStagingSmokeChecks('https://example.pages.dev')).toEqual([
      {
        label: 'root shell',
        url: 'https://example.pages.dev/',
        markers: ['Miraichi', 'shell-entry', 'app-root']
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
        markers: ['renderAppShell']
      },
      {
        label: 'ui css',
        url: 'https://example.pages.dev/packages/ui/src/index.css',
        markers: ['main-scroll']
      }
    ]);
  });

  it('passes when every staging endpoint returns expected markers', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }')
    });

    const result = await runStagingSmokeCheck({
      baseUrl,
      fetchImpl: fetchStub
    });

    expect(result.ok).toBe(true);
    expect(result.results.map((entry) => entry.ok)).toEqual([true, true, true, true, true]);
    expect(fetchStub.calls).toEqual(buildStagingSmokeChecks(baseUrl).map((check) => check.url));
  });

  it('reports missing markers without leaking response bodies', async () => {
    const baseUrl = 'https://example.pages.dev';
    const fetchStub = createFetchStub({
      [`${baseUrl}/`]: createResponse('<div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse(JSON.stringify({ name: 'Miraichi' })),
      [`${baseUrl}/service-worker.js`]: createResponse('old-cache-marker-secret-like-text'),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }')
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
      [`${baseUrl}/`]: createResponse('<div id="app-root">Miraichi shell-entry</div>'),
      [`${baseUrl}/manifest.webmanifest`]: createResponse('{bad-json'),
      [`${baseUrl}/service-worker.js`]: createResponse(DEFAULT_PHASE_5_12_CACHE_MARKER),
      [`${baseUrl}/apps/web/src/shell-entry.js`]: createResponse('export function renderAppShell() {}'),
      [`${baseUrl}/packages/ui/src/index.css`]: createResponse('.main-scroll { overflow-y: auto; }')
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

  it('wires the root package smoke:staging script to the smoke checker', () => {
    const packageJson = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'));

    expect(packageJson.scripts['smoke:staging']).toBe('node scripts/staging-smoke-check.js');
  });
});
