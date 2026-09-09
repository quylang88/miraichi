import { describe, expect, it, vi } from 'vitest';
import { guardProviderFetch, type ProviderCircuitStore } from './provider-request-guard.js';
import { createGuardedProviderClients } from '../runtime/guarded-provider-clients.js';
import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
describe('persisted provider request guard',()=>{
  it('wires the DB guard into current, terminal, detail and both live widget operations',async()=>{
    const query=vi.fn(async()=>({rows:[{blocked_until:'2099-01-01T00:00:00Z'}],rowCount:1}));
    const client:PostgresQueryClient={query:query as PostgresQueryClient['query'],transaction:async(run)=>run(client)};
    const network=vi.fn<typeof fetch>(); const clients=createGuardedProviderClients(client,'owner',8000,network);
    for(const operation of [()=>clients.current.getSeasonMatches({externalCompetitionId:47,externalCountryCode:'ENG',providerSeason:'2026/2027'}),
      ()=>clients.daily.getDailyMatches({date:'2026-09-09',timeZone:'UTC',ownerCountryCode:'ENG'}),
      ()=>clients.detail.get('100'),()=>clients.widget.listMatches(),()=>clients.widget.getMatch('home-vs-away')]) {
      await expect(operation()).rejects.toThrow();
    }
    expect(query).toHaveBeenCalledTimes(5); expect(network).not.toHaveBeenCalled();
  });
  it('shares 403/429 stop state across detail and scheduled client instances without another network call',async()=>{
    const blocked=new Set<string>();
    const store:ProviderCircuitStore={blockedUntil:async(provider)=>blocked.has(provider)?'2099-01-01T00:00:00Z':null,
      block:async(provider)=>{blocked.add(provider);}};
    const network=vi.fn<typeof fetch>(async()=>new Response('private blocked body',{status:403}));
    const detail=guardProviderFetch('fotmob-unofficial',store,network);
    const scheduled=guardProviderFetch('fotmob-unofficial',store,network);
    expect((await detail('https://www.fotmob.com/api/data/matchDetails?matchId=123')).status).toBe(403);
    await expect(scheduled('https://www.fotmob.com/api/data/matches?date=20260909')).rejects.toThrow('circuit');
    expect(network).toHaveBeenCalledTimes(1);
    const widget=guardProviderFetch('sportscore',store,network);
    expect((await widget('https://sportscore.com/api/widget/matches/')).status).toBe(403);
    expect(network).toHaveBeenCalledTimes(2);
  });
  it('does not call upstream when the DB guard fails or the caller has already aborted',async()=>{
    const network=vi.fn<typeof fetch>();
    const fail:ProviderCircuitStore={blockedUntil:async()=>{throw new Error('database unavailable');},block:vi.fn()};
    await expect(guardProviderFetch('sportscore',fail,network)('https://sportscore.com/api/widget/matches/')).rejects.toThrow();
    const controller=new AbortController();controller.abort();
    const okay:ProviderCircuitStore={blockedUntil:async()=>null,block:vi.fn()};
    await expect(guardProviderFetch('sportscore',okay,network)('https://sportscore.com/api/widget/matches/',{signal:controller.signal})).rejects.toThrow();
    expect(network).not.toHaveBeenCalled();
  });
});
