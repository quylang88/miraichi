import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  SportScoreClient,
  SportScoreClientError,
  type SportScoreRequestObservation
} from './sportscore-client.js';
import { SportScoreRawEvidenceCache } from './sportscore-raw-evidence-cache.js';

let fixturePayload: unknown;
let matchPayload: unknown;
const temporaryRoots: string[] = [];

beforeAll(async () => {
  fixturePayload = JSON.parse(await readFile(
    new URL('../../fixtures/sportscore-fixtures-response.mock.json', import.meta.url),
    'utf8'
  ));
  matchPayload = JSON.parse(await readFile(
    new URL('../../fixtures/sportscore-match-response.mock.json', import.meta.url),
    'utf8'
  ));
});

afterEach(async () => {
  vi.restoreAllMocks();
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true
  })));
});

function jsonResponse(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json',
      ...Object.fromEntries(new Headers(headers).entries())
    }
  });
}

function fixturesRequest(date = '2026-08-26', competition = 'english-premier-league') {
  return { date, competition };
}

describe('SportScoreClient request boundary', () => {
  it('supports anonymous fixture requests with the documented bounded query', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixturePayload));
    const client = new SportScoreClient({ apiKey: '  ', fetchFn });

    const result = await client.getFixtures(fixturesRequest());

    expect(result.matches).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    const [request, init] = fetchFn.mock.calls[0] ?? [];
    const url = new URL(String(request));
    const headers = new Headers(init?.headers);

    expect(url.origin).toBe('https://sportscore.com');
    expect(url.pathname).toBe('/api/v1/fixtures/');
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      sport: 'football',
      date: '2026-08-26',
      competition: 'english-premier-league',
      limit: '200'
    });
    expect(headers.has('X-Api-Key')).toBe(false);
    expect(init?.redirect).toBe('manual');
  });

  it('sends an optional key only to the exact allowlisted HTTPS origin and never follows redirects', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(fixturePayload));
    const client = new SportScoreClient({
      apiKey: 'private-test-key',
      fetchFn
    });

    await client.getFixtures(fixturesRequest());

    const [request, init] = fetchFn.mock.calls[0] ?? [];
    expect(new URL(String(request)).origin).toBe('https://sportscore.com');
    expect(new Headers(init?.headers).get('X-Api-Key')).toBe('private-test-key');
    expect(init?.redirect).toBe('manual');

    for (const baseUrl of [
      'http://sportscore.com',
      'https://sportscore.com.attacker.example',
      'https://attacker.example',
      'https://user:pass@sportscore.com'
    ]) {
      expect(() => new SportScoreClient({
        apiKey: 'private-test-key',
        baseUrl,
        fetchFn
      })).toThrow(SportScoreClientError);
    }

    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('uses the documented widget match endpoint without forwarding the fixture API key', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(matchPayload));
    const client = new SportScoreClient({
      apiKey: 'fixture-endpoint-only-key',
      fetchFn
    });

    const result = await client.getMatch({
      slug: 'northbridge-athletic-vs-rivergate-city'
    });

    expect(result).toEqual(matchPayload);
    const [request] = fetchFn.mock.calls[0] ?? [];
    const url = new URL(String(request));
    expect(url.pathname).toBe('/api/widget/match/');
    expect(Object.fromEntries(url.searchParams.entries())).toEqual({
      sport: 'football',
      slug: 'northbridge-athletic-vs-rivergate-city',
      src: 'miraichi'
    });
    expect(new Headers(fetchFn.mock.calls[0]?.[1]?.headers).has('X-Api-Key')).toBe(false);
  });

  it('times out a transport that does not settle and surfaces a typed error', async () => {
    const fetchFn = vi.fn<typeof fetch>().mockImplementation((_request, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('aborted', 'AbortError'));
      });
    }));
    const client = new SportScoreClient({
      fetchFn,
      timeoutMs: 5,
      maxRetries: 0
    });

    await expect(client.getFixtures(fixturesRequest())).rejects.toMatchObject({
      name: 'SportScoreClientError',
      code: 'timeout'
    });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('keeps the timeout active until the successful response body is consumed', async () => {
    const neverEndingBody = new ReadableStream<Uint8Array>({
      start: () => undefined
    });
    const client = new SportScoreClient({
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(new Response(neverEndingBody, {
        status: 200
      })),
      timeoutMs: 5,
      maxRetries: 0
    });

    await expect(client.getFixtures(fixturesRequest())).rejects.toMatchObject({
      code: 'timeout'
    });
  });

  it('retries 429 and 503 with bounded exponential backoff', async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 429))
      .mockResolvedValueOnce(jsonResponse({ error: 'unavailable' }, 503))
      .mockResolvedValueOnce(jsonResponse(fixturePayload));
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);
    const client = new SportScoreClient({
      fetchFn,
      sleep,
      initialBackoffMs: 100,
      maxBackoffMs: 500,
      maxRetries: 2,
      random: () => 0
    });

    const result = await client.getFixtures(fixturesRequest());

    expect(result.matches).toHaveLength(1);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[100], [200]]);
  });

  it('lets the quota-aware scheduler disable retries for one fixture request', async () => {
    const fetchFn = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: 'busy' }, 429))
      .mockResolvedValueOnce(jsonResponse(fixturePayload));
    const sleep = vi.fn<(milliseconds: number) => Promise<void>>().mockResolvedValue(undefined);
    const client = new SportScoreClient({
      fetchFn,
      sleep,
      maxRetries: 2
    });

    await expect(client.getFixtures({
      ...fixturesRequest(),
      maxRetries: 0
    })).rejects.toMatchObject({ code: 'http_status', statusCode: 429 });
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('coalesces concurrent identical requests and reuses a fresh response cache entry', async () => {
    let releaseFirstRequest: ((response: Response) => void) | undefined;
    let currentTime = Date.parse('2026-08-26T00:00:00Z');
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => new Promise<Response>((resolve) => {
      releaseFirstRequest = resolve;
    }));
    const client = new SportScoreClient({
      fetchFn,
      now: () => currentTime,
      responseCacheTtlMs: 60_000
    });

    const first = client.getFixtures(fixturesRequest());
    const coalesced = client.getFixtures(fixturesRequest());

    expect(fetchFn).toHaveBeenCalledTimes(1);
    releaseFirstRequest?.(jsonResponse(fixturePayload));
    const [firstResult, coalescedResult] = await Promise.all([first, coalesced]);
    expect(coalescedResult).toBe(firstResult);

    expect(await client.getFixtures(fixturesRequest())).toBe(firstResult);
    expect(fetchFn).toHaveBeenCalledTimes(1);

    currentTime += 60_001;
    fetchFn.mockResolvedValueOnce(jsonResponse(fixturePayload));
    await client.getFixtures(fixturesRequest());
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('caps concurrent transport calls across different request keys', async () => {
    const pending: Array<() => void> = [];
    let active = 0;
    let peak = 0;
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => {
      active += 1;
      peak = Math.max(peak, active);
      return new Promise<Response>((resolve) => {
        pending.push(() => {
          active -= 1;
          resolve(jsonResponse(fixturePayload));
        });
      });
    });
    const client = new SportScoreClient({ fetchFn, maxConcurrency: 2 });

    const requests = ['alpha-league', 'beta-league', 'gamma-league', 'delta-league']
      .map((competition) => client.getFixtures(fixturesRequest('2026-08-26', competition)));

    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(2));
    pending.splice(0, 2).forEach((release) => release());
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(4));
    pending.splice(0).forEach((release) => release());
    await Promise.all(requests);

    expect(peak).toBe(2);
  });

  it('rejects invalid JSON and valid JSON with an invalid fixture envelope', async () => {
    const invalidJsonClient = new SportScoreClient({
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(new Response('{not-json', { status: 200 })),
      maxRetries: 0
    });
    const invalidPayloadClient = new SportScoreClient({
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ matches: 'not-an-array' })),
      maxRetries: 0
    });

    await expect(invalidJsonClient.getFixtures(fixturesRequest())).rejects.toMatchObject({
      code: 'invalid_json'
    });
    await expect(invalidPayloadClient.getFixtures(fixturesRequest())).rejects.toMatchObject({
      code: 'invalid_payload'
    });
  });

  it('records sanitized observations and bounded private raw evidence without the key', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'miraichi-sportscore-evidence-'));
    temporaryRoots.push(root);
    const observations: SportScoreRequestObservation[] = [];
    let currentTime = Date.parse('2026-08-26T00:00:00Z');
    const evidenceCache = new SportScoreRawEvidenceCache({
      rootDirectory: root,
      maxEntries: 2
    });
    const evidencePayload = {
      ...(fixturePayload as Record<string, unknown>),
      diagnosticEcho: 'must-never-be-persisted'
    };
    const fetchFn = vi.fn<typeof fetch>().mockImplementation(() => {
      currentTime += 1_000;
      return Promise.resolve(jsonResponse(evidencePayload));
    });
    const client = new SportScoreClient({
      apiKey: 'must-never-be-persisted',
      evidenceCache,
      fetchFn,
      now: () => currentTime,
      onRequestObservation: (observation) => observations.push(observation)
    });

    for (const date of ['2026-08-24', '2026-08-25', '2026-08-26']) {
      await client.getFixtures(fixturesRequest(date));
    }

    const evidenceFiles = (await readdir(root, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    expect(evidenceFiles).toHaveLength(2);

    const persisted = await Promise.all(evidenceFiles.map((entry) => readFile(
      path.join(entry.parentPath, entry.name),
      'utf8'
    )));
    const serializedObservations = JSON.stringify(observations);

    expect(persisted.join('\n')).not.toContain('must-never-be-persisted');
    expect(persisted.join('\n')).not.toContain('X-Api-Key');
    expect(serializedObservations).not.toContain('must-never-be-persisted');
    expect(serializedObservations).not.toContain('X-Api-Key');
    expect(observations).toHaveLength(3);
    expect(observations.every((observation) => observation.authenticated)).toBe(true);
  });

  it('returns in-play records to the caller but omits their snapshot from persisted raw evidence', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'miraichi-sportscore-live-evidence-'));
    temporaryRoots.push(root);
    const evidenceCache = new SportScoreRawEvidenceCache({ rootDirectory: root });
    const payload = {
      sport: 'football',
      count: 2,
      matches: [
        {
          home: 'Live Home',
          away: 'Live Away',
          home_score: 9,
          away_score: 8,
          status: 'live',
          status_text: '82',
          time: '2026-08-26T18:00:00Z',
          slug: 'live-match-must-not-persist',
          events: [{ minute: 82, player: 'Live Player Must Not Persist' }]
        },
        {
          home: 'Scheduled Home',
          away: 'Scheduled Away',
          status: 'scheduled',
          time: '2026-08-26T21:00:00Z',
          slug: 'scheduled-match-may-persist'
        }
      ],
      updated: '2026-08-26T20:00:00Z'
    };
    const client = new SportScoreClient({
      evidenceCache,
      fetchFn: vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload))
    });

    const returned = await client.getFixtures(fixturesRequest());
    const evidenceFiles = (await readdir(root, { recursive: true, withFileTypes: true }))
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'));
    const persisted = await readFile(
      path.join(evidenceFiles[0]!.parentPath, evidenceFiles[0]!.name),
      'utf8'
    );

    expect(returned.matches).toHaveLength(2);
    expect(persisted).toContain('scheduled-match-may-persist');
    expect(persisted).toContain('inPlayMatchesOmitted');
    expect(persisted).not.toContain('live-match-must-not-persist');
    expect(persisted).not.toContain('Live Player Must Not Persist');
  });
});
