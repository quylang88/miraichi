import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { rmSync } from 'node:fs';
import {
  assertHostedWebReady,
  resolveHostedWebRequest,
  serveHostedWeb
} from './hosted-static-server.js';

const roots: string[] = [];

async function fixtureRoot(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'miraichi-hosted-web-'));
  roots.push(root);
  await mkdir(path.join(root, 'assets'));
  await writeFile(path.join(root, 'index.html'), '<!doctype html><div id="app-root"></div>');
  await writeFile(path.join(root, 'assets', 'app.js'), 'export const ready = true;');
  return root;
}

afterEach(() => {
  roots.splice(0).forEach((root) => rmSync(root, { force: true, recursive: true }));
});

describe('hosted static PWA server', () => {
  it('fails hosted startup when the built PWA entry is missing', () => {
    expect(() => assertHostedWebReady('C:/missing/miraichi-web-root')).toThrow(/built PWA/i);
  });

  it('resolves assets and SPA routes but rejects API paths and traversal', async () => {
    const root = await fixtureRoot();
    expect(resolveHostedWebRequest(root, '/assets/app.js')).toMatchObject({ kind: 'file', contentType: 'text/javascript; charset=utf-8' });
    expect(resolveHostedWebRequest(root, '/matches/today')).toMatchObject({ kind: 'file', filePath: path.join(root, 'index.html') });
    expect(resolveHostedWebRequest(root, '/api/v1/health')).toEqual({ kind: 'not-found' });
    expect(resolveHostedWebRequest(root, '/../package.json')).toEqual({ kind: 'not-found' });
    expect(resolveHostedWebRequest(root, '/%2e%2e/package.json')).toEqual({ kind: 'not-found' });
  });

  it('serves GET/HEAD without accepting mutation methods', async () => {
    const root = await fixtureRoot();
    const response = () => ({
      statusCode: 0,
      headers: {} as Record<string, string | number>,
      body: '',
      writeHead(code: number, headers?: Record<string, string | number>) { this.statusCode = code; this.headers = headers ?? {}; },
      end(body?: unknown) { this.body = String(body ?? ''); }
    });

    const getOut = response();
    expect(await serveHostedWeb({ method: 'GET', url: '/assets/app.js' } as never, getOut as never, root)).toBe(true);
    expect(getOut.statusCode).toBe(200);
    expect(getOut.body).toContain('ready = true');

    const headOut = response();
    expect(await serveHostedWeb({ method: 'HEAD', url: '/' } as never, headOut as never, root)).toBe(true);
    expect(headOut.statusCode).toBe(200);
    expect(headOut.body).toBe('');

    const postOut = response();
    expect(await serveHostedWeb({ method: 'POST', url: '/' } as never, postOut as never, root)).toBe(false);
  });
});
