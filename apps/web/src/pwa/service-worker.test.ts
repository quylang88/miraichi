import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

function worker() {
  const events = new Map<string, (event: unknown) => void>();
  const cached = new Response('cached shell');
  const cache = { addAll: vi.fn(async (_urls: string[]) => undefined), match: vi.fn(async (_url: string) => cached), put: vi.fn(async () => undefined) };
  const caches = {
    open: vi.fn(async () => cache), match: vi.fn(async () => cached),
    keys: vi.fn(async () => ['miraichi-shell-v13-daily-live', 'another-app-cache', 'miraichi-shell-v14-instant-startup', 'miraichi-shell-v15-structured-add-bet', 'miraichi-shell-v16-evidence-settlement']),
    delete: vi.fn(async () => true)
  };
  const fetch = vi.fn(async () => new Response('network'));
  const source = readFileSync('apps/web/public/service-worker.ts', 'utf8')
    .replace('__MIRAICHI_WEB_HASH__', 'abc123');
  const script = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  runInNewContext(script, { exports: {}, URL, Response, caches, fetch,
    self: { location: { origin: 'https://app.example' }, addEventListener: (name: string, handler: (event: unknown) => void) => events.set(name, handler),
      skipWaiting: vi.fn(), clients: { claim: vi.fn() } } });
  async function lifecycle(name: string) {
    const pending: Promise<unknown>[] = [];
    events.get(name)!({ waitUntil: (work: Promise<unknown>) => pending.push(work) });
    await Promise.all(pending);
  }
  async function request(url: string, method = 'GET', mode = 'navigate') {
    let response: Promise<Response> | undefined;
    events.get('fetch')!({ request: { url, method, mode }, respondWith: (work: Promise<Response>) => { response = work; }, waitUntil: vi.fn() });
    return response;
  }
  return { cache, caches, fetch, lifecycle, request };
}

describe('installed startup cache', () => {
  it('precaches both self-contained script entries and the shell stylesheet', async () => {
    const { lifecycle, cache, caches } = worker();
    await lifecycle('install');
    expect(caches.open).toHaveBeenCalledWith('miraichi-shell-abc123');
    expect(cache.addAll.mock.calls[0]?.[0]).toEqual(expect.arrayContaining([
      '/', '/index.html', '/apps/web/src/auth-bootstrap.js',
      '/apps/web/src/pwa/register-service-worker.js', '/packages/ui/src/index.css'
    ]));
  });

  it('opens a saved tab URL from the active shell cache without waiting for network', async () => {
    const { request, fetch, cache } = worker();
    expect(await (await request('https://app.example/?tab=matches'))?.text()).toBe('cached shell');
    expect(cache.match).toHaveBeenCalledWith('/');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not cache session/API, mutations or third-party URLs', async () => {
    const { request, cache } = worker();
    await request('https://app.example/api/v1/auth/session');
    await request('https://third-party.example/index.html');
    await request('https://app.example/index.html', 'POST');
    expect(cache.match).not.toHaveBeenCalled();
    expect(cache.put).not.toHaveBeenCalled();
  });

  it('removes only obsolete Miraichi shell caches on activation', async () => {
    const { lifecycle, caches } = worker();
    await lifecycle('activate');
    expect(caches.delete.mock.calls).toEqual([
      ['miraichi-shell-v13-daily-live'],
      ['miraichi-shell-v14-instant-startup'],
      ['miraichi-shell-v15-structured-add-bet'],
      ['miraichi-shell-v16-evidence-settlement']
    ]);
  });
});
