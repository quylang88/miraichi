export class MatchDetailSourceError extends Error {
  constructor(readonly code:'invalid_request'|'invalid_payload'|'blocked'|'timeout'|'unavailable') { super(`Match detail source ${code}`); }
}
export type FotMobDetailResponse = {status:'not_modified';etag:string} | {status:'modified';payload:unknown;etag?:string};
export class FotMobDetailClient {
  private readonly fetcher: typeof fetch;
  private readonly timeoutMs:number;
  private readonly maxBytes:number;
  constructor(options:{fetcher?:typeof fetch;timeoutMs?:number;maxBytes?:number} = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch;
    this.timeoutMs = options.timeoutMs ?? 8_000; this.maxBytes = options.maxBytes ?? 2_000_000;
    if (!Number.isInteger(this.timeoutMs) || this.timeoutMs < 500 || this.timeoutMs > 15_000
      || !Number.isInteger(this.maxBytes) || this.maxBytes < 1 || this.maxBytes > 3_000_000) throw new MatchDetailSourceError('invalid_request');
  }
  async get(id:string,etag?:string):Promise<FotMobDetailResponse> {
    if (!/^[1-9]\d{0,14}$/u.test(id) || etag !== undefined && (etag.length > 500 || /[\r\n]/u.test(etag))) throw new MatchDetailSourceError('invalid_request');
    const controller = new AbortController(); let timer:ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_,reject) => {timer=setTimeout(() => {controller.abort();reject(new MatchDetailSourceError('timeout'));},this.timeoutMs);});
    try {
      return await Promise.race([this.read(id,etag,controller.signal),timeout]);
    } catch(error) { if (error instanceof MatchDetailSourceError) throw error; throw new MatchDetailSourceError('unavailable'); }
    finally {clearTimeout(timer);}
  }
  private async read(id:string,etag:string|undefined,signal:AbortSignal):Promise<FotMobDetailResponse> {
    const response = await this.fetcher(`https://www.fotmob.com/api/data/matchDetails?matchId=${id}`, {
      headers:{Accept:'application/json',...(etag ? {'If-None-Match':etag} : {})},redirect:'error',signal
    });
    const discard = () => { void response.body?.cancel().catch(() => {}); };
    if (response.status === 403 || response.status === 429) { discard(); throw new MatchDetailSourceError('blocked'); }
    if (response.status === 304) {
      discard();
      if (!etag) throw new MatchDetailSourceError('invalid_payload');
      return {status:'not_modified',etag};
    }
    if (!response.ok) { discard(); throw new MatchDetailSourceError('unavailable'); }
    if (Number(response.headers.get('content-length')) > this.maxBytes || !response.body) { discard(); throw new MatchDetailSourceError('invalid_payload'); }
    const reader=response.body.getReader(); const decoder=new TextDecoder(); let body=''; let bytes=0;
    const cancel=() => { void reader.cancel().catch(() => {}); };
    signal.addEventListener('abort',cancel,{once:true});
    try {
      if(signal.aborted) throw new MatchDetailSourceError('timeout');
      while(true) {
        const chunk=await reader.read(); if(chunk.done) break;
        bytes+=chunk.value.byteLength; if(bytes>this.maxBytes) throw new MatchDetailSourceError('invalid_payload');
        body+=decoder.decode(chunk.value,{stream:true});
      }
      body+=decoder.decode();
    } finally { signal.removeEventListener('abort',cancel); cancel(); }
    let payload:unknown; try {payload=JSON.parse(body);} catch {throw new MatchDetailSourceError('invalid_payload');}
    const next=response.headers.get('etag');
    return {status:'modified',payload,...(next && next.length<=500 && !/[\r\n]/u.test(next) ? {etag:next} : {})};
  }
}
