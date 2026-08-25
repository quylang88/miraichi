import { describe, expect, it } from 'vitest';
import type { BetSettlementEvent, CloudBetRecord } from '@miraichi/shared';
import { buildBetReport } from './bet-report-service.js';
const bet=(id:string,type:NonNullable<CloudBetRecord['settlementType']>,pnl:number,settledAt:string,emotion:NonNullable<CloudBetRecord['preBetEmotion']>):CloudBetRecord=>({betId:id,ownerProfileId:'owner-primary',matchGroupId:id,bankrollAccountId:'a',homeTeamName:'A',awayTeamName:'B',marketType:'1X2',selectionLabel:'A',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'settled',settlementType:type,profitLossPoints:pnl,settledAt,preBetEmotion:emotion,preBetMotivation:'planned_analysis',postBetPlanAdherence:'yes',createdAt:settledAt,updatedAt:settledAt});
const event=(id:string,betId:string,type:BetSettlementEvent['settlementType'],delta:number,effectiveAt:string):BetSettlementEvent=>({settlementEventId:id,ownerProfileId:'owner-primary',betId,bankrollAccountId:'a',settlementType:type,planAdherence:'yes',calculatedProfitLossPoints:delta,ledgerDeltaPoints:delta,effectiveAt,occurredAt:effectiveAt});
describe('bet report service',()=>{
  it('aggregates an ISO week with the approved win-rate denominator and breakdowns',()=>{const report=buildBetReport({period:'week',anchor:'2026-08-21',timeZone:'Asia/Tokyo',bets:[bet('w','full_win',9,'2026-08-18T01:00:00.000Z','calm'),bet('l','full_loss',-10,'2026-08-19T01:00:00.000Z','frustrated'),bet('p','push',0,'2026-08-20T01:00:00.000Z','calm')],events:[event('e1','w','full_win',9,'2026-08-18T01:00:00.000Z'),event('e2','l','full_loss',-10,'2026-08-19T01:00:00.000Z'),event('e3','p','push',0,'2026-08-20T01:00:00.000Z')]});expect(report).toMatchObject({period:{startDate:'2026-08-17',endDate:'2026-08-23'},netProfitLossPoints:-1,totalSettledBets:3,totalStakePoints:30,averageStakePoints:10,winRatePercent:50,outcomes:{full_win:1,full_loss:1,push:1},psychology:{emotion:{calm:{count:2,profitLossPoints:9},frustrated:{count:1,profitLossPoints:-10}}}});expect(report).not.toHaveProperty('yieldPercent');});
  it('aggregates a Sunday-started week when weekStartDay is sunday',()=>{
    const bets=[
      bet('sun1','full_win',9,'2026-08-16T01:00:00.000Z','calm'),
      bet('sat','full_loss',-10,'2026-08-22T01:00:00.000Z','frustrated'),
      bet('sun2','full_win',9,'2026-08-23T01:00:00.000Z','calm')
    ];
    const events=[
      event('e1','sun1','full_win',9,'2026-08-16T01:00:00.000Z'),
      event('e2','sat','full_loss',-10,'2026-08-22T01:00:00.000Z'),
      event('e3','sun2','full_win',9,'2026-08-23T01:00:00.000Z')
    ];
    const report=buildBetReport({period:'week',anchor:'2026-08-21',timeZone:'Asia/Tokyo',weekStartDay:'sunday',bets,events});
    expect(report).toMatchObject({
      period:{startDate:'2026-08-16',endDate:'2026-08-22'},
      netProfitLossPoints:-1,
      totalSettledBets:2,
      totalStakePoints:20
    });
  });
  it('keeps a correction delta in the original effective month',()=>{const report=buildBetReport({period:'month',anchor:'2026-08-21',timeZone:'UTC',bets:[bet('b','full_loss',-10,'2026-08-01T00:00:00.000Z','calm')],events:[event('original','b','full_win',9,'2026-08-01T00:00:00.000Z'),{...event('correction','b','full_loss',-19,'2026-08-01T00:00:00.000Z'),occurredAt:'2026-09-01T00:00:00.000Z',correctsSettlementEventId:'original'}]});expect(report.netProfitLossPoints).toBe(-10);expect(report.daily[0]).toMatchObject({date:'2026-08-01',profitLossPoints:-10});});
});
