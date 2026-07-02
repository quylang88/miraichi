import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createMemoryCloudPersistenceAdapter } from '../persistence/memory-cloud-persistence-adapter.js';
import { handleBets } from './bets.js';
function request(method:string,url:string,body?:unknown){const req=Readable.from(body===undefined?[]:[JSON.stringify(body)]) as Readable & {method:string;url:string};req.method=method;req.url=url;return req;}
function response(){return{statusCode:0,body:'',writeHead(code:number){this.statusCode=code;},end(body?:unknown){this.body=String(body??'');}};}
const record={betId:'bet-1',matchGroupId:'match-1',homeTeamName:'Japan',awayTeamName:'Vietnam',marketType:'1X2',selectionLabel:'Japan',oddsFormat:'HK',oddsValue:0.9,stakePoints:10,status:'pending',createdAt:'2026-07-02T00:00:00.000Z',updatedAt:'2026-07-02T00:00:00.000Z'};
describe('bet routes',()=>{
  it('creates and patches owner records',async()=>{const adapter=createMemoryCloudPersistenceAdapter();let res=response();await handleBets(request('POST','/api/v1/bets',record) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(201);res=response();await handleBets(request('PATCH','/api/v1/bets?id=bet-1',{status:'settled',manualResultPoints:9}) as never,res as never,{adapter,ownerProfileId:'owner-primary'});expect(JSON.parse(res.body).status).toBe('settled');});
  it('rejects formula and AI fields',async()=>{const res=response();await handleBets(request('POST','/api/v1/bets',{...record,roi:10,recommendedStake:20}) as never,res as never,{adapter:createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(400);expect(JSON.parse(res.body).error.code).toBe('invalid_cloud_record');});
  it('returns 404 for an unknown patch target',async()=>{const res=response();await handleBets(request('PATCH','/api/v1/bets?id=missing',{status:'settled'}) as never,res as never,{adapter:createMemoryCloudPersistenceAdapter(),ownerProfileId:'owner-primary'});expect(res.statusCode).toBe(404);});
});
