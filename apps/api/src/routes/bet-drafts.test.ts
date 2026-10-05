import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createCloudPersistenceAdapter } from '../persistence/create-cloud-persistence-adapter.js';
import { createMemoryCloudPersistenceAdapter as createUnseededAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { handleBetDrafts } from './bet-drafts.js';

function request(method:string,url:string,body?:unknown){const req=Readable.from(body===undefined?[]:[typeof body==='string'?body:JSON.stringify(body)]) as Readable & {method:string;url:string};req.method=method;req.url=url;return req;}
function response(){return{statusCode:0,body:'',writeHead(code:number){this.statusCode=code;},end(body?:unknown){this.body=String(body??'');}};}
const draft={draftId:'draft-1',matchGroupId:'match-1',homeTeamName:'Japan',awayTeamName:'Vietnam',marketType:'1X2',marketPeriod:'full_time',selectionCode:'home',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,createdAt:'2026-07-02T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'};
async function createMemoryCloudPersistenceAdapter(){
  const adapter=createUnseededAdapter();
  await adapter.upsertMatchSnapshot('owner-primary',{snapshotId:'s',generatedAt:draft.createdAt,importedAt:draft.createdAt,sources:[],matches:[{
    id:'match-1',competition:{id:'competition-1',name:'Test League',type:'club',season:'2026'},kickoffUtc:'2026-07-03T18:00:00.000Z',status:'scheduled',
    homeTeam:{id:'japan',name:'Japan'},awayTeam:{id:'vietnam',name:'Vietnam'},score:{home:null,away:null},sourceRefs:[],updatedAt:draft.createdAt
  }]});
  return adapter;
}
describe('bet draft routes',()=>{
  it('round-trips a corner handicap with a server-generated signed team label', async () => {
    const adapter = await createMemoryCloudPersistenceAdapter();

    const out = response();
    await handleBetDrafts(request('POST', '/api/v1/bet-drafts', { ...draft, marketType: 'corners', marketPeriod: 'first_half', selectionCode: 'away', lineValue: 2.25, selectionLabel: 'WRONG' }) as never, out as never, { adapter, ownerProfileId: 'owner-primary' });
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({ marketType: 'corners', selectionCode: 'away', lineValue: 2.25, selectionLabel: 'Vietnam +2.25 corners · HT' });
    const listed = response();
    await handleBetDrafts(request('GET', '/api/v1/bet-drafts') as never, listed as never, { adapter, ownerProfileId: 'owner-primary' });
    expect(JSON.parse(listed.body)[0]).toMatchObject({ marketType: 'corners', selectionCode: 'away', lineValue: 2.25 });
  });
  it('derives fixed 15-minute Running Over 0.5 without a required minute',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();const {selectionCode:_selection,marketPeriod:_period,...base}=draft;
    let out=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',{...base,marketType:'running',runningWindow:'fixed_15',windowStartMinute:60,windowEndMinute:75,liveScoreHome:1,liveScoreAway:1,liveContextSource:'manual'}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({selectionCode:'over',lineValue:0.5,runningGoalThreshold:0.5});
    expect(JSON.parse(out.body)).not.toHaveProperty('liveMinute');
  });
  it('round-trips a simple draft without adding optional motivation or plan',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();const out=response();
    await handleBetDrafts(request('POST','/api/v1/bet-drafts',{...draft,preBetEmotion:'calm'}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).not.toHaveProperty('preBetMotivation');
    expect(JSON.parse(out.body)).not.toHaveProperty('preBetPlanAdherence');
  });
  it('creates a structured manual draft for a match outside the canonical feed',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();const out=response();
    await handleBetDrafts(request('POST','/api/v1/bet-drafts',{...draft,draftId:'manual-draft',matchGroupId:'manual:manual-draft',homeTeamName:'Grass Home',awayTeamName:'Grass Away'}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    expect(JSON.parse(out.body)).toMatchObject({matchGroupId:'manual:manual-draft',homeTeamName:'Grass Home',awayTeamName:'Grass Away'});
  });
  it('rejects unknown canonical group IDs and client-supplied team substitutions on POST',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();
    for(const payload of [{...draft,matchGroupId:'missing'},{...draft,homeTeamName:'Vietnam',awayTeamName:'Japan'},{...draft,awayTeamName:'Other'},
      {...draft,matchGroupId:'manual:'},{...draft,matchGroupId:'manual:same',homeTeamName:'Same',awayTeamName:'Same'},
      {...draft,matchGroupId:'manual:linked',matchId:'match-1',homeTeamName:'Grass Home',awayTeamName:'Grass Away'}]){
      const out=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',payload) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
      expect(out.statusCode).toBe(400);
      expect(JSON.parse(out.body).error.code).toBe('invalid_cloud_record');
    }
  });
  it('protects linked draft identity on PUT while retaining legacy unlinked draft edits',async()=>{
    const adapter=await createMemoryCloudPersistenceAdapter();
    let out=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',draft) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(201);
    for(const payload of [{...draft,awayTeamName:'Other'},{...draft,matchGroupId:'missing'},{...draft,matchId:'missing'}]){
      out=response();await handleBetDrafts(request('PUT','/api/v1/bet-drafts?id=draft-1',payload) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
      expect(out.statusCode).toBe(400);
    }
    await adapter.saveBetDraft('owner-primary',{...draft,draftId:'legacy',matchGroupId:'manual:japan-vietnam',selectionLabel:'Japan · FT'} as never);
    out=response();await handleBetDrafts(request('PUT','/api/v1/bet-drafts?id=legacy',{...draft,draftId:'legacy',matchGroupId:'manual:japan-vietnam',homeTeamName:'Edited Japan'}) as never,out as never,{adapter,ownerProfileId:'owner-primary'});
    expect(out.statusCode).toBe(200);
    expect(JSON.parse(out.body).homeTeamName).toBe('Edited Japan');
  });
  it('rejects legacy label-only and custom-market creates',async()=>{const {selectionCode:_selectionCode,marketPeriod:_marketPeriod,...legacy}=draft;for(const payload of [{...legacy,selectionLabel:'Japan'},{...draft,marketType:'custom'}]){const res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',payload) as never,res as never,{adapter:await createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(400);}});
  it('validates structured selections and stores only the server-generated label',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();const structured={...draft,homeTeamName:'Japan',awayTeamName:'Vietnam',marketType:'handicap',marketPeriod:'first_half',selectionCode:'away',lineValue:0.25,selectionLabel:'WRONG'};let res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',structured) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(201);expect(JSON.parse(res.body)).toMatchObject({selectionCode:'away',selectionLabel:'Vietnam +0.25 · HT'});res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',{...structured,draftId:'invalid',marketPeriod:undefined}) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(400);expect(JSON.parse(res.body).error.code).toBe('invalid_cloud_record');});
  it('keeps odds and stake positive with their existing decimal limits',async()=>{for(const invalid of [{oddsValue:0},{oddsValue:0.12345},{stakePoints:-1},{stakePoints:1.234}]){const res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',{...draft,...invalid}) as never,res as never,{adapter:await createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(400);}});
  it('rejects legacy emotions for newly created drafts',async()=>{for(const preBetEmotion of ['frustrated','anxious','tired']){const res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',{...draft,preBetEmotion}) as never,res as never,{adapter:await createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(400);}});
  it('creates, lists, updates, and deletes drafts',async()=>{const adapter=await createMemoryCloudPersistenceAdapter();let res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',draft) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(201);res=response();await handleBetDrafts(request('GET','/api/v1/bet-drafts') as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body)).toHaveLength(1);res=response();await handleBetDrafts(request('PUT','/api/v1/bet-drafts?id=draft-1',{...draft,stakePoints:20}) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).stakePoints).toBe(20);res=response();await handleBetDrafts(request('DELETE','/api/v1/bet-drafts?id=draft-1') as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(204);});
  it('returns stable errors for disabled mode and invalid JSON',async()=>{const adapter=createCloudPersistenceAdapter({mode:'disabled',appEnv:'local',ownerProfileId:'owner-primary'});let res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',draft) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).error.code).toBe('cloud_persistence_unconfigured');res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts','{bad') as never,res as never,{adapter:await createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).error.code).toBe('invalid_json_body');});
});
