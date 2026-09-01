import { describe, expect, it } from 'vitest';
import type { BetSettlementEvent, DisciplineConfig } from '@miraichi/shared';
import { buildDisciplineChallenge, evaluateDisciplineAttempt, hashBetAttemptPayload } from './discipline-service.js';

const config: DisciplineConfig = { ownerProfileId: 'owner-primary', dailyStopLossPoints: 100, weeklyStopLossPoints: 200, bigBetThresholdPoints: 50, timeZone: 'Asia/Tokyo', cooldownSeconds: 15, version: 2, updatedAt: '2026-08-21T00:00:00.000Z' };
const event = (id:string,effectiveAt:string,delta:number):BetSettlementEvent => ({ settlementEventId:id,ownerProfileId:'owner-primary',betId:id,bankrollAccountId:'a',settlementType:'manual_adjustment',planAdherence:'no',profitLossPoints:delta,adjustmentReason:'test',calculatedProfitLossPoints:delta,ledgerDeltaPoints:delta,effectiveAt,occurredAt:effectiveAt });

describe('discipline service',()=>{
  it('keeps a planned attempt below available balance clear without numeric discipline config',()=>{
    expect(evaluateDisciplineAttempt({config:null,stakePoints:10,availableBalancePoints:100,preBetMotivation:'planned_analysis',settlementEvents:[],at:'2026-08-21T00:00:00.000Z'})).toEqual({triggeredRules:[],dailyProfitLossPoints:0,weeklyProfitLossPoints:0});
  });

  it('challenges risky motivation and overexposure even without numeric discipline config',()=>{
    expect(evaluateDisciplineAttempt({config:null,stakePoints:101,availableBalancePoints:100,preBetMotivation:'chasing_loss',settlementEvents:[],at:'2026-08-21T00:00:00.000Z'})).toEqual({triggeredRules:['overexposure','risky_motivation'],dailyProfitLossPoints:0,weeklyProfitLossPoints:0});
  });

  it('triggers on equality and groups daily/ISO-week P&L in configured timezone',()=>{
    const result=evaluateDisciplineAttempt({config,stakePoints:50,at:'2026-08-21T01:00:00.000Z',settlementEvents:[
      event('today','2026-08-20T15:30:00.000Z',-100),
      event('same-week','2026-08-18T00:00:00.000Z',-100),
      event('previous-week','2026-08-16T00:00:00.000Z',-999)
    ]});
    expect(result).toEqual({triggeredRules:['big_bet','daily_stop_loss','weekly_stop_loss'],dailyProfitLossPoints:-100,weeklyProfitLossPoints:-200});
  });

  it('groups weekly P&L from Sunday when weekStartDay is sunday',()=>{
    const sundayConfig: DisciplineConfig = { ...config, weekStartDay: 'sunday' };
    const result=evaluateDisciplineAttempt({config:sundayConfig,stakePoints:50,at:'2026-08-21T01:00:00.000Z',settlementEvents:[
      event('today','2026-08-20T15:30:00.000Z',-100),
      event('same-week-sunday','2026-08-16T00:00:00.000Z',-100),
      event('previous-week-saturday','2026-08-15T00:00:00.000Z',-999)
    ]});
    expect(result).toEqual({triggeredRules:['big_bet','daily_stop_loss','weekly_stop_loss'],dailyProfitLossPoints:-100,weeklyProfitLossPoints:-200});
  });

  it('binds a challenge to a stable payload hash and 15 second availability',()=>{
    const payload={betId:'b',stakePoints:50,notes:'x'};
    expect(hashBetAttemptPayload(payload)).toBe(hashBetAttemptPayload({notes:'x',stakePoints:50,betId:'b'}));
    const challenge=buildDisciplineChallenge({challengeId:'c',ownerProfileId:'owner-primary',payload,config,evaluation:{triggeredRules:['big_bet'],dailyProfitLossPoints:0,weeklyProfitLossPoints:0},now:'2026-08-21T00:00:00.000Z'});
    expect(challenge).toMatchObject({challengeId:'c',ruleVersion:2,triggeredRules:['big_bet'],availableAt:'2026-08-21T00:00:15.000Z'});
    const unconfigured=buildDisciplineChallenge({challengeId:'u',ownerProfileId:'owner-primary',payload,config:null,evaluation:{triggeredRules:['risky_motivation'],dailyProfitLossPoints:0,weeklyProfitLossPoints:0},now:'2026-08-21T00:00:00.000Z'});
    expect(unconfigured).toMatchObject({challengeId:'u',ruleVersion:0,triggeredRules:['risky_motivation'],availableAt:'2026-08-21T00:00:15.000Z'});
  });
});
