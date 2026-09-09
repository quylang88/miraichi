import { COMPETITION_SOURCE_REGISTRY, type CompetitionSourceEntry } from '@miraichi/config';
import type { LocalMatch, LocalMatchDetail } from '@miraichi/shared';
import { resolveCompetitionSeason } from '../../../worker/src/sources/hydration/season-hydration-plan.js';
import { FotMobDetailClient } from '../../../worker/src/sources/fotmob/fotmob-detail-client.js';
import { adaptFotMobDetail } from '../../../worker/src/sources/fotmob/fotmob-detail-adapter.js';
import { SportScoreWidgetClient } from '../live/sportscore-widget-client.js';
import { adaptSportScoreDetail } from './sportscore-detail-adapter.js';
export type SelectedDetailSource = {provider:'fotmob-unofficial';id:string;leagueId:number} | {provider:'sportscore';id:string};
export function selectMatchDetailSource(match:LocalMatch,now:string,registry:readonly CompetitionSourceEntry[]=COMPETITION_SOURCE_REGISTRY):SelectedDetailSource|null {
  const entry=registry.find((e) => e.competitionId===match.competition.id);
  if (!entry || resolveCompetitionSeason(entry,now.slice(0,10)).season!==match.competition.season) return null;
  const ids=[...new Set(match.sourceRefs.filter((ref) => ref.sourceId==='fotmob-unofficial').map((ref) => ref.sourceMatchId).filter((id):id is string => Boolean(id)))];
  const binding=entry.sourceBindings.detail;
  if(ids.length===1 && /^[1-9]\d{0,14}$/u.test(ids[0]) && binding?.sourceId==='fotmob-unofficial'
    && binding.executionStatus==='enabled' && binding.endpointKind==='match-api' && binding.externalNumericId
    && binding.availableCanonicalSeasons.includes(match.competition.season)
    && Boolean(binding.providerSeasonByCanonicalSeason?.[match.competition.season])) {
    return {provider:'fotmob-unofficial',id:ids[0],leagueId:binding.externalNumericId};
  }
  const slugs=[...new Set(match.sourceRefs.filter((ref) => ref.sourceId==='sportscore'
    && ref.sourceUrl===`https://sportscore.com/football/match/${ref.sourceMatchId}/`).map((ref) => ref.sourceMatchId).filter((id):id is string => Boolean(id)))];
  return slugs.length===1 && slugs[0].length<=160 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slugs[0])
    ? {provider:'sportscore',id:slugs[0]} : null;
}
export async function fetchSelectedMatchDetail(input:{match:LocalMatch;source:SelectedDetailSource;observedAt:string;etag?:string;
  fotmob?:Pick<FotMobDetailClient,'get'>;sportscore?:Pick<SportScoreWidgetClient,'getMatch'>
}):Promise<{status:'not_modified';etag:string}|{status:'modified';detail:LocalMatchDetail;etag?:string}> {
  if(input.source.provider==='fotmob-unofficial') {
    const response=await (input.fotmob??new FotMobDetailClient()).get(input.source.id,input.etag);
    if(response.status==='not_modified') return response;
    return {status:'modified',detail:adaptFotMobDetail({match:input.match,payload:response.payload,providerMatchId:input.source.id,
      leagueId:input.source.leagueId,observedAt:input.observedAt}),...(response.etag ? {etag:response.etag} : {})};
  }
  const payload=await (input.sportscore??new SportScoreWidgetClient()).getMatch(input.source.id);
  return {status:'modified',detail:adaptSportScoreDetail({match:input.match,payload,slug:input.source.id,observedAt:input.observedAt})};
}
