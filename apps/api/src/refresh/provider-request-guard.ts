export type GuardedProvider='fotmob-unofficial'|'sportscore';
export interface ProviderCircuitStore {blockedUntil(provider:GuardedProvider):Promise<string|null>;block(provider:GuardedProvider):Promise<void>}
export class PostgresProviderCircuitStore implements ProviderCircuitStore {
  constructor(private readonly client:PostgresQueryClient,private readonly owner:string) {}
  async blockedUntil(provider:GuardedProvider):Promise<string|null> {
    const result=await this.client.query(`select max(until) as blocked_until from (
      select blocked_until as until from miraichi_app.provider_request_circuit where owner_profile_id=$1 and provider=$2
      union all select (state_json->'circuits'->>$2)::timestamptz from miraichi_app.provider_refresh_control where owner_profile_id=$1
      union all select last_attempt_at+interval '15 minutes' from miraichi_app.live_refresh_state
        where owner_profile_id=$1 and $2='sportscore' and last_error_code='upstream_blocked'
      ) circuits where until>clock_timestamp()`,[this.owner,provider]);
    const value=result.rows[0]?.blocked_until;
    return value?value instanceof Date?value.toISOString():String(value):null;
  }
  async block(provider:GuardedProvider):Promise<void> {
    await this.client.query(`insert into miraichi_app.provider_request_circuit(owner_profile_id,provider,blocked_until)
      values($1,$2,clock_timestamp()+make_interval(secs=>$3)) on conflict(owner_profile_id,provider) do update
      set blocked_until=greatest(miraichi_app.provider_request_circuit.blocked_until,excluded.blocked_until)`,
    [this.owner,provider,provider==='fotmob-unofficial'?21600:900]);
  }
}
export function guardProviderFetch(provider:GuardedProvider,store:ProviderCircuitStore,fetcher:typeof fetch=globalThis.fetch):typeof fetch {
  return async(input,init)=>{
    const signal=init?.signal ?? (input instanceof Request?input.signal:null);
    if(await store.blockedUntil(provider)) throw new Error('Provider request stopped by persisted circuit');
    signal?.throwIfAborted();
    const response=await fetcher(input,init);
    if(response.status===403 || response.status===429) {
      void response.body?.cancel().catch(()=>{});
      await store.block(provider);
      return new Response(null,{status:response.status});
    }
    return response;
  };
}
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
