import type { IncomingMessage, ServerResponse } from 'node:http';
import type { SettlementCommand } from '@miraichi/shared';
import { settleBet } from '../services/bet-settlement-service.js';
import type { CloudRouteDependencies } from './cloud-route-types.js';
import { mapCloudError, sendError, sendJson } from './cloud-route-types.js';
import { readJsonObjectRequest } from './json-body.js';

export async function handleBetSettlements(req:IncomingMessage,res:ServerResponse,deps:CloudRouteDependencies):Promise<void>{
  const match=new URL(req.url??'/', 'http://localhost').pathname.match(/^\/api\/v1\/bets\/([^/]+)\/settlements$/);if(!match)return sendError(res,404,'bet_record_not_found','Bet record not found.');
  const betId=decodeURIComponent(match[1]!);
  if(req.method==='GET'){try{return sendJson(res,200,(await deps.adapter.listBetSettlementEvents(deps.ownerProfileId)).filter((event)=>event.betId===betId));}catch(error){return mapCloudError(res,error);}}
  if(req.method!=='POST')return sendError(res,405,'method_not_allowed','Method not allowed.');
  let payload;try{payload=await readJsonObjectRequest(req);}catch{return sendError(res,400,'invalid_json_body','Invalid JSON request body.');}
  try{const result=await settleBet({adapter:deps.adapter,ownerProfileId:deps.ownerProfileId,betId,command:payload as unknown as SettlementCommand,now:(deps.now??(()=>new Date()))().toISOString()});sendJson(res,201,result);}catch(error){const message=error instanceof Error?error.message:String(error);if(message.includes('not found'))return sendError(res,404,'bet_record_not_found',message);if(message.includes('Settled bets'))return sendError(res,409,'settlement_correction_required',message);if(message.includes('required')||message.includes('invalid')||message.includes('cannot'))return sendError(res,400,'invalid_settlement',message);mapCloudError(res,error);}
}
