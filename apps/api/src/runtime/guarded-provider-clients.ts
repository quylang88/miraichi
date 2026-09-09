import type { PostgresQueryClient } from '../persistence/supabase/postgres-query-client.js';
import { guardProviderFetch, PostgresProviderCircuitStore } from '../refresh/provider-request-guard.js';
import { FotMobSeasonClient } from '../../../worker/src/sources/fotmob/fotmob-season-client.js';
import { FotMobDailyClient } from '../../../worker/src/sources/fotmob/fotmob-daily-client.js';
import { FotMobDetailClient } from '../../../worker/src/sources/fotmob/fotmob-detail-client.js';
import { SportScoreWidgetClient } from '../live/sportscore-widget-client.js';
export function createGuardedProviderClients(client:PostgresQueryClient,owner:string,widgetTimeoutMs=8000,fetcher:typeof fetch=globalThis.fetch) {
  const circuits=new PostgresProviderCircuitStore(client,owner);
  const fotmob=guardProviderFetch('fotmob-unofficial',circuits,fetcher);
  const widget=guardProviderFetch('sportscore',circuits,fetcher);
  return {current:new FotMobSeasonClient({fetchFn:fotmob,timeoutMs:8000}),daily:new FotMobDailyClient({fetchFn:fotmob,timeoutMs:8000}),
    detail:new FotMobDetailClient({fetcher:fotmob}),widget:new SportScoreWidgetClient({fetcher:widget,timeoutMs:widgetTimeoutMs})};
}
