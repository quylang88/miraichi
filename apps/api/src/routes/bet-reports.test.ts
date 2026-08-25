import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { settleBet } from '../services/bet-settlement-service.js';
import { handleBetReports } from './bet-reports.js';
const req=(url='/api/v1/bet-reports?period=week&anchor=2026-08-21')=>{const value=Readable.from([]) as Readable&{method:string;url:string};value.method='GET';value.url=url;return value;};
const res=()=>({statusCode:0,body:'',writeHead(code:number){this.statusCode=code;},end(body?:unknown){this.body=String(body??'');}});
describe('bet reports route',()=>{
  it('uses the configured timezone and owner records',async()=>{const adapter=createMemoryCloudPersistenceAdapter({now:()=> '2026-08-21T00:00:00.000Z'});await adapter.upsertDisciplineConfig({ownerProfileId:'owner-primary',dailyStopLossPoints:null,weeklyStopLossPoints:null,bigBetThresholdPoints:null,timeZone:'Asia/Tokyo',cooldownSeconds:15,version:1,updatedAt:'2026-08-21T00:00:00.000Z'});await adapter.createBankrollAccount({accountId:'a',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});await adapter.createBetRecord({betId:'b',ownerProfileId:'owner-primary',matchGroupId:'m',bankrollAccountId:'a',homeTeamName:'A',awayTeamName:'B',marketType:'1X2',selectionLabel:'A',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'pending',createdAt:'2026-08-21T00:00:00.000Z',updatedAt:'2026-08-21T00:00:00.000Z'});await settleBet({adapter,ownerProfileId:'owner-primary',betId:'b',command:{settlementEventId:'s',settlementType:'full_win',planAdherence:'yes',effectiveAt:'2026-08-21T00:00:00.000Z'},now:'2026-08-21T00:00:00.000Z'});const out=res();await handleBetReports(req() as never,out as never,{adapter,ownerProfileId:'owner-primary'});expect(out.statusCode).toBe(200);expect(JSON.parse(out.body)).toMatchObject({netProfitLossPoints:9,period:{timeZone:'Asia/Tokyo',startDate:'2026-08-17',endDate:'2026-08-23'}});});
  it('respects weekStartDay from discipline config',async()=>{const adapter=createMemoryCloudPersistenceAdapter({now:()=> '2026-08-21T00:00:00.000Z'});await adapter.upsertDisciplineConfig({ownerProfileId:'owner-primary',dailyStopLossPoints:null,weeklyStopLossPoints:null,bigBetThresholdPoints:null,timeZone:'Asia/Tokyo',weekStartDay:'sunday',cooldownSeconds:15,version:1,updatedAt:'2026-08-21T00:00:00.000Z'});const out=res();await handleBetReports(req() as never,out as never,{adapter,ownerProfileId:'owner-primary'});expect(out.statusCode).toBe(200);expect(JSON.parse(out.body)).toMatchObject({period:{timeZone:'Asia/Tokyo',startDate:'2026-08-16',endDate:'2026-08-22'}});});
  it('handles previous_week period query',async()=>{
    const adapter=createMemoryCloudPersistenceAdapter({now:()=> '2026-08-21T00:00:00.000Z'});
    await adapter.upsertDisciplineConfig({ownerProfileId:'owner-primary',dailyStopLossPoints:null,weeklyStopLossPoints:null,bigBetThresholdPoints:null,timeZone:'Asia/Tokyo',cooldownSeconds:15,version:1,updatedAt:'2026-08-21T00:00:00.000Z'});
    const out=res();
    await handleBetReports(req('/api/v1/bet-reports?period=previous_week&anchor=2026-08-21') as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(200);
    expect(JSON.parse(out.body)).toMatchObject({
      period:{kind:'previous_week',startDate:'2026-08-10',endDate:'2026-08-16'}
    });
  });
  it('handles valid custom date range query',async()=>{
    const adapter=createMemoryCloudPersistenceAdapter({now:()=> '2026-08-21T00:00:00.000Z'});
    await adapter.upsertDisciplineConfig({ownerProfileId:'owner-primary',dailyStopLossPoints:null,weeklyStopLossPoints:null,bigBetThresholdPoints:null,timeZone:'Asia/Tokyo',cooldownSeconds:15,version:1,updatedAt:'2026-08-21T00:00:00.000Z'});
    const out=res();
    await handleBetReports(req('/api/v1/bet-reports?period=custom&anchor=2026-08-21&startDate=2026-08-01&endDate=2026-08-15') as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(200);
    expect(JSON.parse(out.body)).toMatchObject({
      period:{kind:'custom',startDate:'2026-08-01',endDate:'2026-08-15'}
    });
  });
  it('returns 400 invalid_report_query when custom date range is inverted or malformed',async()=>{
    const adapter=createMemoryCloudPersistenceAdapter({now:()=> '2026-08-21T00:00:00.000Z'});
    await adapter.upsertDisciplineConfig({ownerProfileId:'owner-primary',dailyStopLossPoints:null,weeklyStopLossPoints:null,bigBetThresholdPoints:null,timeZone:'Asia/Tokyo',cooldownSeconds:15,version:1,updatedAt:'2026-08-21T00:00:00.000Z'});
    const out=res();
    await handleBetReports(req('/api/v1/bet-reports?period=custom&anchor=2026-08-21&startDate=2026-08-20&endDate=2026-08-10') as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(400);
    expect(JSON.parse(out.body)).toMatchObject({
      error:{code:'invalid_report_query'}
    });
  });
});
