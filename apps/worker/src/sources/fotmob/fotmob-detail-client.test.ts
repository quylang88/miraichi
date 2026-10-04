import { afterEach, describe, expect, it, vi } from 'vitest';
import { FotMobDetailClient } from './fotmob-detail-client.js';
afterEach(() => vi.useRealTimers());
describe('bounded per-match FotMob detail client', () => {
  it('uses only the exact known match URL with ETag and refuses invalid IDs before fetch', async () => {
    const fetcher = vi.fn<typeof fetch>(async () => new Response('{}', { headers:{etag:'next'} }));
    const client = new FotMobDetailClient({fetcher});
    expect(await client.get('123','previous')).toEqual({ status:'modified', payload:{}, etag:'next' });
    expect(String(fetcher.mock.calls[0][0])).toBe('https://www.fotmob.com/api/data/matchDetails?matchId=123');
    expect(fetcher.mock.calls[0][1]).toMatchObject({redirect:'error',headers:{Accept:'application/json','If-None-Match':'previous'}});
    await expect(client.get('../123')).rejects.toMatchObject({code:'invalid_request'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('accepts 304 only with a requested ETag', async () => {
    const client = new FotMobDetailClient({fetcher:async () => new Response(null,{status:304})});
    expect(await client.get('123','same')).toEqual({status:'not_modified',etag:'same'});
    await expect(client.get('123')).rejects.toMatchObject({code:'invalid_payload'});
  });
  it.each([403,429])('stops without retry on %s', async (status) => {
    const fetcher = vi.fn(async () => new Response('private upstream text',{status}));
    await expect(new FotMobDetailClient({fetcher}).get('123')).rejects.toMatchObject({code:'blocked'});
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds response bytes while streaming, even without content-length', async () => {
    const fetcher = async () => new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array(33)); c.close();}}));
    await expect(new FotMobDetailClient({fetcher,maxBytes:32}).get('123')).rejects.toMatchObject({code:'invalid_payload'});
  });
  it('times out a body that never completes', async () => {
    vi.useFakeTimers();
    const pending = new FotMobDetailClient({timeoutMs:500,fetcher:async () => new Response(new ReadableStream())}).get('123');
    const assertion = expect(pending).rejects.toMatchObject({code:'timeout'});
    await vi.advanceTimersByTimeAsync(501); await assertion;
  });
  it('cancels the response stream when the body deadline expires', async () => {
    vi.useFakeTimers(); const cancel=vi.fn();
    const pending=new FotMobDetailClient({timeoutMs:500,fetcher:async () => new Response(new ReadableStream({cancel}))}).get('123');
    const assertion=expect(pending).rejects.toMatchObject({code:'timeout'});
    await vi.advanceTimersByTimeAsync(501); await assertion;
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it.each([403,200])('releases rejected response bodies on early exit %s', async (status) => {
    const cancel=vi.fn(); const response=new Response(new ReadableStream({cancel}),{status,headers:{'content-length':'3000001'}});
    await expect(new FotMobDetailClient({fetcher:async()=>response}).get('123')).rejects.toBeInstanceOf(Error);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
});
