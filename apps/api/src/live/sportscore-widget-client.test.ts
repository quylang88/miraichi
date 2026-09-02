import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { SportScoreWidgetClient, SportScoreWidgetClientError } from './sportscore-widget-client.js';

function jsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload)
  } as Response;
}

describe('SportScore widget-only client', () => {
  it('can construct only the two approved football widget requests', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _init?: RequestInit) => jsonResponse({ matches: [] }));
    const client = new SportScoreWidgetClient({ fetcher, timeoutMs: 1_000 });

    await client.listMatches();
    await client.getMatch('arsenal-vs-liverpool');

    expect(fetcher.mock.calls.map(([url]) => String(url))).toEqual([
      'https://sportscore.com/api/widget/matches/?sport=football&limit=50',
      'https://sportscore.com/api/widget/match/?sport=football&slug=arsenal-vs-liverpool'
    ]);
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: 'GET', redirect: 'error' });
    const source = readFileSync(fileURLToPath(new URL('./sportscore-widget-client.ts', import.meta.url)), 'utf8');
    expect(source).not.toContain('/api/v1');
    expect(source).not.toContain('baseUrl');
  });

  it('rejects arbitrary slugs and an oversized list contract before data can be published', async () => {
    const fetcher = vi.fn(async () => jsonResponse({ matches: Array.from({ length: 51 }, () => ({})) }));
    const client = new SportScoreWidgetClient({ fetcher });
    await expect(client.getMatch('https://attacker.example/')).rejects.toMatchObject({ code: 'invalid_request' });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(client.listMatches()).rejects.toMatchObject({ code: 'invalid_payload' });
  });

  it('maps timeout/network/http/json failures to sanitized stable error codes', async () => {
    const http = new SportScoreWidgetClient({ fetcher: async () => jsonResponse({}, 503) });
    await expect(http.listMatches()).rejects.toEqual(expect.objectContaining<Partial<SportScoreWidgetClientError>>({ code: 'http_status' }));
    const invalid = new SportScoreWidgetClient({ fetcher: async () => ({ ok: true, status: 200, text: async () => '{bad' }) as Response });
    await expect(invalid.listMatches()).rejects.toMatchObject({ code: 'invalid_json' });
    const network = new SportScoreWidgetClient({ fetcher: async () => { throw new Error('secret upstream detail'); } });
    await expect(network.listMatches()).rejects.toMatchObject({ code: 'network' });
    const timedOut = new SportScoreWidgetClient({
      timeoutMs: 500,
      fetcher: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
      })
    });
    await expect(timedOut.listMatches()).rejects.toMatchObject({ code: 'timeout' });
  });
});
