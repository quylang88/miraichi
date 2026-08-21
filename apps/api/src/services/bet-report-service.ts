import { SETTLEMENT_TYPES, type BetSettlementEvent, type CloudBetRecord, type SettlementType } from '@miraichi/shared';

export type BetReportPeriod='week'|'month'|'previous_month'|'all';
type BreakdownItem={count:number;profitLossPoints:number};
const round4=(value:number)=>Math.round((value+Number.EPSILON)*10_000)/10_000;
const dateKey=(iso:string,timeZone:string)=>{const parts=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(iso));const get=(type:Intl.DateTimeFormatPartTypes)=>parts.find((part)=>part.type===type)?.value??'';return`${get('year')}-${get('month')}-${get('day')}`;};
const addDays=(key:string,days:number)=>{const date=new Date(`${key}T00:00:00.000Z`);date.setUTCDate(date.getUTCDate()+days);return date.toISOString().slice(0,10);};
const weekStart=(key:string)=>{const date=new Date(`${key}T00:00:00.000Z`);return addDays(key,-((date.getUTCDay()||7)-1));};
const monthBounds=(anchor:string,offset=0)=>{const date=new Date(`${anchor.slice(0,7)}-01T00:00:00.000Z`);date.setUTCMonth(date.getUTCMonth()+offset);const start=date.toISOString().slice(0,10);date.setUTCMonth(date.getUTCMonth()+1);date.setUTCDate(date.getUTCDate()-1);return{startDate:start,endDate:date.toISOString().slice(0,10)};};
const bounds=(period:BetReportPeriod,anchor:string)=>period==='week'?{startDate:weekStart(anchor),endDate:addDays(weekStart(anchor),6)}:period==='month'?monthBounds(anchor):period==='previous_month'?monthBounds(anchor,-1):{startDate:null,endDate:null};
const within=(key:string,period:{startDate:string|null;endDate:string|null})=>(!period.startDate||key>=period.startDate)&&(!period.endDate||key<=period.endDate);
const addBreakdown=(target:Record<string,BreakdownItem>,key:string,pnl:number)=>{const current=target[key]??{count:0,profitLossPoints:0};target[key]={count:current.count+1,profitLossPoints:round4(current.profitLossPoints+pnl)};};

export function buildBetReport({period,anchor,timeZone,bets,events,accountId}:{period:BetReportPeriod;anchor:string;timeZone:string;bets:readonly CloudBetRecord[];events:readonly BetSettlementEvent[];accountId?:string}){
  const periodBounds=bounds(period,anchor);
  const selectedEvents=events.filter((event)=>(!accountId||event.bankrollAccountId===accountId)&&within(dateKey(event.effectiveAt,timeZone),periodBounds));
  const selectedBets=bets.filter((bet)=>bet.status!=='pending'&&bet.settledAt&&(!accountId||bet.bankrollAccountId===accountId)&&within(dateKey(bet.settledAt,timeZone),periodBounds));
  const outcomes=Object.fromEntries(SETTLEMENT_TYPES.map((type)=>[type,0])) as Record<SettlementType,number>;
  const market:Record<string,BreakdownItem>={};const emotion:Record<string,BreakdownItem>={};const motivation:Record<string,BreakdownItem>={};const planAdherence:Record<string,BreakdownItem>={};
  for(const bet of selectedBets){const pnl=bet.profitLossPoints??bet.manualResultPoints??0;if(bet.settlementType)outcomes[bet.settlementType]+=1;addBreakdown(market,bet.marketType,pnl);if(bet.preBetEmotion)addBreakdown(emotion,bet.preBetEmotion,pnl);if(bet.preBetMotivation)addBreakdown(motivation,bet.preBetMotivation,pnl);if(bet.postBetPlanAdherence)addBreakdown(planAdherence,bet.postBetPlanAdherence,pnl);}
  const dailyMap=new Map<string,number>();for(const event of selectedEvents){const key=dateKey(event.effectiveAt,timeZone);dailyMap.set(key,round4((dailyMap.get(key)??0)+event.ledgerDeltaPoints));}
  const totalStakePoints=round4(selectedBets.reduce((sum,bet)=>sum+bet.stakePoints,0));const denominator=outcomes.full_win+outcomes.half_win+outcomes.half_loss+outcomes.full_loss;
  return{period:{kind:period,...periodBounds,timeZone},netProfitLossPoints:round4(selectedEvents.reduce((sum,event)=>sum+event.ledgerDeltaPoints,0)),totalSettledBets:selectedBets.length,totalStakePoints,averageStakePoints:selectedBets.length?round4(totalStakePoints/selectedBets.length):0,winRatePercent:denominator?Math.round(((outcomes.full_win+outcomes.half_win)/denominator)*1000)/10:0,outcomes,daily:[...dailyMap].sort(([a],[b])=>a.localeCompare(b)).map(([date,profitLossPoints])=>({date,profitLossPoints})),market,psychology:{emotion,motivation,planAdherence},disciplineOverrideCount:selectedBets.filter((bet)=>Boolean(bet.disciplineSnapshot?.acknowledgedAt&&bet.disciplineSnapshot.triggeredRules.length)).length};
}
