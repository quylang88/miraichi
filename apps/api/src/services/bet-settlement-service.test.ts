import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { settleBet, settleBetAutomatically } from './bet-settlement-service.js';

const now='2026-08-21T01:00:00.000Z';
async function setup(){const adapter=createMemoryCloudPersistenceAdapter({now:()=>now});await adapter.createBankrollAccount({accountId:'a',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});await adapter.createBetRecord({betId:'b',ownerProfileId:'owner-primary',matchGroupId:'m',bankrollAccountId:'a',homeTeamName:'Japan',awayTeamName:'Vietnam',marketType:'1X2',selectionLabel:'Japan',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'pending',preBetEmotion:'calm',preBetMotivation:'planned_analysis',preBetPlanAdherence:'yes',createdAt:now,updatedAt:now});return adapter;}

describe('bet settlement service',()=>{
  it('atomically settles a standard outcome using pre-bet plan adherence and is idempotent on retry',async()=>{const adapter=await setup();const command={settlementEventId:'s1',settlementType:'full_win' as const,effectiveAt:now};const first=await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command,now});const retry=await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command,now});expect(first).toMatchObject({event:{planAdherence:'yes'},record:{status:'settled',profitLossPoints:9},account:{currentBalancePoints:109}});expect(retry.account.currentBalancePoints).toBe(109);});
  it('settles an emotion-only structured bet without fabricating a plan value',async()=>{
    const adapter=await setup();const existing=(await adapter.listBetRecords('owner-primary'))[0]!;
    const {preBetMotivation:_motivation,preBetPlanAdherence:_adherence,...simple}=existing;
    await adapter.updateBetRecord({...simple,selectionCode:'home',marketPeriod:'full_time'});
    const command={settlementEventId:'simple-1',settlementType:'half_win' as const,effectiveAt:now};
    const result=await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command,now});
    expect(result.record.profitLossPoints).toBe(4.5);
    expect(result.event).not.toHaveProperty('planAdherence');
    expect(result.record).not.toHaveProperty('postBetPlanAdherence');
    expect((await adapter.listBetSettlementEvents('owner-primary','b'))[0]).not.toHaveProperty('planAdherence');
    expect(result.account.currentBalancePoints).toBe(104.5);
  });
  it('appends a correction delta without rewriting pre-bet plan adherence',async()=>{const adapter=await setup();await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command:{settlementEventId:'s1',settlementType:'full_win',effectiveAt:'2026-08-20T01:00:00.000Z'},now});const corrected=await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command:{settlementEventId:'s2',settlementType:'full_loss',lessonNote:'Chased the result',effectiveAt:now,correctsSettlementEventId:'s1'},now:'2026-08-21T02:00:00.000Z'});expect(corrected).toMatchObject({event:{ledgerDeltaPoints:-19,effectiveAt:'2026-08-20T01:00:00.000Z',planAdherence:'yes'},record:{profitLossPoints:-10},account:{currentBalancePoints:90}});expect(await adapter.listBetSettlementEvents('owner-primary','b')).toHaveLength(2);});
  it('requires an assigned account, legacy plan adherence, and manual adjustment reason',async()=>{const adapter=createMemoryCloudPersistenceAdapter();await adapter.createBetRecord({betId:'legacy',ownerProfileId:'owner-primary',matchGroupId:'m',homeTeamName:'A',awayTeamName:'B',marketType:'custom',selectionLabel:'A',oddsFormat:'HK',oddsValue:1,stakePoints:10,status:'pending',createdAt:now,updatedAt:now});await expect(settleBet({adapter,ownerProfileId:'owner-primary',betId:'legacy',command:{settlementEventId:'s',settlementType:'full_win',planAdherence:'yes',effectiveAt:now},now})).rejects.toThrow('bankroll account');await adapter.createBankrollAccount({accountId:'a',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});await adapter.updateBetRecord({...((await adapter.listBetRecords('owner-primary'))[0]!),bankrollAccountId:'a'});await expect(settleBet({adapter,ownerProfileId:'owner-primary',betId:'legacy',command:{settlementEventId:'s2',settlementType:'full_win',effectiveAt:now},now})).rejects.toThrow('plan adherence');await expect(settleBet({adapter:await setup(),ownerProfileId:'owner-primary',betId:'b',command:{settlementEventId:'s',settlementType:'manual_adjustment',profitLossPoints:2,effectiveAt:now},now})).rejects.toThrow('adjustmentReason');});
  it('uses one deterministic event for automatic retries and records the evidence timestamp',async()=>{
    const adapter=await setup();const existing=(await adapter.listBetRecords('owner-primary'))[0]!;
    await adapter.updateBetRecord({...existing,matchId:'match-1',selectionCode:'home',marketPeriod:'full_time'});
    await adapter.markBetSettlementManualReview({ownerProfileId:'owner-primary',betId:'b',reason:'missing_detail',evidenceAt:now,updatedAt:now});
    const outcome={status:'settled' as const,settlementType:'half_win' as const,evidence:{matchId:'match-1',matchUpdatedAt:'2026-09-16T00:30:00.000Z',basis:'full_time_score' as const,actualHome:2,actualAway:1,actualTotal:3}};
    const first=await settleBetAutomatically({adapter,ownerProfileId:'owner-primary',betId:'b',outcome,now});
    const retry=await settleBetAutomatically({adapter,ownerProfileId:'owner-primary',betId:'b',outcome,now});
    expect(first).toMatchObject({record:{status:'settled',settlementReviewStatus:'auto_settled',settlementEvidenceAt:'2026-09-16T00:30:00.000Z',profitLossPoints:4.5},event:{settlementEventId:'auto-settlement:b'}});
    expect(first.record).not.toHaveProperty('settlementReviewReason');
    expect(retry.account.currentBalancePoints).toBe(104.5);
    expect(await adapter.listBetSettlementEvents('owner-primary','b')).toHaveLength(1);
  });
  it('does not let automatic settlement overwrite an owner settlement',async()=>{
    const adapter=await setup();const existing=(await adapter.listBetRecords('owner-primary'))[0]!;
    await adapter.updateBetRecord({...existing,matchId:'match-1',selectionCode:'home',marketPeriod:'full_time'});
    await adapter.markBetSettlementManualReview({ownerProfileId:'owner-primary',betId:'b',reason:'missing_detail',evidenceAt:now,updatedAt:now});
    const ownerResult=await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command:{settlementEventId:'owner-event',settlementType:'full_loss',effectiveAt:now},now});
    expect(ownerResult.record).not.toHaveProperty('settlementReviewStatus');
    const outcome={status:'settled' as const,settlementType:'full_win' as const,evidence:{matchId:'match-1',matchUpdatedAt:now,basis:'full_time_score' as const,actualHome:2,actualAway:1,actualTotal:3}};
    await expect(settleBetAutomatically({adapter,ownerProfileId:'owner-primary',betId:'b',outcome,now})).rejects.toThrow('correction');
    expect((await adapter.listBetRecords('owner-primary'))[0]).toMatchObject({settlementType:'full_loss',profitLossPoints:-10});
  });
});
