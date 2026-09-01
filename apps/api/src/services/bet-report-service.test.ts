import { describe, expect, it } from 'vitest';
import type { BetSettlementEvent, CloudBetRecord } from '@miraichi/shared';
import { buildBetReport } from './bet-report-service.js';
const bet=(id:string,type:NonNullable<CloudBetRecord['settlementType']>,pnl:number,settledAt:string,emotion:NonNullable<CloudBetRecord['preBetEmotion']>):CloudBetRecord=>({betId:id,ownerProfileId:'owner-primary',matchGroupId:id,bankrollAccountId:'a',homeTeamName:'A',awayTeamName:'B',marketType:'1X2',selectionLabel:'A',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'settled',settlementType:type,profitLossPoints:pnl,settledAt,preBetEmotion:emotion,preBetMotivation:'planned_analysis',preBetPlanAdherence:'yes',postBetPlanAdherence:'yes',createdAt:settledAt,updatedAt:settledAt});
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
  it('uses immutable pre-bet plan adherence and falls back only for legacy records',()=>{const current={...bet('current','full_win',9,'2026-08-18T01:00:00.000Z','calm'),preBetPlanAdherence:'no' as const,postBetPlanAdherence:'yes' as const};const {preBetPlanAdherence:_pre,...legacyBase}=bet('legacy','full_loss',-10,'2026-08-19T01:00:00.000Z','calm');const legacy={...legacyBase,postBetPlanAdherence:'partly' as const};const report=buildBetReport({period:'week',anchor:'2026-08-21',timeZone:'UTC',bets:[current,legacy],events:[event('e1','current','full_win',9,current.settledAt!),event('e2','legacy','full_loss',-10,legacy.settledAt!)]});expect(report.psychology.planAdherence).toEqual({no:{count:1,profitLossPoints:9},partly:{count:1,profitLossPoints:-10}});});
  it('aggregates the previous week when period is previous_week', () => {
    const bets = [
      bet('prev1', 'full_win', 10, '2026-08-11T01:00:00.000Z', 'calm'),
      bet('this1', 'full_win', 10, '2026-08-18T01:00:00.000Z', 'calm')
    ];
    const events = [
      event('e1', 'prev1', 'full_win', 10, '2026-08-11T01:00:00.000Z'),
      event('e2', 'this1', 'full_win', 10, '2026-08-18T01:00:00.000Z')
    ];
    const report = buildBetReport({
      period: 'previous_week',
      anchor: '2026-08-21',
      timeZone: 'Asia/Tokyo',
      weekStartDay: 'monday',
      bets,
      events
    });
    expect(report.period).toMatchObject({
      kind: 'previous_week',
      startDate: '2026-08-10',
      endDate: '2026-08-16'
    });
    expect(report.totalSettledBets).toBe(1);
    expect(report.netProfitLossPoints).toBe(10);
  });
  it('aggregates custom date range when period is custom', () => {
    const bets = [
      bet('b1', 'full_win', 10, '2026-08-05T01:00:00.000Z', 'calm'),
      bet('b2', 'full_win', 15, '2026-08-12T01:00:00.000Z', 'calm'),
      bet('b3', 'full_win', 20, '2026-08-20T01:00:00.000Z', 'calm')
    ];
    const events = [
      event('e1', 'b1', 'full_win', 10, '2026-08-05T01:00:00.000Z'),
      event('e2', 'b2', 'full_win', 15, '2026-08-12T01:00:00.000Z'),
      event('e3', 'b3', 'full_win', 20, '2026-08-20T01:00:00.000Z')
    ];
    const report = buildBetReport({
      period: 'custom',
      customRange: { startDate: '2026-08-05', endDate: '2026-08-15' },
      anchor: '2026-08-21',
      timeZone: 'Asia/Tokyo',
      bets,
      events
    });
    expect(report.period).toMatchObject({
      kind: 'custom',
      startDate: '2026-08-05',
      endDate: '2026-08-15'
    });
    expect(report.totalSettledBets).toBe(2);
    expect(report.netProfitLossPoints).toBe(25);
  });
  it('aggregates this_week and this_month periods identical to week and month aliases', () => {
    const bets = [
      bet('b1', 'full_win', 10, '2026-08-18T01:00:00.000Z', 'calm')
    ];
    const events = [
      event('e1', 'b1', 'full_win', 10, '2026-08-18T01:00:00.000Z')
    ];
    const weekReport = buildBetReport({
      period: 'this_week',
      anchor: '2026-08-21',
      timeZone: 'Asia/Tokyo',
      bets,
      events
    });
    expect(weekReport.period).toMatchObject({
      kind: 'this_week',
      startDate: '2026-08-17',
      endDate: '2026-08-23'
    });
    expect(weekReport.totalSettledBets).toBe(1);

    const monthReport = buildBetReport({
      period: 'this_month',
      anchor: '2026-08-21',
      timeZone: 'Asia/Tokyo',
      bets,
      events
    });
    expect(monthReport.period).toMatchObject({
      kind: 'this_month',
      startDate: '2026-08-01',
      endDate: '2026-08-31'
    });
    expect(monthReport.totalSettledBets).toBe(1);
  });
});
