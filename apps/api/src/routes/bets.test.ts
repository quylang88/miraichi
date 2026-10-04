import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter as createUnseededAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { hashBetAttemptPayload } from '../services/discipline-service.js';
import { handleBets } from './bets.js';
function request(method:string,url:string,body?:unknown){const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]) as Readable & {method:string;url:string};req.method=method;req.url=url;return req;}
function response(){return{statusCode:0,body:'',writeHead(code:number){this.statusCode=code;},end(body?:unknown){this.body=String(body??'');}};}
const record={betId:'bet-1',matchGroupId:'match-1',matchId:'match-1',bankrollAccountId:'account-1',homeTeamName:'Japan',awayTeamName:'Vietnam',marketType:'1X2',marketPeriod:'full_time' as const,selectionCode:'home' as const,oddsFormat:'HK',oddsValue:0.9,stakePoints:10,preBetEmotion:'calm',preBetMotivation:'planned_analysis',preBetPlanAdherence:'yes' as const,createdAt:'2026-07-02T00:00:00.000Z'};
async function createMemoryCloudPersistenceAdapter(){
  const adapter=createUnseededAdapter();
  await adapter.upsertMatchSnapshot('owner-primary',{snapshotId:'s',generatedAt:record.createdAt,importedAt:record.createdAt,sources:[],matches:[{
    id:'match-1',competition:{id:'competition-1',name:'Test League',type:'club',season:'2026'},kickoffUtc:'2026-07-03T18:00:00.000Z',status:'scheduled',
    homeTeam:{id:'japan',name:'Japan'},awayTeam:{id:'vietnam',name:'Vietnam'},score:{home:null,away:null},sourceRefs:[],updatedAt:record.createdAt
  }]});
  return adapter;
}
describe('bet routes',()=>{
  it('derives the Running Over selection and line on the server and rejects contradictory client fields',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});
    const {selectionCode:_selection,marketPeriod:_period,...base}=record;
    const running={...base,marketType:'running',runningWindow:'to_full_time',runningGoalThreshold:0.75,liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual',selectionLabel:'LIED'};
    let out=response();await handleBets(request('POST','/api/v1/bets',running) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({selectionCode:'over',lineValue:2.75,runningGoalThreshold:0.75,selectionLabel:'Over 2.75 · Running FT · 1-1'});
    for(const fields of [{selectionCode:'under'},{lineValue:0.75},{runningGoalThreshold:0.25}]){
      out=response();await handleBets(request('POST','/api/v1/bets',{...running,...fields,betId:`bad-${Object.keys(fields)[0]}`}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
      expect(out.statusCode).toBe(400);
    }
  });
  it('creates an emotion-only bet without adding motivation or plan on the server',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});
    const {preBetMotivation:_motivation,preBetPlanAdherence:_adherence,...simple}=record;
    const out=response();await handleBets(request('POST','/api/v1/bets',simple) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).not.toHaveProperty('preBetMotivation');
    expect(JSON.parse(out.body)).not.toHaveProperty('preBetPlanAdherence');
  });
  it('creates a structured manual bet without pretending it has canonical match evidence',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});
    const out=response();await handleBets(request('POST','/api/v1/bets',{...record,betId:'manual-bet',matchGroupId:'manual:manual-bet',matchId:undefined,homeTeamName:'Grass Home',awayTeamName:'Grass Away'}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({matchGroupId:'manual:manual-bet',homeTeamName:'Grass Home',awayTeamName:'Grass Away'});
    expect(JSON.parse(out.body)).not.toHaveProperty('matchId');
  });
  it('rejects unlinked, unknown, reversed or mismatched client team identities',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();
    await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});
    for(const [index,payload] of [{...record,matchId:undefined},{...record,matchId:'missing'},{...record,homeTeamName:'Vietnam',awayTeamName:'Japan'},{...record,awayTeamName:'Other'},
      {...record,matchGroupId:'manual:',matchId:undefined},{...record,matchGroupId:'manual:same',matchId:undefined,homeTeamName:'Same',awayTeamName:'Same'},
      {...record,matchGroupId:'manual:linked',matchId:'match-1',homeTeamName:'Grass Home',awayTeamName:'Grass Away'}].entries()){
      const out=response();await handleBets(request('POST','/api/v1/bets',{...payload,betId:`bad-${index}`}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
      expect(out.statusCode).toBe(400);
      expect(JSON.parse(out.body).error.code).toBe('invalid_cloud_record');
    }
  });
  it('uses the same canonical match repository as the displayed match feed when memory cloud storage is empty',async()=>{
    const adapter=createUnseededAdapter();
    await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});
    const seeded=await createMemoryCloudPersistenceAdapter();
    const match=(await seeded.findCloudMatchById('owner-primary','match-1'))!;
    const out=response();await handleBets(request('POST','/api/v1/bets',record) as never,out as never,{
      adapter,ownerProfileId:'owner-primary',matchRepository:{findById:async(id:string)=>id==='match-1'?match:null}
    });
    expect(out.statusCode).toBe(201);
  });
  it('rejects legacy label-only and custom-market creates',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});const {selectionCode:_selectionCode,marketPeriod:_marketPeriod,...legacy}=record;for(const payload of [{...legacy,selectionLabel:'Japan'},{...record,marketType:'custom'}]){const out=response();await handleBets(request('POST','/api/v1/bets',payload) as never,out as never,{adapter,ownerProfileId:'owner-primary'});expect(out.statusCode).toBe(400);expect(JSON.parse(out.body).error.code).toBe('invalid_cloud_record');}});
  it('validates structured selections and replaces a client label with the canonical label',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});const structured={...record,marketType:'over_under',marketPeriod:'full_time',selectionCode:'over',lineValue:2.5,selectionLabel:'CLIENT LIE'};let out=response();await handleBets(request('POST','/api/v1/bets',structured) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:00.000Z')});expect(out.statusCode).toBe(201);expect(JSON.parse(out.body)).toMatchObject({marketType:'over_under',marketPeriod:'full_time',selectionCode:'over',lineValue:2.5,selectionLabel:'Over 2.5 · FT'});out=response();await handleBets(request('POST','/api/v1/bets',{...structured,betId:'bad',marketType:'1X2',selectionCode:'over'}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});expect(out.statusCode).toBe(400);expect(JSON.parse(out.body).error.message).toContain('selectionCode');});
  it('binds an ongoing bet to the only active bankroll without a browser account field',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'only',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});const {bankrollAccountId:_account,...implicitRecord}=record;const out=response();await handleBets(request('POST','/api/v1/bets',implicitRecord) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:00.000Z')});expect(out.statusCode).toBe(201);expect(JSON.parse(out.body).bankrollAccountId).toBe('only');});
  it('fails closed when a primary bankroll cannot be resolved',async()=>{const {bankrollAccountId:_account,...implicitRecord}=record;for(const accountCount of [0,2]){const adapter=await createMemoryCloudPersistenceAdapter();for(let index=0;index<accountCount;index+=1)await adapter.createBankrollAccount({accountId:`a-${index}`,ownerProfileId:'owner-primary',label:`A${index}`,openingBalancePoints:100});const out=response();await handleBets(request('POST','/api/v1/bets',implicitRecord) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:00.000Z')});expect(out.statusCode).toBe(409);expect(JSON.parse(out.body).error.code).toBe(accountCount===0?'bankroll_setup_required':'multiple_bankroll_accounts');}});
  it('creates and patches owner records',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});let res=response();await handleBets(request('POST','/api/v1/bets',record) as never,res as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:00.000Z')});expect(res.statusCode).toBe(201);expect(JSON.parse(res.body)).toMatchObject({status:'pending',bankrollAccountId:'account-1'});res=response();await handleBets(request('PATCH','/api/v1/bets?id=bet-1',{notes:'edited'}) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).notes).toBe('edited');});
  it('keeps settlement projections behind the settlement endpoint',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});await adapter.createBetRecord({...record,selectionLabel:'Japan · FT',marketType:'1X2' as const,oddsFormat:'HK' as const,preBetEmotion:'calm' as const,preBetMotivation:'planned_analysis' as const,ownerProfileId:'owner-primary',status:'pending',updatedAt:record.createdAt});for(const patch of [{status:'settled'},{manualResultPoints:9},{settlementNote:'bypass'}]){const out=response();await handleBets(request('PATCH','/api/v1/bets?id=bet-1',patch) as never,out as never,{adapter,ownerProfileId:'owner-primary'});expect(out.statusCode).toBe(400);expect(JSON.parse(out.body).error.code).toBe('invalid_cloud_record');}expect(await adapter.listBetRecords('owner-primary')).toMatchObject([{status:'pending'}]);expect(await adapter.listBankrollLedgerEntries('owner-primary','account-1')).toEqual([]);});
  it('rejects formula and AI fields',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});const res=response();await handleBets(request('POST','/api/v1/bets',{...record,roi:10,recommendedStake:20}) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(400);expect(JSON.parse(res.body).error.code).toBe('invalid_cloud_record');});
  it('returns 404 for an unknown patch target',async()=>{const res=response();await handleBets(request('PATCH','/api/v1/bets?id=missing',{notes:'missing'}) as never,res as never,{adapter:await createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(404);});
  it('requires and consumes a completed challenge when a rule is triggered',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:100});await adapter.upsertDisciplineConfig({ownerProfileId:'owner-primary',dailyStopLossPoints:null,weeklyStopLossPoints:null,bigBetThresholdPoints:10,timeZone:'Asia/Tokyo',cooldownSeconds:15,version:1,updatedAt:'2026-07-02T00:00:00.000Z'});let out=response();await handleBets(request('POST','/api/v1/bets',record) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:00.000Z')});expect(out.statusCode).toBe(409);expect(JSON.parse(out.body).error.code).toBe('discipline_ack_required');await adapter.createDisciplineChallenge({challengeId:'c',ownerProfileId:'owner-primary',payloadHash:hashBetAttemptPayload(record),ruleVersion:1,triggeredRules:['big_bet'],dailyProfitLossPoints:0,weeklyProfitLossPoints:0,createdAt:'2026-07-02T00:00:00.000Z',availableAt:'2026-07-02T00:00:15.000Z'});out=response();await handleBets(request('POST','/api/v1/bets',{...record,disciplineChallengeId:'c'}) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:15.000Z')});expect(out.statusCode).toBe(201);expect(JSON.parse(out.body).disciplineSnapshot).toMatchObject({triggeredRules:['big_bet']});});
  it('requires and accepts an overridable challenge when stake exceeds available bankroll without configured thresholds',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();await adapter.createBankrollAccount({accountId:'account-1',ownerProfileId:'owner-primary',label:'Main',openingBalancePoints:5});let out=response();await handleBets(request('POST','/api/v1/bets',record) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:00.000Z')});expect(out.statusCode).toBe(409);expect(JSON.parse(out.body).error.code).toBe('discipline_ack_required');await adapter.createDisciplineChallenge({challengeId:'over',ownerProfileId:'owner-primary',payloadHash:hashBetAttemptPayload(record),ruleVersion:0,triggeredRules:['overexposure'],dailyProfitLossPoints:0,weeklyProfitLossPoints:0,createdAt:'2026-07-02T00:00:00.000Z',availableAt:'2026-07-02T00:00:15.000Z'});out=response();await handleBets(request('POST','/api/v1/bets',{...record,disciplineChallengeId:'over'}) as never,out as never,{adapter,ownerProfileId:'owner-primary',now:()=>new Date('2026-07-02T00:00:15.000Z')});expect(out.statusCode).toBe(201);expect(JSON.parse(out.body).disciplineSnapshot).toMatchObject({ruleVersion:0,triggeredRules:['overexposure'],acknowledgedAt:'2026-07-02T00:00:15.000Z'});});
});
