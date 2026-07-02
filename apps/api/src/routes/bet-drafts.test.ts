import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createCloudPersistenceAdapter } from '../persistence/create-cloud-persistence-adapter.js';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { handleBetDrafts } from './bet-drafts.js';

function request(method:string,url:string,body?:unknown){const req=Readable.from(body===undefined?[]:[typeof body==='string'?body:JSON.stringify(body)]) as Readable & {method:string;url:string};req.method=method;req.url=url;return req;}
function response(){return{statusCode:0,body:'',writeHead(code:number){this.statusCode=code;},end(body?:unknown){this.body=String(body??'');}};}
const draft={draftId:'draft-1',matchGroupId:'match-1',marketType:'1X2',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,createdAt:'2026-07-02T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'};
describe('bet draft routes',()=>{
  it('creates, lists, updates, and deletes drafts',async()=>{const adapter=createMemoryCloudPersistenceAdapter();let res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',draft) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(201);res=response();await handleBetDrafts(request('GET','/api/v1/bet-drafts') as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body)).toHaveLength(1);res=response();await handleBetDrafts(request('PUT','/api/v1/bet-drafts?id=draft-1',{...draft,stakePoints:20}) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).stakePoints).toBe(20);res=response();await handleBetDrafts(request('DELETE','/api/v1/bet-drafts?id=draft-1') as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(204);});
  it('returns stable errors for disabled mode and invalid JSON',async()=>{const adapter=createCloudPersistenceAdapter({mode:'disabled',appEnv:'local',ownerProfileId:'owner-primary'});let res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts',draft) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).error.code).toBe('cloud_persistence_unconfigured');res=response();await handleBetDrafts(request('POST','/api/v1/bet-drafts','{bad') as never,res as never,{adapter:createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).error.code).toBe('invalid_json_body');});
});
