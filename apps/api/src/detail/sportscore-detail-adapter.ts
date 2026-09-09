import { toProviderNeutralLocalMatch,validateLocalMatchDetail,type LocalMatch,type LocalMatchDetail,type LocalMatchEvent,type MatchDetailEnrichment } from '@miraichi/shared';
import { mappedStatus, minute } from '../live/sportscore-live-adapter.js';
const rec=(v:unknown):Record<string,unknown> => typeof v==='object' && v!==null && !Array.isArray(v)?v as Record<string,unknown>:{};
const list=(v:unknown) => Array.isArray(v)?v.slice(0,200).map(rec):[];
const text=(v:unknown):string|null => typeof v==='string' && v.trim()?v.trim().slice(0,200):null;
const identity=(v:unknown) => text(v)?.normalize('NFKC').replace(/\s+/gu,' ').toLowerCase();
const integer=(v:unknown,max=200):number|null => {const n=typeof v==='number'?v:typeof v==='string'&&/^\d+$/u.test(v)?Number(v):NaN;return Number.isInteger(n)&&n>=0&&n<=max?n:null;};
export function adaptSportScoreDetail(input:{match:LocalMatch;payload:unknown;slug:string;observedAt:string}):LocalMatchDetail {
  const raw=rec(rec(input.payload).match); const {match}=input;
  if(identity(raw.home)!==identity(match.homeTeam.name) || identity(raw.away)!==identity(match.awayTeam.name)
    || Date.parse(String(raw.time))!==Date.parse(match.kickoffUtc) || raw.url!==`/football/match/${input.slug}/`
    || identity(raw.competition)!==identity(match.competition.name)) throw new Error('Widget detail identity mismatch');
  const statuses:Record<string,MatchDetailEnrichment['observedStatus']>={finished:'completed',completed:'completed',ft:'completed',live:'live',in_play:'live',
    first_half:'live',second_half:'live',halftime:'halftime',half_time:'halftime',suspended:'suspended',scheduled:'scheduled',not_started:'scheduled',postponed:'postponed',cancelled:'cancelled'};
  const observedStatus=mappedStatus(String(raw.status))?.status ?? mappedStatus(String(raw.status_text))?.status
    ?? statuses[String(raw.status).trim().toLowerCase().replace(/[\s-]+/gu,'_')] ?? 'unknown';
  const score={home:integer(raw.home_score,100),away:integer(raw.away_score,100)};
  if(match.status==='completed' && observedStatus!=='completed') throw new Error('Widget detail identity/status regression');
  const events:LocalMatchEvent[]=list(raw.incidents).flatMap((event) => {
    const side=event.side==='home'?match.homeTeam.id:event.side==='away'?match.awayTeam.id:null;
    const label=String(event.type).toLowerCase();
    const type:LocalMatchEvent['type']|null=label.includes('goal')?'goal':label.includes('card')?'card':event.is_sub===true?'substitution':label.includes('penalty')?'penalty':null;
    if(!side||!type) return [];
    return [{type,teamId:side,minute:integer(event.time),extraMinute:null,detail:label,
      player:text(type==='substitution'?event.player_out:event.player),assist:type==='substitution'?text(event.player_in):null,label:type}];
  });
  const rawLineups=rec(raw.lineups);const lineups:NonNullable<LocalMatchDetail['lineups']>=[];const coaches:MatchDetailEnrichment['coaches']=[];
  if(rawLineups.confirmed===true) for(const side of ['home','away'] as const) {
    const team=side==='home'?match.homeTeam:match.awayTeam;
    const players=(v:unknown)=>list(v).flatMap((p)=>text(p.name)?[{name:text(p.name)!,shirtNumber:integer(p.number,999),position:['G','D','M','F'].includes(String(p.position))?String(p.position):null}]:[]);
    lineups.push({teamId:team.id,teamName:team.name,formation:text(rawLineups[`${side}_formation`]),
      starters:players(rawLineups[`${side}_xi`]),substitutes:players(rawLineups[`${side}_subs`])});
    const coach=text(rawLineups[`${side}_coach`]);if(coach) coaches.push({teamId:team.id,name:coach});
  }
  const detail:LocalMatchDetail={match:toProviderNeutralLocalMatch(match),status:match.status,
    elapsedMinute:observedStatus==='completed'?null:integer(raw.live_minute) ?? minute(raw),events,
    updatedAt:input.observedAt,...(lineups.length?{lineups}:{}),
    scoreBreakdown:{halftime:{home:integer(raw.home_ht_score,100),away:integer(raw.away_ht_score,100)},fulltime:{home:null,away:null},extratime:{home:null,away:null},penalty:{home:null,away:null}},
    enrichment:{observedStatus,score,statistics:[],players:[],shots:[],coaches},warnings:['partial_detail']};
  if(!validateLocalMatchDetail(detail).ok) throw new Error('Invalid normalized widget detail');
  return detail;
}
